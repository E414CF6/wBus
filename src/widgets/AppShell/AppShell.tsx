"use client";

import dynamic from "next/dynamic";
import {useRouter, useSearchParams} from "next/navigation";
import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";

import {useBusRouteMap} from "@entities/route/hooks";
import {useCityContext, useCityFeatures} from "@entities/city";

import {useBusSortedList} from "@features/live-tracking/useBusSortedList";
import {MapRouteHeader} from "@features/map-view/MapRouteHeader";
import {RouteScheduleModal} from "@features/map-view/RouteScheduleModal";
import {OnboardingModal} from "@features/onboarding";

import {buildPageHref, resolveSpecialPageFromSearch, SPECIAL_PAGE_IDS,} from "@shared/config/pages";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {isWeekend} from "@shared/lib/timeUtils";
import {BottomNav} from "@widgets/BottomNav";
import {buildMapUrl, useAppNavigation} from "./hooks/useAppNavigation";

const MapWrapper = dynamic(() => import("@widgets/MapContainer/MapWrapper"), {
    ssr: false,
});
const RouteLayer = dynamic(() => import("@widgets/MapContainer/RouteLayer"), {
    ssr: false,
});
const YonseiCampusPage = dynamic(
    () => import("@widgets/YonseiCampusPage/YonseiCampusPage"),
    {ssr: false}
);

export function AppShell() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const {settings, hasLoadedSettings, isOnboardingOpen} = useAppSettings();

    const activeSpecialPage = useMemo(
        () => resolveSpecialPageFromSearch(searchParams),
        [searchParams]
    );

    const hasCheckedInitialStartPageRef = useRef(false);

    // Redirect root "/" (with empty query string) to "/?page=yonsei_mirae" on initial load if configured as default start page
    useEffect(() => {
        if (hasCheckedInitialStartPageRef.current) return;
        if (!hasLoadedSettings) return;
        if (isOnboardingOpen || !settings.hasCompletedOnboarding) return;
        hasCheckedInitialStartPageRef.current = true;
        if (settings.defaultStartPage !== "yonsei") return;
        if (activeSpecialPage !== null) return;
        if (typeof window === "undefined") return;
        if (window.location.pathname === "/" && window.location.search === "") {
            router.replace(buildPageHref(SPECIAL_PAGE_IDS.YONSEI_MIRAE));
        }
    }, [
        hasLoadedSettings,
        isOnboardingOpen,
        settings.hasCompletedOnboarding,
        settings.defaultStartPage,
        activeSpecialPage,
        router,
    ]);

    if (activeSpecialPage === SPECIAL_PAGE_IDS.YONSEI_MIRAE) {
        return <YonseiCampusPage/>;
    }

    return <MapAppShell/>;
}

function MapAppShell() {
    const {
        dayMode,
        setDayMode,
        selectedRoute,
        handleRouteChange,
        isScheduleRoute,
    } = useAppNavigation();

    // Live weekend check for timetable badge
    const [isTodayWeekendOrHoliday, setIsTodayWeekendOrHoliday] = useState<boolean>(() => isWeekend());
    useEffect(() => {
        const timer = setInterval(() => {
            const current = isWeekend();
            setIsTodayWeekendOrHoliday((prev) => (prev !== current ? current : prev));
        }, 60000);
        return () => clearInterval(timer);
    }, []);

    const {currentCity, isCityReady} = useCityContext();
    const {hasDetailedTimetable, defaultQuickRoutes, defaultRoute} = useCityFeatures();

    // Fetch route map for current city once URL/localStorage city has resolved
    const routeMap = useBusRouteMap(isCityReady, currentCity.code);
    const hasRouteMap = Boolean(routeMap && Object.keys(routeMap).length > 0);
    const allRoutes = useMemo(
        () => (routeMap ? Object.keys(routeMap) : defaultQuickRoutes),
        [routeMap, defaultQuickRoutes]
    );
    const activeRoute = useMemo(() => {
        if (!isCityReady) return selectedRoute;
        if (!routeMap || Object.keys(routeMap).length === 0) return selectedRoute;
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const urlCityCode = params.get("cityCode") || params.get("city");
            if (urlCityCode && urlCityCode !== currentCity.code) {
                return selectedRoute;
            }
        }
        if (routeMap[selectedRoute]) return selectedRoute;

        if (defaultRoute && routeMap[defaultRoute]) {
            return defaultRoute;
        }
        return Object.keys(routeMap)[0] ?? selectedRoute;
    }, [isCityReady, routeMap, selectedRoute, defaultRoute, currentCity.code]);
    const isRouteDataEnabled = isCityReady && hasRouteMap && Boolean(activeRoute);

    // Centered floating RouteScheduleModal state (for cities with detailed timetable or direct /schedule visit)
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(isScheduleRoute);
    const [scheduleLocation, setScheduleLocation] = useState<"origin" | "dest">("dest");

    // Handler for opening the centered Route Timetable Modal from Map Pins or Route Header
    const handleOpenSchedule = useCallback(
        (targetRouteOrDoc?: string, location?: "origin" | "dest") => {
            if (!hasDetailedTimetable) return;
            if (targetRouteOrDoc) {
                const cleanRoute = targetRouteOrDoc.replace(/^route:/, "");
                const [targetRoute, routeLoc] = cleanRoute.split(":");
                if (targetRoute && targetRoute !== activeRoute) {
                    handleRouteChange(targetRoute, currentCity.code);
                }
                const parsedLoc = location || (routeLoc === "origin" || routeLoc === "dest" ? routeLoc : undefined);
                if (parsedLoc) {
                    setScheduleLocation(parsedLoc);
                }
            } else if (location) {
                setScheduleLocation(location);
            }
            setIsScheduleModalOpen(true);
        },
        [hasDetailedTimetable, activeRoute, handleRouteChange, currentCity.code]
    );

    // Live telemetry for active map route
    const liveBusData = useBusSortedList(activeRoute, isRouteDataEnabled, currentCity.code);

    // Route Variation state scoped per active route (e.g. 30 base route vs via-Sangji)
    const [variantMap, setVariantMap] = useState<Record<string, string | null>>({});
    const selectedVariantId = variantMap[activeRoute] || null;
    const handleSelectVariant = useCallback((variantId: string | null) => {
        setVariantMap((prev) => ({...prev, [activeRoute]: variantId}));
    }, [activeRoute]);

    useEffect(() => {
        if (!isCityReady || !hasRouteMap) return;
        if (!activeRoute || activeRoute === selectedRoute) return;
        if (isScheduleRoute && isScheduleModalOpen) return;
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const urlCityCode = params.get("cityCode") || params.get("city");
            if (urlCityCode && urlCityCode !== currentCity.code) {
                return;
            }
        }
        handleRouteChange(activeRoute, currentCity.code);
    }, [
        isCityReady,
        hasRouteMap,
        activeRoute,
        selectedRoute,
        isScheduleRoute,
        isScheduleModalOpen,
        currentCity.code,
        handleRouteChange,
    ]);

    // Lock root html/body overflow only while MapAppShell is mounted so document routes (/privacy, /terms) can scroll normally.
    useEffect(() => {
        if (typeof document === "undefined") return;
        document.documentElement.classList.add("wbus-map-lock");
        return () => {
            document.documentElement.classList.remove("wbus-map-lock");
        };
    }, []);

    return (
        <div className="fixed inset-0 w-full h-dvh overflow-hidden bg-slate-50 dark:bg-[#090d16]">
            {/* 1. Real-time Map View Container (Main View) */}
            <div className="absolute inset-0 w-full h-full overflow-hidden block">
                <MapRouteHeader
                    selectedRoute={activeRoute}
                    onSelectRoute={handleRouteChange}
                    runningBuses={liveBusData.sortedList}
                    allRoutes={allRoutes}
                    connectionStatus={liveBusData.connectionStatus}
                    hasFetched={liveBusData.hasFetched}
                    isDegraded={liveBusData.isDegraded}
                    onReconnect={liveBusData.reconnect}
                    selectedVariantId={selectedVariantId}
                    onSelectVariant={handleSelectVariant}
                    onOpenScheduleModal={handleOpenSchedule}
                    enabled={isRouteDataEnabled}
                />

                <MapWrapper>
                    <RouteLayer
                        routeName={activeRoute}
                        onRouteChange={handleRouteChange}
                        onOpenScheduleModal={handleOpenSchedule}
                        enabled={isRouteDataEnabled}
                        selectedVariantId={selectedVariantId}
                        cityCode={currentCity.code}
                        dayMode={dayMode}
                        isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
                    />
                </MapWrapper>
            </div>

            {/* 2. Centered Floating Full Route Timetable Modal (Cities with detailed timetable or /schedule) */}
            {(hasDetailedTimetable || isScheduleRoute) && (
                <RouteScheduleModal
                    isOpen={isScheduleModalOpen}
                    routeName={activeRoute}
                    onClose={() => {
                        setIsScheduleModalOpen(false);
                        if (isScheduleRoute && typeof window !== "undefined") {
                            window.history.replaceState(null, "", buildMapUrl(activeRoute, currentCity.code));
                        }
                    }}
                    dayMode={dayMode}
                    isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
                    initialLocation={scheduleLocation}
                />
            )}

            {/* 3. Unified Bottom Floating Pill Navigation Bar */}
            <BottomNav
                dayMode={dayMode}
                onDayModeChange={setDayMode}
                isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
                allRoutes={allRoutes}
                selectedRoute={activeRoute}
                onSelectRoute={handleRouteChange}
                selectedVariantId={selectedVariantId}
                onSelectVariant={handleSelectVariant}
                runningBuses={liveBusData.sortedList}
                getDirection={liveBusData.getDirection}
                connectionStatus={liveBusData.connectionStatus}
                hasFetched={liveBusData.hasFetched}
                lastUpdated={liveBusData.lastUpdated}
                onReconnect={liveBusData.reconnect}
            />

            {/* 4. First-Visit Onboarding Modal */}
            <OnboardingModal/>
        </div>
    );
}

export default AppShell;
