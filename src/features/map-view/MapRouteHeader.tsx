"use client";

import React, {useCallback, useMemo, useState} from "react";
import {Bus, ChevronDown, GraduationCap} from "lucide-react";
import {getRouteMeta} from "@entities/route/routeMetadata";
import {RouteSelectModal} from "@features/map-view/RouteSelectModal";
import type {BusItem} from "@entities/bus/types";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

interface MapRouteHeaderProps {
    selectedRoute: string;
    onSelectRoute: (route: string) => void;
    runningBuses?: BusItem[];
    allRoutes?: string[];
}

const DEFAULT_QUICK_ROUTES = ["30", "34", "34-1"];

export const MapRouteHeader: React.FC<MapRouteHeaderProps> = ({
                                                                  selectedRoute,
                                                                  onSelectRoute,
                                                                  runningBuses = [],
                                                                  allRoutes = [],
                                                              }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Current route metadata
    const meta = useMemo(() => getRouteMeta(selectedRoute), [selectedRoute]);
    const runningCount = runningBuses.length;

    // Load recent & bookmarked routes for quick switch bar
    const quickRoutes = useMemo(() => {
        const set = new Set<string>(DEFAULT_QUICK_ROUTES);
        try {
            const savedBookmarks = localStorage.getItem("wonju_bus_bookmarks");
            if (savedBookmarks) {
                const bms: string[] = JSON.parse(savedBookmarks);
                bms.slice(0, 4).forEach((r) => set.add(r));
            }
            const savedRecent = localStorage.getItem("wbus_recent_map_routes");
            if (savedRecent) {
                const recents: string[] = JSON.parse(savedRecent);
                recents.slice(0, 3).forEach((r) => set.add(r));
            }
        } catch {
            // Ignore
        }

        // Filter against existing allRoutes if available
        if (allRoutes.length > 0) {
            return Array.from(set).filter((r) => allRoutes.includes(r));
        }
        return Array.from(set);
    }, [allRoutes, selectedRoute]);

    const handleSelectFromModal = useCallback(
        (route: string) => {
            onSelectRoute(route);
            setIsModalOpen(false);
        },
        [onSelectRoute]
    );

    return (
        <>
            {/* Embedded Route Selection Modal */}
            <RouteSelectModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                allRoutes={allRoutes}
                selectedRoute={selectedRoute}
                onSelectRoute={handleSelectFromModal}
            />

            <header
                className="absolute top-3 left-1/2 -translate-x-1/2 z-30 pointer-events-auto flex flex-col items-center gap-1.5 max-w-[95vw] w-full sm:w-auto animate-fadeIn select-none">
                {/* 1. Main Route Overview Glass Card */}
                <div
                    className="flex items-center gap-2 p-1.5 pr-2.5 sm:p-2 sm:pr-3 bg-white/92 dark:bg-[#111218]/92 backdrop-blur-2xl border border-black/10 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.14)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.6)] rounded-full transition-all duration-300 max-w-full">
                    {/* Route Selector Button (Triggers Modal) */}
                    <button
                        type="button"
                        onClick={() => setIsModalOpen(true)}
                        className={`flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-full font-black text-xs sm:text-sm tracking-tight transition-all duration-200 cursor-pointer select-none active:scale-95 shadow-sm ${
                            meta.isYonsei
                                ? "bg-[#003876] text-white shadow-[#003876]/30"
                                : "bg-blue-600 text-white shadow-blue-600/30"
                        }`}
                        title="다른 노선 선택하기 (검색/목록)"
                        aria-label="노선 선택 모달 열기"
                    >
                        <Bus className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0"/>
                        <span className="whitespace-nowrap font-extrabold">{selectedRoute}번</span>
                        <ChevronDown className="w-3.5 h-3.5 opacity-80 shrink-0"/>
                    </button>

                    {/* Route Direction & Status Indicator */}
                    <div
                        onClick={() => setIsModalOpen(true)}
                        className="flex items-center gap-2 px-1 cursor-pointer overflow-hidden max-w-[45vw] sm:max-w-[320px]"
                        title={`${meta.origin} ↔ ${meta.destination} (클릭하여 노선 변경)`}
                    >
                        <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-1.5 truncate">
                                <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                                    {meta.origin} ↔ {meta.destination}
                                </span>
                                {meta.isYonsei && (
                                    <span
                                        className="hidden xs:inline-flex px-1.5 py-0.2 rounded-full text-[9px] font-black bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 shrink-0">
                                        연세대
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Running Bus Status Pill */}
                    <div
                        className="flex items-center gap-1.5 pl-1.5 border-l border-black/10 dark:border-white/10 shrink-0">
                        <div
                            className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/10 dark:bg-emerald-400/15 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-extrabold whitespace-nowrap">
                            <span className="relative flex h-2 w-2">
                                {runningCount > 0 && (
                                    <span
                                        className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"/>
                                )}
                                <span
                                    className={`relative inline-flex rounded-full h-2 w-2 ${
                                        runningCount > 0 ? "bg-emerald-500" : "bg-slate-400"
                                    }`}
                                />
                            </span>
                            <span>{runningCount > 0 ? `${runningCount}대 운행` : "대기 중"}</span>
                        </div>
                    </div>
                </div>

                {/* 2. Fast Route Switcher Bar (Horizontal Swipeable Quick Pills) */}
                <div
                    className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar-hidden max-w-full px-1 py-0.5">
                    {quickRoutes.map((route) => {
                        const isCurrent = route === selectedRoute;
                        const isYonsei = DEFAULT_QUICK_ROUTES.includes(route);

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
                </div>
            </header>
        </>
    );
};
