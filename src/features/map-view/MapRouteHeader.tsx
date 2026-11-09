"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from "react";
import {AlertTriangle, CalendarClock, Check, ChevronDown, GitFork, GraduationCap, RefreshCw, Star} from "lucide-react";

import {getRouteMeta} from "@entities/route/routeMetadata";
import {useCityContext, useCityFeatures} from "@entities/city";
import {useFavoriteStops} from "@entities/station/hooks";
import type {FavoriteStop} from "@entities/station/types";
import {getNextDeparture, useSchedule} from "@entities/schedule";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {useRecentRoutes, useRouteBookmarks, useRouteVariations} from "@entities/route";
import {MarqueeText} from "@shared/ui/MarqueeText";

import type {BusItem, LiveConnectionStatus} from "@entities/bus/types";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

interface MapRouteHeaderProps {
    selectedRoute: string;
    onSelectRoute: (route: string) => void;
    runningBuses?: BusItem[];
    allRoutes?: string[];
    connectionStatus?: LiveConnectionStatus;
    hasFetched?: boolean;
    isDegraded?: boolean;
    onReconnect?: () => void;
    selectedVariantId?: string | null;
    onSelectVariant?: (variantId: string | null) => void;
    /** @deprecated Use selectedVariantId / onSelectVariant instead */
    selectedDirection?: "all" | "up" | "down";
    /** @deprecated Use selectedVariantId / onSelectVariant instead */
    onSelectDirection?: (dir: "all" | "up" | "down") => void;
    onOpenScheduleModal?: (docOrSubTab?: string, initialLocation?: "origin" | "dest") => void;
}

const emptySubscribe = () => () => {
};

export const MapRouteHeader: React.FC<MapRouteHeaderProps> = ({
                                                                  selectedRoute,
                                                                  onSelectRoute,
                                                                  runningBuses = [],
                                                                  allRoutes = [],
                                                                  connectionStatus = "connected",
                                                                  hasFetched = true,
                                                                  isDegraded = false,
                                                                  onReconnect,
                                                                  selectedVariantId = null,
                                                                  onSelectVariant,
                                                                  onOpenScheduleModal,
                                                              }) => {
    const {currentCity} = useCityContext();
    const {hasDetailedTimetable, hasUniversityShuttle, defaultQuickRoutes} = useCityFeatures();
    const {map} = useAppMapContext();
    const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const [isVariantMenuOpen, setIsVariantMenuOpen] = useState(false);
    const variantMenuRef = useRef<HTMLDivElement>(null);

    const {favoriteStops} = useFavoriteStops(currentCity.code);
    const {bookmarks} = useRouteBookmarks(currentCity.code);
    const {recentRoutes} = useRecentRoutes(currentCity.code);
    const {routes: scheduleRoutes} = useSchedule(hasDetailedTimetable);

    // Fetch variations for current route (e.g. 30 has basic, via-Sangji, etc.)
    const {variations} = useRouteVariations(selectedRoute, true, currentCity.code);

    // Close dropdown on outside click
    useEffect(() => {
        if (!isVariantMenuOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (variantMenuRef.current && !variantMenuRef.current.contains(e.target as Node)) {
                setIsVariantMenuOpen(false);
            }
        };
        window.addEventListener("mousedown", handleClickOutside);
        return () => window.removeEventListener("mousedown", handleClickOutside);
    }, [isVariantMenuOpen]);

    // Tick every 30s to keep next departure countdown fresh when 0 buses are running
    const [now, setNow] = useState<Date>(() => new Date());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 30000);
        return () => clearInterval(timer);
    }, []);

    // Current route metadata (re-evaluates when dynamic route list loads)
    const meta = useMemo(
        () => getRouteMeta(selectedRoute, currentCity.code),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [selectedRoute, currentCity.code, allRoutes.length]
    );
    const runningCount = runningBuses.length;

    // Running buses count per variation
    const busesPerVariation = useMemo(() => {
        const counts = new Map<string, number>();
        for (const b of runningBuses) {
            if (b.routeid) {
                counts.set(b.routeid, (counts.get(b.routeid) ?? 0) + 1);
            }
        }
        return counts;
    }, [runningBuses]);

    // Effective variations list
    const effectiveVariations = useMemo(() => {
        if (variations && variations.length > 0) {
            return variations;
        }
        return [];
    }, [variations]);

    const hasMultipleVariants = effectiveVariations.length > 1;

    // Currently active variation object (or null for 'all')
    const activeVariant = useMemo(() => {
        if (effectiveVariations.length === 0) return null;
        if (selectedVariantId && selectedVariantId !== "all") {
            const matched = effectiveVariations.find((v) => v.routeId === selectedVariantId);
            if (matched) return matched;
        }
        if (selectedVariantId === "all") return null;
        return effectiveVariations[0];
    }, [effectiveVariations, selectedVariantId]);

    // Current index of variation for indicator (e.g. 1/3)
    const currentVariantIndex = useMemo(() => {
        if (!hasMultipleVariants) return 0;
        if (selectedVariantId === "all") return -1;
        if (!activeVariant) return 0;
        const idx = effectiveVariations.findIndex((v) => v.routeId === activeVariant.routeId);
        return idx >= 0 ? idx : 0;
    }, [hasMultipleVariants, selectedVariantId, activeVariant, effectiveVariations]);

    // Cycle through variants on click
    const handleCycleVariant = useCallback(
        (e: React.MouseEvent) => {
            e.stopPropagation();
            if (!onSelectVariant || effectiveVariations.length <= 1) return;

            // Cycle order: [v0, v1, ..., 'all']
            const options: (string | null)[] = [
                ...effectiveVariations.map((v) => v.routeId),
                "all",
            ];
            const currentVal = selectedVariantId === "all" ? "all" : (activeVariant?.routeId ?? options[0]);
            const currIdx = options.indexOf(currentVal);
            const nextIdx = (currIdx + 1) % options.length;
            onSelectVariant(options[nextIdx]);
        },
        [onSelectVariant, effectiveVariations, selectedVariantId, activeVariant]
    );

    const handleSelectSpecificVariant = useCallback(
        (vId: string | null) => {
            onSelectVariant?.(vId);
            setIsVariantMenuOpen(false);
        },
        [onSelectVariant]
    );

    // Next scheduled departure when no buses are currently running
    const nextScheduleInfo = useMemo(() => {
        if (!hasDetailedTimetable || scheduleRoutes.length === 0) return null;
        const matched = scheduleRoutes.find((r) => r.routeNo === selectedRoute);
        if (!matched || !matched.timetable || matched.timetable.length === 0) return null;
        const {nextOrigin, nextDest, originWaitMins, destWaitMins} = getNextDeparture(matched.timetable, now);
        if (nextOrigin && originWaitMins !== null) {
            return {
                time: nextOrigin.originDepTime,
                waitMins: originWaitMins,
                label: "기점 출발",
            };
        }
        if (nextDest && destWaitMins !== null) {
            return {
                time: nextDest.destDepTime,
                waitMins: destWaitMins,
                label: "종점 출발",
            };
        }
        return null;
    }, [hasDetailedTimetable, scheduleRoutes, selectedRoute, now]);

    // Derive recent & bookmarked routes for quick switch bar (SSR-safe via useSyncExternalStore)
    const quickRoutes = useMemo<string[]>(() => {
        if (!isClient) {
            return defaultQuickRoutes;
        }

        const set = new Set<string>();

        defaultQuickRoutes.forEach((r) => set.add(r));
        bookmarks.slice(0, 4).forEach((r) => set.add(r));
        recentRoutes.slice(0, 3).forEach((r) => set.add(r));

        if (selectedRoute) {
            set.add(selectedRoute);
        }

        // Filter against existing allRoutes if available
        let list = allRoutes.length > 0 ? Array.from(set).filter((r) => allRoutes.includes(r)) : Array.from(set);
        if (list.length === 0 && allRoutes.length > 0) {
            list = allRoutes.slice(0, 4);
        }
        return list;
    }, [isClient, defaultQuickRoutes, bookmarks, recentRoutes, allRoutes, selectedRoute]);

    const handleJumpToFavoriteStop = useCallback(
        (fav: FavoriteStop) => {
            if (map && fav.gpslong && fav.gpslati) {
                map.flyTo({
                    center: [fav.gpslong, fav.gpslati],
                    zoom: Math.max(map.getZoom(), 16.2),
                    duration: 950,
                });
            }
            if (typeof window !== "undefined") {
                window.dispatchEvent(
                    new CustomEvent("wbus:focus-stop", {
                        detail: {
                            nodeid: fav.nodeid,
                            nodenm: fav.nodenm,
                            nodeno: fav.nodeno,
                            gpslati: fav.gpslati,
                            gpslong: fav.gpslong,
                        },
                    })
                );
            }
        },
        [map]
    );

    // Determine status badge appearance & copy
    const statusConfig = useMemo(() => {
        if (!hasFetched || connectionStatus === "connecting") {
            return {
                label: "연결 중...",
                badgeClass: "bg-amber-500/10 dark:bg-amber-400/15 border-amber-500/30 text-amber-700 dark:text-amber-300",
                dotClass: "bg-amber-500",
                pingClass: "bg-amber-400",
                isPulsing: true,
                tooltip: "실시간 위치 API 연결 대기 중",
            };
        }

        if (connectionStatus === "suspended") {
            return {
                label: "대기 상태",
                badgeClass: "bg-slate-500/10 dark:bg-slate-400/15 border-slate-500/20 text-slate-600 dark:text-slate-400",
                dotClass: "bg-slate-400 dark:bg-slate-500",
                pingClass: "",
                isPulsing: false,
                tooltip: "화면 비활성화로 일시 대기 중",
            };
        }

        if (runningCount > 0) {
            if (isDegraded) {
                return {
                    label: `${runningCount}대 운행 (지연)`,
                    badgeClass: "bg-amber-500/10 dark:bg-amber-400/15 border-amber-500/30 text-amber-700 dark:text-amber-300",
                    dotClass: "bg-amber-500",
                    pingClass: "bg-amber-400",
                    isPulsing: true,
                    tooltip: "실시간 버스 운행 중 (일부 데이터 지연)",
                };
            }
            return {
                label: `${runningCount}대 운행 중`,
                badgeClass: "bg-emerald-500/10 dark:bg-emerald-400/15 border-emerald-500/20 text-emerald-700 dark:text-emerald-300",
                dotClass: "bg-emerald-500",
                pingClass: "bg-emerald-400",
                isPulsing: true,
                tooltip: `현재 ${runningCount}대 실시간 운행 중`,
            };
        }

        if (nextScheduleInfo) {
            const waitText = nextScheduleInfo.waitMins <= 0 ? "곧 출발" : `${nextScheduleInfo.waitMins}분 후`;
            return {
                label: `다음 ${nextScheduleInfo.time} (${waitText})`,
                badgeClass: "bg-blue-500/10 dark:bg-blue-400/15 border-blue-500/30 text-blue-700 dark:text-blue-300",
                dotClass: "bg-blue-500",
                pingClass: "",
                isPulsing: false,
                tooltip: `현재 운행 대기 중 · 다음 ${nextScheduleInfo.label}: ${nextScheduleInfo.time} (${waitText})`,
            };
        }

        return {
            label: "운행 종료",
            badgeClass: "bg-slate-500/10 dark:bg-slate-400/10 border-slate-400/20 text-slate-600 dark:text-slate-400",
            dotClass: "bg-slate-400 dark:bg-slate-500",
            pingClass: "",
            isPulsing: false,
            tooltip: "현재 운행 중인 버스가 없습니다 (운행 종료 또는 배차 대기)",
        };
    }, [hasFetched, connectionStatus, runningCount, isDegraded, nextScheduleInfo]);

    // Active variant bus count
    const activeVariantBusCount = activeVariant ? (busesPerVariation.get(activeVariant.routeId) ?? 0) : runningCount;

    return (
        <>
            <header
                className={`absolute top-[calc(env(safe-area-inset-top,0px)+0.75rem)] left-1/2 -translate-x-1/2 lg:left-[calc(50%+210px)] ${
                    isVariantMenuOpen ? "z-[80]" : "z-50"
                } pointer-events-auto flex flex-col items-center gap-1.5 max-w-[95vw] lg:max-w-[calc(100vw-460px)] w-full sm:w-auto animate-fadeIn select-none`}
            >
                {/* 1. Main Route Overview Glass Card */}
                <div
                    ref={variantMenuRef}
                    className={`relative ${
                        isVariantMenuOpen ? "z-30" : "z-20"
                    } flex w-full min-w-0 items-center gap-1 sm:gap-1.5 p-1.5 pr-2.5 sm:p-2 sm:pr-3 bg-white/92 dark:bg-[#11131a]/92 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.14)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.6)] rounded-full transition-all duration-300 max-w-full sm:w-auto`}
                >
                    {/* Route Variation Toggle & Focus Switcher */}
                    <div className={`relative flex min-w-0 flex-1 items-center ${isVariantMenuOpen ? "z-50" : ""}`}>
                        <button
                            type="button"
                            suppressHydrationWarning
                            onClick={hasMultipleVariants ? handleCycleVariant : undefined}
                            className={`flex w-full min-w-0 items-center gap-2 px-2 py-1 sm:px-2.5 sm:py-1 rounded-full transition-all duration-200 cursor-pointer overflow-hidden text-left select-none active:scale-95 ${
                                hasMultipleVariants
                                    ? "hover:bg-blue-50/80 dark:hover:bg-blue-950/30"
                                    : "cursor-default"
                            }`}
                            title={
                                hasMultipleVariants
                                    ? `클릭하여 노선 종류(경유지) 전환 (현재: ${selectedVariantId === "all" ? "전체 경로" : (activeVariant?.label ?? `${meta.origin} - ${meta.destination}`)})`
                                    : `${meta.origin} ↔ ${meta.destination}`
                            }
                            aria-label="노선 종류 및 경유지 전환"
                        >
                            <span
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white ${meta.colorTheme.bg} ${meta.colorTheme.shadow || "shadow-[0_4px_12px_rgba(0,0,0,0.15)]"}`}
                                aria-hidden="true"
                            >
                                <GitFork className="h-4 w-4"/>
                            </span>
                            <div className="flex min-w-0 flex-1 flex-col justify-center">
                                <span
                                    className={`mb-0.5 text-[9px] font-black uppercase tracking-wider ${meta.colorTheme.text}`}>
                                    {selectedRoute}
                                </span>
                                <div className="flex items-center gap-1.5 min-w-0 max-w-full">
                                    {/* Main destination / origin path or variant title (Slowly marquees when overflowing on mobile instead of cutting with ellipsis) */}
                                    <MarqueeText
                                        text={
                                            selectedVariantId === "all"
                                                ? `${meta.origin} ↔ ${meta.destination}`
                                                : (activeVariant?.label ?? `${meta.origin} ↔ ${meta.destination}`)
                                        }
                                        className="text-xs sm:text-sm font-black text-slate-900 dark:text-white"
                                        containerClassName="min-w-0 flex-1"
                                        durationSeconds={14}
                                        fadeEdges
                                    />

                                    {/* Variant Pill Badge */}
                                    {hasMultipleVariants && (
                                        <span
                                            suppressHydrationWarning
                                            className={`px-1.5 py-0.5 rounded-md text-[9px] font-black shrink-0 transition-colors flex items-center gap-0.5 ${
                                                selectedVariantId === "all"
                                                    ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                                    : `${meta.colorTheme.bg} text-white shadow-xs`
                                            }`}
                                        >
                                            <GitFork className="w-2.5 h-2.5 shrink-0"/>
                                            <span>
                                                {selectedVariantId === "all"
                                                    ? "전체"
                                                    : `${currentVariantIndex + 1}/${effectiveVariations.length}`}
                                            </span>
                                            {activeVariantBusCount > 0 && selectedVariantId !== "all" && (
                                                <span
                                                    className="ml-0.5 opacity-90 font-mono">({activeVariantBusCount}대)</span>
                                            )}
                                        </span>
                                    )}

                                    {/* Single variant fallback: route type badge */}
                                    {!hasMultipleVariants && (
                                        <span
                                            suppressHydrationWarning
                                            className={`px-1.5 py-0.5 rounded-md text-[9px] font-black shrink-0 ${meta.colorTheme.badgeBg} ${meta.colorTheme.text}`}
                                        >
                                            {meta.routeType || (meta.genericType === "EXPRESS" ? "급행" : meta.genericType === "BRANCH" ? "지선" : meta.genericType === "VILLAGE" ? "마을" : "간선")}
                                        </span>
                                    )}

                                    {meta.isYonsei && (
                                        <span
                                            className="hidden xs:inline-flex px-1.5 py-0.2 rounded-full text-[9px] font-black bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 shrink-0">
                                            연세대
                                        </span>
                                    )}
                                </div>
                            </div>
                        </button>

                        {/* Dropdown open trigger button for multi-variant routes */}
                        {hasMultipleVariants && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsVariantMenuOpen((prev) => !prev);
                                }}
                                className="p-1 rounded-full text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
                                title="전체 경유지/노선 종류 목록 보기"
                                aria-label="노선 종류 목록 열기"
                            >
                                <ChevronDown
                                    className={`w-3.5 h-3.5 transition-transform ${isVariantMenuOpen ? "rotate-180" : ""}`}/>
                            </button>
                        )}

                        {/* Floating Variant Selector Dropdown Popover */}
                        {hasMultipleVariants && isVariantMenuOpen && (
                            <div
                                className="absolute top-full left-0 mt-2 z-50 w-64 sm:w-72 max-w-[calc(100vw-2rem)] bg-white/95 dark:bg-[#11131a]/95 backdrop-blur-2xl rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.25)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.7)] border border-black/10 dark:border-white/15 p-1.5 space-y-1 animate-scaleUp select-none">
                                <div
                                    className="px-3 py-1.5 border-b border-black/5 dark:border-white/5 flex items-center justify-between text-[11px] font-extrabold text-slate-500 dark:text-slate-400">
                                    <span>노선 종류 및 경유지 선택</span>
                                    <span className="font-mono text-[10px]">총 {effectiveVariations.length}개</span>
                                </div>

                                <div className="max-h-60 overflow-y-auto custom-scrollbar p-0.5 space-y-0.5">
                                    {/* Option: View All Variations combined */}
                                    <button
                                        type="button"
                                        onClick={() => handleSelectSpecificVariant("all")}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer text-left ${
                                            selectedVariantId === "all"
                                                ? `${meta.colorTheme.bg} text-white shadow-xs`
                                                : "text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <GitFork className="w-3.5 h-3.5 shrink-0 opacity-80"/>
                                            <div className="truncate">
                                                <p className="truncate">전체 경로 (모든 경유지)</p>
                                                <p className={`text-[10px] font-semibold truncate ${selectedVariantId === "all" ? "text-white/80" : "text-slate-400"}`}>
                                                    {meta.origin} ↔ {meta.destination}
                                                </p>
                                            </div>
                                        </div>
                                        {selectedVariantId === "all" && <Check className="w-4 h-4 shrink-0 ml-2"/>}
                                    </button>

                                    {/* Individual Variation Options */}
                                    {effectiveVariations.map((variant, idx) => {
                                        const isSelected = selectedVariantId !== "all" && (activeVariant?.routeId === variant.routeId);
                                        const count = busesPerVariation.get(variant.routeId) ?? 0;
                                        const turningStopName = variant.turningStop?.nodenm;

                                        return (
                                            <button
                                                key={variant.routeId}
                                                type="button"
                                                onClick={() => handleSelectSpecificVariant(variant.routeId)}
                                                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer text-left ${
                                                    isSelected
                                                        ? `${meta.colorTheme.bg} text-white shadow-xs`
                                                        : "text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5"
                                                }`}
                                            >
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <span
                                                        className={`w-5 text-center font-mono text-[11px] font-bold shrink-0 ${isSelected ? "text-white/80" : "text-slate-400"}`}>
                                                        {idx + 1}
                                                    </span>
                                                    <div className="truncate">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="truncate">{variant.label}</span>
                                                            {count > 0 && (
                                                                <span
                                                                    className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                                                                        isSelected
                                                                            ? "bg-white/20 text-white"
                                                                            : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                                                    }`}>
                                                                    {count}대 운행
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className={`text-[10px] font-semibold truncate ${isSelected ? "text-white/80" : "text-slate-400"}`}>
                                                            {turningStopName ? `회차: ${turningStopName}` : `${variant.stops.length}개 정류장`}
                                                        </p>
                                                    </div>
                                                </div>
                                                {isSelected && <Check className="w-4 h-4 shrink-0 ml-2"/>}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Detailed Real-Time Status Pill */}
                    <div
                        className="flex items-center gap-1 pl-1.5 border-l border-black/10 dark:border-white/10 shrink-0">
                        <button
                            type="button"
                            onClick={() => {
                                if (runningCount === 0 && onOpenScheduleModal) {
                                    onOpenScheduleModal(`route:${selectedRoute}`);
                                } else {
                                    onReconnect?.();
                                }
                            }}
                            className={`flex max-w-[44vw] shrink-0 items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-extrabold whitespace-nowrap transition-all duration-200 cursor-pointer active:scale-95 sm:max-w-none ${statusConfig.badgeClass}`}
                            title={statusConfig.tooltip}
                        >
                            <span className="relative flex h-2 w-2 shrink-0 items-center justify-center">
                                {statusConfig.isPulsing && (
                                    <span
                                        className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${statusConfig.pingClass}`}
                                    />
                                )}
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${statusConfig.dotClass}`}/>
                            </span>
                            <span>{statusConfig.label}</span>
                            {runningCount === 0 && onOpenScheduleModal && (
                                <CalendarClock className="w-3 h-3 opacity-80 ml-0.5"/>
                            )}
                            {onReconnect && (!hasFetched || connectionStatus === "connecting") && (
                                <RefreshCw className="w-2.5 h-2.5 animate-spin opacity-70 ml-0.5"/>
                            )}
                        </button>
                    </div>
                </div>

                {/* Degraded External API Status Notice Banner */}
                {isDegraded && (
                    <div
                        className="relative z-0 flex items-center gap-1.5 px-3 py-1 bg-amber-500/95 dark:bg-amber-600/95 text-white rounded-full text-[11px] font-extrabold shadow-sm backdrop-blur-md animate-fadeIn"
                        role="status"
                        aria-live="polite"
                    >
                        <AlertTriangle className="w-3 h-3 shrink-0"/>
                        <span>공공데이터 API 응답 지연 중 · 최근 수신된 위치를 표시합니다</span>
                    </div>
                )}

                {/* 2. Fast Route & Favorite Stop Switcher Bar (Horizontal Swipeable Quick Pills) */}
                <div
                    className="relative z-0 flex items-center gap-1.5 overflow-x-auto custom-scrollbar-hidden max-w-full px-1 py-0.5">
                    {quickRoutes.map((route) => {
                        const isCurrent = route === selectedRoute;
                        const isYonsei = hasUniversityShuttle && defaultQuickRoutes.includes(route);

                        return (
                            <button
                                key={`quick-${route}`}
                                type="button"
                                onClick={() => onSelectRoute(route)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-black tracking-tight whitespace-nowrap transition-all duration-200 cursor-pointer select-none active:scale-95 shadow-xs ${
                                    isCurrent
                                        ? isYonsei
                                            ? "bg-[#003876] text-white shadow-sm ring-1 ring-[#003876] scale-[1.03]"
                                            : `${meta.colorTheme.bg} text-white shadow-sm ring-1 ring-current scale-[1.03]`
                                        : "bg-white/85 dark:bg-[#11131a]/85 backdrop-blur-xl hover:bg-white dark:hover:bg-[#181922] text-slate-700 dark:text-slate-300 border border-black/8 dark:border-white/10"
                                }`}
                            >
                                {isYonsei && <GraduationCap className="w-3 h-3"/>}
                                <span>{route}번</span>
                            </button>
                        );
                    })}

                    {/* Favorite Stops Quick Jump Pills */}
                    {isClient && favoriteStops.slice(0, 3).map((fav) => (
                        <button
                            key={`fav-stop-${fav.nodeid}`}
                            type="button"
                            onClick={() => handleJumpToFavoriteStop(fav)}
                            title={`즐겨찾는 정류장: ${fav.nodenm} (클릭하여 이동 및 실시간 도착정보 보기)`}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-tight whitespace-nowrap transition-all duration-200 cursor-pointer select-none active:scale-95 shadow-xs bg-amber-50/95 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/70 text-amber-800 dark:text-amber-300 border border-amber-300/70 dark:border-amber-700/60 backdrop-blur-xl"
                        >
                            <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500 shrink-0"/>
                            <span className="max-w-[96px] truncate">{fav.nodenm}</span>
                        </button>
                    ))}
                </div>
            </header>
        </>
    );
};
