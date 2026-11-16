"use client";

import dynamic from "next/dynamic";
import {useSearchParams} from "next/navigation";
import React, {useCallback, useEffect, useMemo, useState} from "react";

import {useBusRouteMap} from "@entities/route/hooks";
import {useCityContext, useCityFeatures} from "@entities/city";
import {type WikiPageDocument} from "@entities/wiki";

import {useBusSortedList} from "@features/live-tracking/useBusSortedList";
import {MapRouteHeader} from "@features/map-view/MapRouteHeader";
import {RouteScheduleModal} from "@features/map-view/RouteScheduleModal";
import {OnboardingModal} from "@features/onboarding";

import {useAppMapContext} from "@shared/context/AppMapContext";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {isWeekend} from "@shared/lib/timeUtils";
import {BottomNav} from "@widgets/BottomNav";
import {WikiPinModal} from "@widgets/MapContainer/ui/WikiPinModal";
import {WikiPinListModal} from "@widgets/MapContainer/ui/WikiPinListModal";
import {WikiCreateModal} from "@widgets/MapContainer/ui/WikiCreateModal";
import {useAppNavigation} from "./hooks/useAppNavigation";

const MapWrapper = dynamic(() => import("@widgets/MapContainer/MapWrapper"), {
    ssr: false,
});
const RouteLayer = dynamic(() => import("@widgets/MapContainer/RouteLayer"), {
    ssr: false,
});
const WikiPinMarker = dynamic(() => import("@widgets/MapContainer/WikiPinMarker"), {
    ssr: false,
});
const WikiPinPlacementOverlay = dynamic(
    () =>
        import("@widgets/MapContainer/WikiPinPlacementOverlay").then(
            (mod) => mod.WikiPinPlacementOverlay
        ),
    {ssr: false}
);

export function AppShell() {
    return <MapAppShell/>;
}

function MapAppShell() {
    const {
        dayMode,
        setDayMode,
        selectedRoute,
        handleRouteChange,
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

    const {currentCity, isCityReady, setCity} = useCityContext();
    const {hasDetailedTimetable, defaultQuickRoutes, defaultRoute} = useCityFeatures();
    const {map} = useAppMapContext();
    const {settings, updateSettings} = useAppSettings();

    // Centered floating RouteScheduleModal state (for cities with detailed timetable)
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [scheduleLocation, setScheduleLocation] = useState<"origin" | "dest">("dest");

    // Integrated Map-Wiki state
    const searchParams = useSearchParams();
    const initialQueryWiki = searchParams.get("wiki")?.trim() || null;
    const [activeWikiModal, setActiveWikiModal] = useState<{
        slug: string;
        mode: "read" | "edit" | "history";
    } | null>(() => (initialQueryWiki ? {slug: initialQueryWiki, mode: "read"} : null));
    const [prevQueryWiki, setPrevQueryWiki] = useState<string | null>(initialQueryWiki);
    if (initialQueryWiki !== prevQueryWiki) {
        setPrevQueryWiki(initialQueryWiki);
        if (initialQueryWiki) {
            setActiveWikiModal({slug: initialQueryWiki, mode: "read"});
        }
    }
    const [isWikiPinListOpen, setIsWikiPinListOpen] = useState(false);
    const [pendingPinCoords, setPendingPinCoords] = useState<{ lat: number; lng: number } | null>(null);
    const [createWikiDraft, setCreateWikiDraft] = useState<{
        lat?: number;
        lng?: number;
        slug?: string;
    } | null>(null);
    const isPinPlacementMode = pendingPinCoords !== null;

    const handleStartAddWikiPin = useCallback(() => {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("wbus:close-stop-popup"));
            window.dispatchEvent(new CustomEvent("wbus:close-timetable"));
            window.dispatchEvent(new CustomEvent("wbus:close-bus-list"));
        }
        setIsWikiPinListOpen(false);
        setActiveWikiModal(null);
        setIsScheduleModalOpen(false);
        if (!settings.showWikiPins) {
            updateSettings({showWikiPins: true});
        }
        const center = map?.getCenter();
        setPendingPinCoords({
            lat: center?.lat ?? currentCity.lat,
            lng: center?.lng ?? currentCity.lng,
        });
    }, [map, currentCity.lat, currentCity.lng, settings.showWikiPins, updateSettings]);

    const handleConfirmPinLocation = useCallback(() => {
        if (!pendingPinCoords) return;
        setCreateWikiDraft({
            lat: pendingPinCoords.lat,
            lng: pendingPinCoords.lng,
        });
        setPendingPinCoords(null);
    }, [pendingPinCoords]);

    const handleCancelPinPlacement = useCallback(() => {
        setPendingPinCoords(null);
    }, []);

    const handleWikiCreated = useCallback(
        (created: WikiPageDocument) => {
            setCreateWikiDraft(null);
            if (map && typeof created.lat === "number" && typeof created.lng === "number") {
                map.flyTo({
                    center: [created.lng, created.lat],
                    zoom: Math.max(map.getZoom(), 15.5),
                    duration: 650,
                });
            }
            setActiveWikiModal({slug: created.slug, mode: "read"});
        },
        [map]
    );

    const handleSelectRouteFromWiki = useCallback(
        (routeNo: string, targetCityCode: string) => {
            if (targetCityCode && targetCityCode !== currentCity.code) {
                setCity(targetCityCode, {skipFlyTo: true});
            }
            handleRouteChange(routeNo, targetCityCode || currentCity.code);
        },
        [currentCity.code, setCity, handleRouteChange]
    );

    // Allow Escape key to exit wiki pin placement mode
    useEffect(() => {
        if (!isPinPlacementMode) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setPendingPinCoords(null);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isPinPlacementMode]);

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

                <MapWrapper
                    isPinPlacementMode={isPinPlacementMode}
                    onPinPlacementClick={(coords) => setPendingPinCoords(coords)}
                >
                    <RouteLayer
                        routeName={activeRoute}
                        onRouteChange={handleRouteChange}
                        onOpenScheduleModal={handleOpenSchedule}
                        enabled={isRouteDataEnabled}
                        selectedVariantId={selectedVariantId}
                        cityCode={currentCity.code}
                        dayMode={dayMode}
                        isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
                        isPinPlacementMode={isPinPlacementMode}
                    />
                    <WikiPinMarker
                        enabled={settings.showWikiPins}
                        selectedSlug={activeWikiModal?.slug ?? null}
                        isPinPlacementMode={isPinPlacementMode}
                        onSelectWikiPin={(slug) => setActiveWikiModal({slug, mode: "read"})}
                    />
                    {pendingPinCoords && (
                        <WikiPinPlacementOverlay
                            coords={pendingPinCoords}
                            onChangeCoords={setPendingPinCoords}
                            onConfirm={handleConfirmPinLocation}
                            onCancel={handleCancelPinPlacement}
                        />
                    )}
                </MapWrapper>
            </div>

            {/* 2. Centered Floating Full Route Timetable Modal (Cities with detailed timetable) */}
            {hasDetailedTimetable && (
                <RouteScheduleModal
                    isOpen={isScheduleModalOpen}
                    routeName={activeRoute}
                    onClose={() => setIsScheduleModalOpen(false)}
                    dayMode={dayMode}
                    isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
                    initialLocation={scheduleLocation}
                />
            )}

            {/* 2-b. In-Map Wiki Pin List Modal */}
            <WikiPinListModal
                isOpen={isWikiPinListOpen}
                onClose={() => setIsWikiPinListOpen(false)}
                onStartAddPin={handleStartAddWikiPin}
                onSelectWikiPin={(slug, mode = "read") =>
                    setActiveWikiModal({slug, mode})
                }
            />

            {/* 2-c. In-Map Wiki Pin Reader / Editor / History Modal */}
            <WikiPinModal
                slug={activeWikiModal?.slug ?? null}
                initialMode={activeWikiModal?.mode ?? "read"}
                onClose={() => setActiveWikiModal(null)}
                onSelectSlug={(nextSlug) => setActiveWikiModal({slug: nextSlug, mode: "read"})}
                onSelectRouteOnMap={handleSelectRouteFromWiki}
                onCreateNewFromSlug={(missingSlug) => {
                    const center = map?.getCenter();
                    setActiveWikiModal(null);
                    setCreateWikiDraft({
                        slug: missingSlug,
                        lat: center?.lat ?? currentCity.lat,
                        lng: center?.lng ?? currentCity.lng,
                    });
                }}
            />

            {/* 2-d. In-Map New Wiki Document Creation Modal */}
            <WikiCreateModal
                isOpen={createWikiDraft !== null}
                initialSlug={createWikiDraft?.slug}
                initialLat={createWikiDraft?.lat}
                initialLng={createWikiDraft?.lng}
                initialCityCode={currentCity.code}
                onClose={() => setCreateWikiDraft(null)}
                onCreated={handleWikiCreated}
                onRepickLocation={() => {
                    const fallbackLat = createWikiDraft?.lat ?? currentCity.lat;
                    const fallbackLng = createWikiDraft?.lng ?? currentCity.lng;
                    setCreateWikiDraft(null);
                    setPendingPinCoords({lat: fallbackLat, lng: fallbackLng});
                }}
            />

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
                onOpenWikiPinList={() => {
                    if (typeof window !== "undefined") {
                        window.dispatchEvent(new CustomEvent("wbus:close-stop-popup"));
                        window.dispatchEvent(new CustomEvent("wbus:close-timetable"));
                        window.dispatchEvent(new CustomEvent("wbus:close-bus-list"));
                    }
                    setIsWikiPinListOpen(true);
                }}
                onCancelAddWikiPin={handleCancelPinPlacement}
                isPinPlacementMode={isPinPlacementMode}
            />

            {/* 4. First-Visit Onboarding Modal */}
            <OnboardingModal/>
        </div>
    );
}

export default AppShell;
