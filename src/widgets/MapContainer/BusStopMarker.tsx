"use client";

import {useBusStop, useFavoriteStops, useNearbyStops} from "@entities/station/hooks";
import type {BusStop} from "@entities/station/types";

import {MAP_SETTINGS} from "@shared/config/env";
import {UI_TEXT} from "@shared/config/locale";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {useCityContext} from "@entities/city";

import {BusStopPopup} from "@entities/station";
import {useRoutePolylineData} from "@features/live-tracking";
import {getRouteMeta} from "@entities/route/routeMetadata";
import {buildSegmentedRouteGeoJson, SHARED_BLUE_COLOR} from "@entities/route/polylineService";
import type {Feature} from "geojson";

import {BusFront, Info, MapPin, MapPinned, Star, X} from "lucide-react";
import {memo, useCallback, useEffect, useMemo, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {Marker, Popup} from "react-map-gl/maplibre";

type BusStopMarkerItemProps = {
    stop: BusStop;
    cityCode: string;
    currentRouteName: string;
    isRouteStop?: boolean;
    isFavorite?: boolean;
    onToggleFavorite?: (stop: BusStop) => void;
    onRouteChange?: (routeName: string) => void;
    showLabel?: boolean;
    color?: string;
    initialOpen?: boolean;
    onClearInitialOpen?: () => void;
};

function getDistanceToSegmentMeters(
    point: [number, number],
    segA: [number, number],
    segB: [number, number]
): number {
    const [pLat, pLng] = point;
    const [aLat, aLng] = segA;
    const [bLat, bLng] = segB;

    const cosLat = Math.cos((pLat * Math.PI) / 180);
    const dLat = (bLat - aLat) * 111000;
    const dLng = (bLng - aLng) * 111000 * cosLat;
    const lenSq = dLat * dLat + dLng * dLng;

    if (lenSq === 0) {
        const dy = (pLat - aLat) * 111000;
        const dx = (pLng - aLng) * 111000 * cosLat;
        return Math.sqrt(dx * dx + dy * dy);
    }

    const apLat = (pLat - aLat) * 111000;
    const apLng = (pLng - aLng) * 111000 * cosLat;
    const t = Math.max(0, Math.min(1, (apLat * dLat + apLng * dLng) / lenSq));

    const projLat = aLat + t * (bLat - aLat);
    const projLng = aLng + t * (bLng - aLng);

    const dy = (pLat - projLat) * 111000;
    const dx = (pLng - projLng) * 111000 * cosLat;
    return Math.sqrt(dx * dx + dy * dy);
}

function findNearestFeatureColor(
    stopLat: number,
    stopLng: number,
    features: Feature[],
    fallbackColor: string = SHARED_BLUE_COLOR
): string {
    let minDistance = Infinity;
    let matchedColor = fallbackColor;

    for (const feat of features) {
        if (feat.geometry.type !== "LineString") continue;
        const color = feat.properties?.color;
        if (!color) continue;

        const coords = feat.geometry.coordinates as [number, number][];
        for (let i = 0; i < coords.length - 1; i++) {
            const segA: [number, number] = [coords[i][1], coords[i][0]];
            const segB: [number, number] = [coords[i + 1][1], coords[i + 1][0]];
            const dist = getDistanceToSegmentMeters([stopLat, stopLng], segA, segB);
            if (dist < minDistance) {
                minDistance = dist;
                matchedColor = color;
            }
        }
    }

    return matchedColor;
}

const BusStopMarkerItem = memo(({
                                    stop,
                                    cityCode,
                                    currentRouteName,
                                    isRouteStop = true,
                                    isFavorite = false,
                                    onToggleFavorite,
                                    onRouteChange,
                                    showLabel = true,
                                    color = "#059669",
                                    initialOpen = false,
                                    onClearInitialOpen,
                                }: BusStopMarkerItemProps) => {
    const [isPopupOpen, setIsPopupOpen] = useState(() => {
        if (typeof window !== "undefined" && window.innerWidth >= 768) {
            return false;
        }
        return initialOpen;
    });

    const [prevInitialOpen, setPrevInitialOpen] = useState(initialOpen);
    if (initialOpen !== prevInitialOpen) {
        setPrevInitialOpen(initialOpen);
        if (initialOpen) {
            const isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;
            if (isDesktop) {
                window.dispatchEvent(new CustomEvent("wbus:focus-stop", {detail: stop}));
                window.dispatchEvent(new CustomEvent("wbus:open-bus-list"));
            } else {
                setIsPopupOpen(true);
            }
        }
    }

    const handleMarkerClick = useCallback((e: { originalEvent?: Event }) => {
        if (e.originalEvent) {
            e.originalEvent.stopPropagation();
        }
        const isDesktop = typeof window !== "undefined" && window.innerWidth >= 768;
        if (isDesktop) {
            // On desktop, dispatch stop to open split view in left floating window
            window.dispatchEvent(new CustomEvent("wbus:focus-stop", {detail: stop}));
            window.dispatchEvent(new CustomEvent("wbus:open-bus-list"));
            return;
        }

        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("wbus:close-stop-popup"));
            window.dispatchEvent(new CustomEvent("wbus:close-bus-list"));
            window.dispatchEvent(new CustomEvent("wbus:close-timetable"));
        }
        setIsPopupOpen(true);
    }, [stop]);

    const handlePopupClose = useCallback(() => {
        setIsPopupOpen(false);
        onClearInitialOpen?.();
    }, [onClearInitialOpen]);

    // Close when other popups or bus list requests closing
    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleClosePopups = () => {
            setIsPopupOpen(false);
            onClearInitialOpen?.();
        };
        window.addEventListener("wbus:close-popups", handleClosePopups);
        window.addEventListener("wbus:close-stop-popup", handleClosePopups);
        return () => {
            window.removeEventListener("wbus:close-popups", handleClosePopups);
            window.removeEventListener("wbus:close-stop-popup", handleClosePopups);
        };
    }, [onClearInitialOpen]);

    // Close on Escape key
    useEffect(() => {
        if (!isPopupOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                handlePopupClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isPopupOpen, handlePopupClose]);

    const handleSelectRouteFromPopup = useCallback(
        (nextRoute: string) => {
            setIsPopupOpen(false);
            onClearInitialOpen?.();
            onRouteChange?.(nextRoute);
        },
        [onRouteChange, onClearInitialOpen]
    );

    const borderColor = isFavorite ? "#f59e0b" : isRouteStop ? color : "#64748b";

    return (
        <>
            <Marker
                longitude={stop.gpslong}
                latitude={stop.gpslati}
                onClick={handleMarkerClick}
                anchor="center"
                style={{pointerEvents: "auto", cursor: "pointer", zIndex: isFavorite ? 22 : isRouteStop ? 18 : 12}}
            >
                {/* Bus Stop Marker Icon & Name Label */}
                <div className="relative flex items-center select-none group">
                    {/* Bus Stop Marker Icon with Dynamic Polyline Color or Favorite Highlight */}
                    {isRouteStop ? (
                        <div
                            title={`${stop.nodenm} (현재 노선 정류장)`}
                            className={`relative flex items-center justify-center w-6 h-6 rounded-lg text-white shadow-md border-2 group-hover:scale-110 transition-transform cursor-pointer shrink-0 z-10 ${
                                isFavorite ? "border-amber-300 ring-2 ring-amber-400/60" : "border-white/90"
                            }`}
                            style={{backgroundColor: color}}
                        >
                            <BusFront className="w-3.5 h-3.5 fill-current"/>
                            {isFavorite && (
                                <span className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow-xs border border-white">
                                    <Star className="w-2 h-2 fill-current"/>
                                </span>
                            )}
                        </div>
                    ) : isFavorite ? (
                        <div
                            title={`${stop.nodenm} (즐겨찾는 정류장)`}
                            className="relative flex items-center justify-center w-6 h-6 rounded-lg bg-amber-500 text-white shadow-md border-2 border-white group-hover:scale-110 transition-transform cursor-pointer shrink-0 z-10 ring-2 ring-amber-400/50"
                        >
                            <Star className="w-3.5 h-3.5 fill-current"/>
                        </div>
                    ) : (
                        <div
                            title={`${stop.nodenm} (주변 정류장 · 클릭하여 도착정보 확인)`}
                            className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-700/90 dark:bg-slate-600/90 text-white shadow-sm border-[1.5px] border-white/85 opacity-85 group-hover:opacity-100 group-hover:scale-125 group-hover:bg-blue-600 transition-all cursor-pointer shrink-0 z-10"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-white"/>
                        </div>
                    )}

                    {/* Bus Stop Name Label Badge with Matching Border & Accent Color */}
                    {(showLabel || isFavorite) && (
                        <div
                            className="absolute left-full ml-1.5 px-2 py-0.5 rounded-md bg-[#18191c]/95 shadow-md backdrop-blur-md pointer-events-auto whitespace-nowrap group-hover:scale-105 transition-all z-20 flex items-center gap-1"
                            style={{
                                border: `1.2px solid ${borderColor}`,
                            }}
                        >
                            {isFavorite && <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0"/>}
                            <span
                                className="text-white font-bold text-[11px] sm:text-[12px] tracking-tight leading-none">
                                {stop.nodenm}
                            </span>
                        </div>
                    )}
                </div>
            </Marker>

            {typeof document !== "undefined" && isPopupOpen &&
                createPortal(
                    <div
                        className="fixed inset-0 z-[105] bg-black/25 dark:bg-black/50 backdrop-blur-[1px] transition-opacity animate-fadeIn sm:hidden"
                        onClick={handlePopupClose}
                        aria-hidden="true"
                    />,
                    document.body
                )
            }

            {isPopupOpen && (
                <Popup
                    longitude={stop.gpslong}
                    latitude={stop.gpslati}
                    closeButton={false}
                    closeOnClick={true}
                    onClose={handlePopupClose}
                    className="custom-bus-stop-popup"
                    maxWidth="none"
                    offset={[0, -10]}
                    style={{zIndex: 110}}
                >
                    <div
                        className="flex flex-col bg-white dark:bg-[#11131a] sm:bg-white/96 sm:dark:bg-[#11131a]/96 backdrop-blur-3xl overflow-hidden rounded-[28px] shadow-[0_16px_48px_rgba(0,0,0,0.25)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.65)] border border-black/10 dark:border-white/12 w-full sm:w-96 max-h-[70vh] sm:max-h-[600px] animate-fadeIn select-none">
                        {/* Mobile Drawer Handle Indicator */}
                        <div className="pt-2 pb-0.5 flex justify-center sm:hidden">
                            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700"/>
                        </div>

                        {/* Header Section */}
                        <div
                            className="relative overflow-hidden bg-transparent px-5 py-4 text-black dark:text-white border-b border-black/5 dark:border-white/5">
                            <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none">
                                <BusFront size={100} strokeWidth={1}/>
                            </div>

                            <div className="relative z-10 flex flex-col gap-2.5">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-start gap-3 min-w-0">
                                        <div
                                            className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                                            style={{
                                                backgroundColor: isRouteStop ? color : isFavorite ? "#f59e0b" : "#475569"
                                            }}
                                        >
                                            {isRouteStop ? (
                                                <MapPinned size={18} strokeWidth={2.5}/>
                                            ) : (
                                                <MapPin size={18} strokeWidth={2.5}/>
                                            )}
                                        </div>
                                        <div className="flex flex-col overflow-hidden">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <h3 className="truncate text-base sm:text-lg font-extrabold leading-tight tracking-tight text-slate-900 dark:text-white">
                                                    {stop.nodenm}
                                                </h3>
                                                <span
                                                    className="px-1.5 py-0.2 rounded-md text-[9px] font-black text-white"
                                                    style={{
                                                        backgroundColor: isRouteStop ? color : "#64748b"
                                                    }}
                                                >
                                                    {isRouteStop ? "현재 노선" : "주변 정류장"}
                                                </span>
                                            </div>
                                            <div
                                                className="flex items-center gap-1.5 mt-1 text-gray-500 dark:text-gray-400">
                                                <span className="text-[10px] font-bold uppercase tracking-widest">
                                                    {UI_TEXT.STOP_POPUP.STATION_ID_LABEL}
                                                </span>
                                                <span className="text-[11px] font-mono font-semibold">
                                                    {stop.nodeno || UI_TEXT.STOP_POPUP.STATION_ID_FALLBACK}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                        {onToggleFavorite && (
                                            <button
                                                type="button"
                                                onClick={() => onToggleFavorite(stop)}
                                                className={`p-1.5 rounded-full border transition cursor-pointer active:scale-90 ${
                                                    isFavorite
                                                        ? "bg-amber-500/15 border-amber-500/40 text-amber-500"
                                                        : "bg-slate-100 dark:bg-white/10 border-transparent text-slate-400 hover:text-amber-500"
                                                }`}
                                                title={isFavorite ? "즐겨찾는 정류장 해제" : "즐겨찾는 정류장 등록"}
                                                aria-label={isFavorite ? "즐겨찾는 정류장 해제" : "즐겨찾는 정류장 등록"}
                                            >
                                                <Star className={`w-3.5 h-3.5 ${isFavorite ? "fill-amber-400" : ""}`}/>
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handlePopupClose}
                                            className="p-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/15 transition cursor-pointer active:scale-90"
                                            title="팝업 닫기"
                                            aria-label="정류장 팝업 닫기"
                                        >
                                            <X className="w-3.5 h-3.5"/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Body Section: Real-time Bus Arrivals at this Stop */}
                        <div className="relative min-h-30 bg-transparent">
                            <BusStopPopup
                                stopId={stop.nodeid}
                                cityCode={cityCode}
                                currentRouteName={currentRouteName}
                                onRouteChange={handleSelectRouteFromPopup}
                            />
                        </div>

                        {/* Footer Section */}
                        <div
                            className="flex items-center justify-center border-t border-black/5 dark:border-white/5 bg-gray-50/50 dark:bg-white/5 py-2.5 px-4">
                            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-400">
                                <Info size={14}/>
                                <span>{UI_TEXT.BUS_ITEM.CLICK_ROUTE_FOR_INFO}</span>
                            </div>
                        </div>
                    </div>
                </Popup>
            )}
        </>
    );
});

BusStopMarkerItem.displayName = "BusStopMarkerItem";

export default ({
                    routeName,
                    onRouteChange,
                    cityCode,
                    showNearbyStops = true,
                    focusedStopId = null,
                    onClearFocusedStop,
                }: {
    routeName: string;
    onRouteChange?: (routeName: string) => void;
    cityCode?: string;
    showNearbyStops?: boolean;
    focusedStopId?: string | null;
    onClearFocusedStop?: () => void;
}) => {
    const {currentCity} = useCityContext();
    const effectiveCityCode = cityCode || currentCity?.code || "32020";
    const routeStops = useBusStop(routeName, effectiveCityCode);
    const {favoriteStops, isFavoriteStop, toggleFavoriteStop} = useFavoriteStops(effectiveCityCode);

    const {map} = useAppMapContext();
    const [zoom, setZoom] = useState(map?.getZoom() ?? MAP_SETTINGS.ZOOM.DEFAULT);
    const [bounds, setBounds] = useState(map?.getBounds() ?? null);
    const [centerCoords, setCenterCoords] = useState<{ lat: number; lng: number } | null>(() => {
        const c = map?.getCenter();
        return c ? {lat: c.lat, lng: c.lng} : null;
    });
    const rafRef = useRef<number | null>(null);

    // Fetch spatial nearby stops when zoomed in >= 14.3 and showNearbyStops is enabled
    const shouldFetchNearby = Boolean(showNearbyStops && zoom >= 14.3 && centerCoords);
    const {nearbyStops} = useNearbyStops(
        centerCoords?.lat ?? null,
        centerCoords?.lng ?? null,
        shouldFetchNearby,
        35
    );

    // Retrieve polyline data to synchronize stop marker & label colors with route segments
    const {routeInfo, polylineMap, activeRouteId} = useRoutePolylineData(routeName, true, effectiveCityCode);
    const rawRouteIds = useMemo(() => routeInfo?.vehicleRouteIds ?? [], [routeInfo?.vehicleRouteIds]);
    const routeIds = useMemo(() => {
        if (effectiveCityCode === "32020") {
            return rawRouteIds.filter((id) => !id.startsWith("WJB258"));
        }
        if (effectiveCityCode === "32320") {
            return rawRouteIds.filter((id) => id.startsWith("WJB258"));
        }
        return rawRouteIds;
    }, [rawRouteIds, effectiveCityCode]);
    const routeMainColor = useMemo(
        () => getRouteMeta(routeName, effectiveCityCode).colorTheme.main,
        [routeName, effectiveCityCode]
    );

    const validRouteIds = useMemo(() => {
        const available = routeIds.filter((id) => {
            if (effectiveCityCode === "32020" && id.startsWith("WJB258")) return false;
            if (effectiveCityCode === "32320" && !id.startsWith("WJB258")) return false;
            const data = polylineMap.get(id);
            return data && (data.upPolyline.length > 0 || data.downPolyline.length > 0);
        });
        if (available.length > 0) return available;
        if (activeRouteId && polylineMap.has(activeRouteId)) {
            if (effectiveCityCode === "32020" && activeRouteId.startsWith("WJB258")) return [];
            if (effectiveCityCode === "32320" && !activeRouteId.startsWith("WJB258")) return [];
            const data = polylineMap.get(activeRouteId);
            if (data && (data.upPolyline.length > 0 || data.downPolyline.length > 0)) {
                return [activeRouteId];
            }
        }
        return routeIds.slice(0, 1);
    }, [routeIds, polylineMap, activeRouteId, effectiveCityCode]);

    const activeGeoJson = useMemo(() => {
        return buildSegmentedRouteGeoJson(validRouteIds, polylineMap, routeMainColor);
    }, [validRouteIds, polylineMap, routeMainColor]);

    // Map each stop ID to its corresponding polyline segment color
    const stopColorMap = useMemo(() => {
        const colorMap = new Map<string, string>();
        const features = activeGeoJson?.features || [];
        if (features.length === 0) return colorMap;

        for (const stop of routeStops) {
            const color = findNearestFeatureColor(stop.gpslati, stop.gpslong, features, routeMainColor);
            const key = `${stop.nodeid}-${stop.updowncd ?? "na"}`;
            colorMap.set(key, color);
            colorMap.set(stop.nodeid, color);
        }

        return colorMap;
    }, [routeStops, activeGeoJson, routeMainColor]);

    useEffect(() => {
        if (!map) return;

        const updateViewState = () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(() => {
                setZoom(map.getZoom());
                setBounds(map.getBounds());
                const c = map.getCenter();
                if (c) {
                    setCenterCoords({lat: c.lat, lng: c.lng});
                }
            });
        };

        // Initialize state
        updateViewState();

        map.on("zoomend", updateViewState);
        map.on("moveend", updateViewState);
        map.on("zoom", updateViewState);
        map.on("move", updateViewState);

        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            map.off("zoomend", updateViewState);
            map.off("moveend", updateViewState);
            map.off("zoom", updateViewState);
            map.off("move", updateViewState);
        };
    }, [map]);

    const [eventFocusedStop, setEventFocusedStop] = useState<BusStop | null>(null);
    const activeFocusedStopId = focusedStopId || eventFocusedStop?.nodeid || null;

    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleFocusStop = (e: Event) => {
            const detail = (e as CustomEvent<BusStop>).detail;
            if (detail && detail.nodeid) {
                setEventFocusedStop(detail);
            }
        };
        window.addEventListener("wbus:focus-stop", handleFocusStop);
        return () => window.removeEventListener("wbus:focus-stop", handleFocusStop);
    }, []);

    const handleClearFocused = useCallback(() => {
        setEventFocusedStop(null);
        onClearFocusedStop?.();
    }, [onClearFocusedStop]);

    // Zoom threshold for displaying stops in viewport (zoom >= 12.2 for route stop icons, >= 14.2 for labels)
    const visibleStops = useMemo(() => {
        if (!bounds || zoom < 12.0) {
            if (eventFocusedStop) {
                return [
                    {
                        ...eventFocusedStop,
                        isRouteStop: true,
                        showLabel: true,
                        color: routeMainColor,
                    },
                ];
            }
            return [];
        }

        const stopsInView: Array<BusStop & { isRouteStop: boolean; showLabel: boolean; color: string }> = [];
        const addedNodeIds = new Set<string>();
        const isRouteLabelVisible = zoom >= 14.2;
        const isNearbyLabelVisible = zoom >= 15.6;

        // 1. Include route stops that are inside current viewport bounds (or currently focused)
        if (zoom >= 12.2) {
            for (const rStop of routeStops) {
                if (bounds.contains([rStop.gpslong, rStop.gpslati]) || rStop.nodeid === activeFocusedStopId) {
                    const stopKey = `${rStop.nodeid}-${rStop.updowncd ?? "na"}`;
                    const color = stopColorMap.get(stopKey) || stopColorMap.get(rStop.nodeid) || routeMainColor;

                    addedNodeIds.add(rStop.nodeid);
                    stopsInView.push({
                        ...rStop,
                        isRouteStop: true,
                        showLabel: isRouteLabelVisible || rStop.nodeid === activeFocusedStopId,
                        color,
                    });
                }
            }
        }

        // 2. Include favorite stops in viewport even if not on active route
        for (const fav of favoriteStops) {
            if (
                !addedNodeIds.has(fav.nodeid) &&
                (bounds.contains([fav.gpslong, fav.gpslati]) || fav.nodeid === activeFocusedStopId)
            ) {
                addedNodeIds.add(fav.nodeid);
                stopsInView.push({
                    nodeid: fav.nodeid,
                    nodenm: fav.nodenm,
                    nodeno: fav.nodeno,
                    gpslati: fav.gpslati,
                    gpslong: fav.gpslong,
                    isRouteStop: false,
                    showLabel: true,
                    color: "#f59e0b",
                });
            }
        }

        // 3. Include spatial nearby stops when zoomed in (>= 14.3)
        if (showNearbyStops && zoom >= 14.3 && nearbyStops.length > 0) {
            for (const nStop of nearbyStops) {
                if (
                    !addedNodeIds.has(nStop.nodeid) &&
                    (bounds.contains([nStop.gpslong, nStop.gpslati]) || nStop.nodeid === activeFocusedStopId)
                ) {
                    addedNodeIds.add(nStop.nodeid);
                    stopsInView.push({
                        nodeid: nStop.nodeid,
                        nodenm: nStop.nodenm,
                        nodeno: nStop.nodeno ?? "",
                        gpslati: nStop.gpslati,
                        gpslong: nStop.gpslong,
                        isRouteStop: false,
                        showLabel: isNearbyLabelVisible || nStop.nodeid === activeFocusedStopId,
                        color: "#64748b",
                    });
                }
            }
        }

        // 4. Ensure eventFocusedStop is always included even while camera is flying to it
        if (eventFocusedStop && !addedNodeIds.has(eventFocusedStop.nodeid)) {
            stopsInView.push({
                ...eventFocusedStop,
                isRouteStop: routeStops.some((s) => s.nodeid === eventFocusedStop.nodeid),
                showLabel: true,
                color: stopColorMap.get(eventFocusedStop.nodeid) || routeMainColor,
            });
        }

        return stopsInView;
    }, [routeStops, favoriteStops, nearbyStops, showNearbyStops, bounds, zoom, stopColorMap, routeMainColor, activeFocusedStopId, eventFocusedStop]);

    return (
        <>
            {visibleStops.map((stop, index) => {
                const key = stop.nodeid ? `${stop.nodeid}-${stop.updowncd ?? "na"}` : `stop-${index}`;
                const isFav = isFavoriteStop(stop.nodeid);
                const isFocused = Boolean(activeFocusedStopId && stop.nodeid === activeFocusedStopId);
                return (
                    <BusStopMarkerItem
                        key={key}
                        stop={stop}
                        cityCode={effectiveCityCode}
                        currentRouteName={routeName}
                        isRouteStop={stop.isRouteStop}
                        isFavorite={isFav}
                        onToggleFavorite={toggleFavoriteStop}
                        showLabel={stop.showLabel}
                        color={stop.color}
                        onRouteChange={onRouteChange}
                        initialOpen={isFocused}
                        onClearInitialOpen={handleClearFocused}
                    />
                );
            })}
        </>
    );
};

