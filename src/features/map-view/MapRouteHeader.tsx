"use client";

import React, {useCallback, useEffect, useMemo, useState, useSyncExternalStore} from "react";
import {AlertTriangle, Bus, CalendarClock, ChevronDown, GraduationCap, RefreshCw, Star} from "lucide-react";

import {getRouteMeta} from "@entities/route/routeMetadata";
import {useCityContext} from "@entities/city";
import {useFavoriteStops} from "@entities/station/hooks";
import type {FavoriteStop} from "@entities/station/types";
import {getNextDeparture, useSchedule} from "@entities/schedule";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {getBookmarkStorageKey, getRecentRoutesStorageKey} from "@shared/config/env";
import {RouteSelectModal} from "./RouteSelectModal";

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
    selectedDirection?: "all" | "up" | "down";
    onSelectDirection?: (dir: "all" | "up" | "down") => void;
    onOpenScheduleModal?: (docOrSubTab?: string) => void;
}

const DEFAULT_QUICK_ROUTES = ["30", "34", "34-1"];
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
                                                                  selectedDirection = "all",
                                                                  onSelectDirection,
                                                                  onOpenScheduleModal,
                                                              }) => {
    const {currentCity} = useCityContext();
    const {map} = useAppMapContext();
    const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const isWonju = currentCity.code === "32020";
    const [isModalOpen, setIsModalOpen] = useState(false);

    const {favoriteStops} = useFavoriteStops(currentCity.code);
    const {routes: scheduleRoutes} = useSchedule(isWonju);

    const handleSelectFromModal = useCallback(
        (route: string) => {
            onSelectRoute(route);
            setIsModalOpen(false);
        },
        [onSelectRoute]
    );

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

    // Next scheduled departure for Wonju routes when no buses are currently running
    const nextScheduleInfo = useMemo(() => {
        if (!isWonju || scheduleRoutes.length === 0) return null;
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
    }, [isWonju, scheduleRoutes, selectedRoute, now]);

    // Derive recent & bookmarked routes for quick switch bar (SSR-safe via useSyncExternalStore)
    const quickRoutes = useMemo<string[]>(() => {
        if (!isClient) {
            return isWonju ? DEFAULT_QUICK_ROUTES : [];
        }

        const set = new Set<string>();
        const bookmarkKey = getBookmarkStorageKey(currentCity.code);
        const recentKey = getRecentRoutesStorageKey(currentCity.code);

        if (isWonju) {
            DEFAULT_QUICK_ROUTES.forEach((r) => set.add(r));
        }
        try {
            const savedBookmarks = localStorage.getItem(bookmarkKey);
            if (savedBookmarks) {
                const bms: string[] = JSON.parse(savedBookmarks);
                bms.slice(0, 4).forEach((r) => set.add(r));
            }
            const savedRecent = localStorage.getItem(recentKey);
            if (savedRecent) {
                const recents: string[] = JSON.parse(savedRecent);
                recents.slice(0, 3).forEach((r) => set.add(r));
            }
        } catch {
            // Ignore
        }

        if (selectedRoute) {
            set.add(selectedRoute);
        }

        // Filter against existing allRoutes if available
        let list = allRoutes.length > 0 ? Array.from(set).filter((r) => allRoutes.includes(r)) : Array.from(set);
        if (list.length === 0 && allRoutes.length > 0) {
            list = allRoutes.slice(0, 4);
        }
        return list;
    }, [isClient, isWonju, allRoutes, currentCity.code, selectedRoute]);

    const handleToggleDirection = useCallback(() => {
        if (!onSelectDirection) return;
        if (selectedDirection === "all") {
            onSelectDirection("up");
        } else if (selectedDirection === "up") {
            onSelectDirection("down");
        } else {
            onSelectDirection("all");
        }
    }, [selectedDirection, onSelectDirection]);

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
        // 1. Still connecting or waiting for initial API response
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

        // 2. Suspended in background
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

        // 3. API responded & Buses are running
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

        // 4. API responded with 0 running buses, but next scheduled departure is available
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

        // 5. API responded and 0 buses running with no upcoming departure
        return {
            label: "운행 종료",
            badgeClass: "bg-slate-500/10 dark:bg-slate-400/10 border-slate-400/20 text-slate-600 dark:text-slate-400",
            dotClass: "bg-slate-400 dark:bg-slate-500",
            pingClass: "",
            isPulsing: false,
            tooltip: "현재 운행 중인 버스가 없습니다 (운행 종료 또는 배차 대기)",
        };
    }, [hasFetched, connectionStatus, runningCount, isDegraded, nextScheduleInfo]);

    return (
        <>
            <RouteSelectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                allRoutes={allRoutes}
                selectedRoute={selectedRoute}
                onSelectRoute={handleSelectFromModal}
            />

            <header
                className="absolute top-[calc(env(safe-area-inset-top,0px)+0.75rem)] left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex flex-col items-center gap-1.5 max-w-[95vw] w-full sm:w-auto animate-fadeIn select-none">
                {/* 1. Main Route Overview Glass Card */}
                <div
                    className="flex items-center gap-1 sm:gap-1.5 p-1.5 pr-2.5 sm:p-2 sm:pr-3 bg-white/92 dark:bg-[#111218]/92 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.14)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.6)] rounded-full transition-all duration-300 max-w-full">
                    {/* Route Selector Button (Far Left, Triggers Modal) */}
                    <button
                        type="button"
                        onClick={() => setIsModalOpen(true)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full font-black text-xs sm:text-sm tracking-tight transition-all duration-200 cursor-pointer select-none active:scale-95 shadow-sm shrink-0 ${meta.colorTheme.bg} text-white ${meta.colorTheme.shadow || ""}`}
                        title="다른 노선 선택하기 (검색/목록)"
                        aria-label="노선 선택 모달 열기"
                    >
                        <Bus className="w-3.5 h-3.5 shrink-0"/>
                        <span suppressHydrationWarning className="whitespace-nowrap font-extrabold">{selectedRoute || "노선"}번</span>
                        <ChevronDown className="w-3.5 h-3.5 opacity-80 shrink-0"/>
                    </button>

                    {/* Route Direction & Focus Switcher */}
                    <button
                        type="button"
                        suppressHydrationWarning
                        onClick={handleToggleDirection}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200 cursor-pointer overflow-hidden max-w-[44vw] sm:max-w-[300px] text-left select-none active:scale-95"
                        title={`경로 표시 방향: ${
                            selectedDirection === "all"
                                ? "양방향 전체"
                                : selectedDirection === "up"
                                    ? `${meta.destination || "종점"} 방면 (상행)`
                                    : `${meta.origin || "기점"} 방면 (하행)`
                        } (클릭하여 상행/하행/전체 전환)`}
                        aria-label="경로 표시 방향 전환"
                    >
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 truncate">
                                <span suppressHydrationWarning className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                                    {selectedDirection === "all" && `${meta.origin} ↔ ${meta.destination}`}
                                    {selectedDirection === "up" && `→ ${meta.destination}`}
                                    {selectedDirection === "down" && `→ ${meta.origin}`}
                                </span>
                                <span
                                    suppressHydrationWarning
                                    className={`px-1.5 py-0.5 rounded-md text-[9px] font-black shrink-0 transition-colors ${
                                        selectedDirection === "all"
                                            ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                            : meta.colorTheme.badgeBg + " " + meta.colorTheme.text
                                    }`}
                                >
                                    {selectedDirection === "all" ? "전체" : selectedDirection === "up" ? "상행" : "하행"}
                                </span>
                                <span
                                    suppressHydrationWarning
                                    className={`px-1.5 py-0.5 rounded-md text-[9px] font-black shrink-0 ${meta.colorTheme.badgeBg} ${meta.colorTheme.text}`}
                                >
                                    {meta.genericType === "EXPRESS" ? "급행" : meta.genericType === "BRANCH" ? "지선" : "간선"}
                                </span>
                                {meta.isYonsei && selectedDirection === "all" && (
                                    <span
                                        className="hidden xs:inline-flex px-1.5 py-0.2 rounded-full text-[9px] font-black bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 shrink-0">
                                        연세대
                                    </span>
                                )}
                            </div>
                        </div>
                    </button>

                    {/* Detailed Real-Time Status Pill */}
                    <div
                        className="flex items-center gap-1 pl-1.5 border-l border-black/10 dark:border-white/10 shrink-0">
                        <button
                            type="button"
                            onClick={() => {
                                if (runningCount === 0 && nextScheduleInfo && onOpenScheduleModal) {
                                    onOpenScheduleModal(`route:${selectedRoute}`);
                                } else {
                                    onReconnect?.();
                                }
                            }}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-extrabold whitespace-nowrap transition-all duration-200 cursor-pointer active:scale-95 ${statusConfig.badgeClass}`}
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
                            {runningCount === 0 && nextScheduleInfo && onOpenScheduleModal && (
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
                        className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/95 dark:bg-amber-600/95 text-white rounded-full text-[11px] font-extrabold shadow-sm backdrop-blur-md animate-fadeIn"
                        role="status"
                        aria-live="polite"
                    >
                        <AlertTriangle className="w-3 h-3 shrink-0"/>
                        <span>공공데이터 API 응답 지연 중 · 최근 수신된 위치를 표시합니다</span>
                    </div>
                )}

                {/* 2. Fast Route & Favorite Stop Switcher Bar (Horizontal Swipeable Quick Pills) */}
                <div
                    className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar-hidden max-w-full px-1 py-0.5">
                    {quickRoutes.map((route) => {
                        const isCurrent = route === selectedRoute;
                        const isYonsei = isWonju && DEFAULT_QUICK_ROUTES.includes(route);

                        return (
                            <button
                                key={`quick-${route}`}
                                type="button"
                                onClick={() => onSelectRoute(route)}
                                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-black tracking-tight whitespace-nowrap transition-all duration-200 cursor-pointer select-none active:scale-95 shadow-xs ${
                                    isCurrent
                                        ? isYonsei
                                            ? "bg-[#003876] text-white shadow-sm ring-1 ring-[#003876] scale-[1.03]"
                                            : "bg-blue-600 text-white shadow-sm ring-1 ring-blue-600 scale-[1.03]"
                                        : "bg-white/85 dark:bg-[#111218]/85 backdrop-blur-xl hover:bg-white dark:hover:bg-[#181922] text-slate-700 dark:text-slate-300 border border-black/8 dark:border-white/10"
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

