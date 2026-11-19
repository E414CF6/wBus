"use client";

import dynamic from "next/dynamic";
import {useSearchParams} from "next/navigation";
import React, {useCallback, useEffect, useMemo, useState} from "react";

import {useBusRouteMap} from "@entities/route/hooks";
import {useCityContext, useCityFeatures} from "@entities/city";
import {
    mutateAllWikiQueries,
    useWikiNickname,
    type WikiPageDocument,
    type WikiPageSummary,
    type WikiPinColor,
} from "@entities/wiki";

import {useBusSortedList} from "@features/live-tracking/useBusSortedList";
import {MapRouteHeader} from "@features/map-view/MapRouteHeader";
import {RouteScheduleModal} from "@features/map-view/RouteScheduleModal";
import {OnboardingModal} from "@features/onboarding";
import type {WikiFormDraft} from "@features/wiki";

import {UI_TEXT} from "@shared/config/locale";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {isWeekend} from "@shared/lib/timeUtils";
import {BottomNav} from "@widgets/BottomNav";
import {WikiPinModal} from "@widgets/MapContainer/ui/WikiPinModal";
import {WikiPinListModal} from "@widgets/MapContainer/ui/WikiPinListModal";
import {WikiCreateModal} from "@widgets/MapContainer/ui/WikiCreateModal";
import {WikiPinContextMenu} from "@widgets/MapContainer/ui/WikiPinContextMenu";
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
    const {storedNickname} = useWikiNickname();

    // Centered floating RouteScheduleModal state (for cities with detailed timetable)
    const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
    const [scheduleLocation, setScheduleLocation] = useState<"origin" | "dest">("dest");

    // Integrated Map-Wiki state
    const searchParams = useSearchParams();
    const initialQueryWiki = searchParams.get("wiki")?.trim() || null;
    const [activeWikiModal, setActiveWikiModal] = useState<{
        slug: string;
        mode: "read" | "edit" | "history" | "discussion";
        draft?: Partial<WikiFormDraft> | null;
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
    const [movingPinTarget, setMovingPinTarget] = useState<{
        slug: string;
        title: string;
        version: number;
        pinColor: WikiPinColor;
    } | null>(null);
    const [editingPickTarget, setEditingPickTarget] = useState<{
        slug: string;
        draft: WikiFormDraft;
    } | null>(null);
    const [pendingCreateFormDraft, setPendingCreateFormDraft] = useState<Partial<WikiFormDraft> | null>(null);
    const [pinContextMenu, setPinContextMenu] = useState<{
        page: WikiPageSummary;
        position: { x: number; y: number };
    } | null>(null);
    const [isUpdatingPinMeta, setIsUpdatingPinMeta] = useState(false);
    const [pinActionError, setPinActionError] = useState<string | null>(null);
    const [createWikiDraft, setCreateWikiDraft] = useState<{
        lat?: number;
        lng?: number;
        slug?: string;
        draft?: Partial<WikiFormDraft>;
    } | null>(null);
    const isPinPlacementMode = pendingPinCoords !== null;

    const closeMapPopupsForWiki = useCallback(() => {
        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("wbus:close-stop-popup"));
            window.dispatchEvent(new CustomEvent("wbus:close-timetable"));
            window.dispatchEvent(new CustomEvent("wbus:close-bus-list"));
        }
        setPinContextMenu(null);
        setPinActionError(null);
    }, []);

    const handleStartAddWikiPin = useCallback(() => {
        closeMapPopupsForWiki();
        setMovingPinTarget(null);
        setEditingPickTarget(null);
        setPendingCreateFormDraft(null);
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
    }, [closeMapPopupsForWiki, map, currentCity.lat, currentCity.lng, settings.showWikiPins, updateSettings]);

    const handleStartMovePin = useCallback(
        (target: {
            slug: string;
            title: string;
            version: number;
            pinColor: WikiPinColor;
            lat?: number | null;
            lng?: number | null
        }) => {
            closeMapPopupsForWiki();
            setEditingPickTarget(null);
            setPendingCreateFormDraft(null);
            setIsWikiPinListOpen(false);
            setActiveWikiModal(null);
            setIsScheduleModalOpen(false);
            if (!settings.showWikiPins) {
                updateSettings({showWikiPins: true});
            }
            const center = map?.getCenter();
            setMovingPinTarget({
                slug: target.slug,
                title: target.title,
                version: target.version,
                pinColor: target.pinColor,
            });
            setPendingPinCoords({
                lat: typeof target.lat === "number" ? target.lat : (center?.lat ?? currentCity.lat),
                lng: typeof target.lng === "number" ? target.lng : (center?.lng ?? currentCity.lng),
            });
        },
        [closeMapPopupsForWiki, map, currentCity.lat, currentCity.lng, settings.showWikiPins, updateSettings],
    );

    const handleStartPickLocationInEditor = useCallback(
        (slug: string, draft: WikiFormDraft) => {
            closeMapPopupsForWiki();
            setMovingPinTarget(null);
            setPendingCreateFormDraft(null);
            setActiveWikiModal(null);
            if (!settings.showWikiPins) {
                updateSettings({showWikiPins: true});
            }
            const center = map?.getCenter();
            setEditingPickTarget({slug, draft});
            setPendingPinCoords({
                lat: typeof draft.lat === "number" ? draft.lat : (center?.lat ?? currentCity.lat),
                lng: typeof draft.lng === "number" ? draft.lng : (center?.lng ?? currentCity.lng),
            });
        },
        [closeMapPopupsForWiki, map, currentCity.lat, currentCity.lng, settings.showWikiPins, updateSettings],
    );

    const handleChangePinColor = useCallback(
        async (page: WikiPageSummary, nextColor: WikiPinColor) => {
            if (isUpdatingPinMeta || page.pinColor === nextColor) return;
            setIsUpdatingPinMeta(true);
            setPinActionError(null);
            try {
                const res = await fetch(`/api/wiki/${encodeURIComponent(page.slug)}/pin`, {
                    method: "PATCH",
                    headers: {"Content-Type": "application/json"},
                    body: JSON.stringify({
                        baseVersion: page.version,
                        pinColor: nextColor,
                        nickname: storedNickname,
                    }),
                });
                const body = await res.json().catch(() => null);
                if (!res.ok) {
                    setPinActionError(body?.error || UI_TEXT.WIKI.PIN_ACTIONS.COLOR_CHANGE_FAILED_STATUS(res.status));
                    return;
                }
                const updated = body?.document as WikiPageDocument | undefined;
                if (updated) {
                    setPinContextMenu((prev) =>
                        prev && prev.page.slug === page.slug
                            ? {
                                ...prev,
                                page: {
                                    ...prev.page,
                                    version: updated.version,
                                    pinColor: updated.pinColor,
                                },
                            }
                            : prev,
                    );
                }
                await mutateAllWikiQueries().catch(() => []);
            } catch (err) {
                setPinActionError(
                    err instanceof Error ? err.message : UI_TEXT.WIKI.PIN_ACTIONS.COLOR_CHANGE_ERROR,
                );
            } finally {
                setIsUpdatingPinMeta(false);
            }
        },
        [isUpdatingPinMeta, storedNickname],
    );

    const handleConfirmPinLocation = useCallback(async () => {
        if (!pendingPinCoords) return;

        if (movingPinTarget) {
            if (isUpdatingPinMeta) return;
            setIsUpdatingPinMeta(true);
            setPinActionError(null);
            try {
                const res = await fetch(
                    `/api/wiki/${encodeURIComponent(movingPinTarget.slug)}/pin`,
                    {
                        method: "PATCH",
                        headers: {"Content-Type": "application/json"},
                        body: JSON.stringify({
                            baseVersion: movingPinTarget.version,
                            lat: pendingPinCoords.lat,
                            lng: pendingPinCoords.lng,
                            nickname: storedNickname,
                        }),
                    },
                );
                const body = await res.json().catch(() => null);
                if (!res.ok) {
                    setPinActionError(body?.error || UI_TEXT.WIKI.PIN_ACTIONS.MOVE_FAILED_STATUS(res.status));
                    return;
                }
                await mutateAllWikiQueries().catch(() => []);
                setMovingPinTarget(null);
                setPendingPinCoords(null);
            } catch (err) {
                setPinActionError(
                    err instanceof Error ? err.message : UI_TEXT.WIKI.PIN_ACTIONS.MOVE_ERROR,
                );
            } finally {
                setIsUpdatingPinMeta(false);
            }
            return;
        }

        if (editingPickTarget) {
            const target = editingPickTarget;
            setEditingPickTarget(null);
            setPendingPinCoords(null);
            setActiveWikiModal({
                slug: target.slug,
                mode: "edit",
                draft: {
                    ...target.draft,
                    lat: pendingPinCoords.lat,
                    lng: pendingPinCoords.lng,
                },
            });
            return;
        }

        const preservedDraft = pendingCreateFormDraft;
        setPendingCreateFormDraft(null);
        setCreateWikiDraft({
            lat: pendingPinCoords.lat,
            lng: pendingPinCoords.lng,
            ...(preservedDraft ? {draft: preservedDraft} : {}),
        });
        setPendingPinCoords(null);
    }, [
        pendingPinCoords,
        movingPinTarget,
        editingPickTarget,
        pendingCreateFormDraft,
        isUpdatingPinMeta,
        storedNickname,
    ]);

    const handleCancelPinPlacement = useCallback(() => {
        if (editingPickTarget) {
            const target = editingPickTarget;
            setEditingPickTarget(null);
            setPendingPinCoords(null);
            setActiveWikiModal({
                slug: target.slug,
                mode: "edit",
                draft: target.draft,
            });
            return;
        }
        setPendingPinCoords(null);
        setMovingPinTarget(null);
        setPendingCreateFormDraft(null);
    }, [editingPickTarget]);

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
                handleCancelPinPlacement();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isPinPlacementMode, handleCancelPinPlacement]);

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
                        onSelectWikiPin={(slug) => {
                            setPinContextMenu(null);
                            setActiveWikiModal({slug, mode: "read"});
                        }}
                        onPinContextMenu={(page, position) => {
                            setPinContextMenu({page, position});
                        }}
                    />
                    {pendingPinCoords && (
                        <WikiPinPlacementOverlay
                            mode={movingPinTarget || editingPickTarget ? "move" : "create"}
                            targetTitle={
                                movingPinTarget?.title ??
                                (editingPickTarget
                                    ? editingPickTarget.draft.title || editingPickTarget.slug
                                    : undefined)
                            }
                            pinColor={movingPinTarget?.pinColor ?? editingPickTarget?.draft.pinColor}
                            isSubmitting={isUpdatingPinMeta}
                            coords={pendingPinCoords}
                            onChangeCoords={setPendingPinCoords}
                            onConfirm={() => void handleConfirmPinLocation()}
                            onCancel={handleCancelPinPlacement}
                        />
                    )}
                </MapWrapper>
            </div>

            {pinActionError && (
                <div
                    role="alert"
                    style={{top: "var(--wbus-header-bottom, 5.5rem)"}}
                    className="fixed left-1/2 -translate-x-1/2 z-[140] px-4 py-2 rounded-full bg-rose-600 text-white text-xs font-extrabold shadow-xl flex items-center gap-2 max-w-[calc(100vw-2rem)]"
                >
                    <span className="truncate">{pinActionError}</span>
                    <button
                        type="button"
                        onClick={() => setPinActionError(null)}
                        className="px-1.5 py-0.5 rounded-full bg-white/20 hover:bg-white/30 text-[10px] font-black shrink-0 cursor-pointer"
                    >
                        {UI_TEXT.COMMON.CLOSE}
                    </button>
                </div>
            )}

            <WikiPinContextMenu
                page={pinContextMenu?.page ?? null}
                position={pinContextMenu?.position ?? null}
                isUpdating={isUpdatingPinMeta}
                onClose={() => setPinContextMenu(null)}
                onRead={(slug) => setActiveWikiModal({slug, mode: "read"})}
                onEdit={(slug) => setActiveWikiModal({slug, mode: "edit"})}
                onHistory={(slug) => setActiveWikiModal({slug, mode: "history"})}
                onDiscussion={(slug) => setActiveWikiModal({slug, mode: "discussion"})}
                onMovePin={(page) => handleStartMovePin(page)}
                onChangeColor={(page, color) => void handleChangePinColor(page, color)}
            />

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
                initialEditDraft={activeWikiModal?.draft ?? null}
                onClose={() => setActiveWikiModal(null)}
                onSelectSlug={(nextSlug) => setActiveWikiModal({slug: nextSlug, mode: "read"})}
                onSelectRouteOnMap={handleSelectRouteFromWiki}
                onRequestMovePin={(doc) =>
                    handleStartMovePin({
                        slug: doc.slug,
                        title: doc.title,
                        version: doc.version,
                        pinColor: doc.pinColor,
                        lat: doc.lat,
                        lng: doc.lng,
                    })
                }
                onPickLocationInEditor={handleStartPickLocationInEditor}
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
                initialDraft={createWikiDraft?.draft}
                onClose={() => {
                    setCreateWikiDraft(null);
                    setPendingCreateFormDraft(null);
                }}
                onCreated={handleWikiCreated}
                onRepickLocation={(draft) => {
                    const fallbackLat = draft.lat ?? createWikiDraft?.lat ?? currentCity.lat;
                    const fallbackLng = draft.lng ?? createWikiDraft?.lng ?? currentCity.lng;
                    setPendingCreateFormDraft(draft);
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
