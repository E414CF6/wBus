"use client";

import React from "react";
import {GraduationCap, Star} from "lucide-react";
import type {FavoriteStop} from "@entities/station/types";
import type {RouteMeta} from "@entities/route/routeMetadata";

interface QuickAccessBarProps {
    quickRoutes: string[];
    selectedRoute: string;
    meta: RouteMeta;
    showYonseiFeatures: boolean;
    hasUniversityShuttle: boolean;
    defaultQuickRoutes: string[];
    isClient: boolean;
    favoriteStops: FavoriteStop[];
    onSelectRoute: (route: string) => void;
    onJumpToFavoriteStop: (fav: FavoriteStop) => void;
}

export const QuickAccessBar: React.FC<QuickAccessBarProps> = ({
    quickRoutes,
    selectedRoute,
    meta,
    showYonseiFeatures,
    hasUniversityShuttle,
    defaultQuickRoutes,
    isClient,
    favoriteStops,
    onSelectRoute,
    onJumpToFavoriteStop,
}) => {
    return (
        <div className="relative z-0 flex justify-center max-w-full w-full px-1">
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar-hidden py-0.5 px-1 max-w-full scroll-smooth touch-pan-x select-none">
                {quickRoutes.map((route) => {
                    const isCurrent = route === selectedRoute;
                    const isYonsei =
                        showYonseiFeatures &&
                        hasUniversityShuttle &&
                        defaultQuickRoutes.includes(route);

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
                        onClick={() => onJumpToFavoriteStop(fav)}
                        title={`즐겨찾는 정류장: ${fav.nodenm} (클릭하여 이동 및 실시간 도착정보 보기)`}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold tracking-tight whitespace-nowrap transition-all duration-200 cursor-pointer select-none active:scale-95 shadow-xs bg-amber-50/95 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/70 text-amber-800 dark:text-amber-300 border border-amber-300/70 dark:border-amber-700/60 backdrop-blur-xl"
                    >
                        <Star className="w-2.5 h-2.5 fill-amber-500 text-amber-500 shrink-0"/>
                        <span className="max-w-[96px] truncate">{fav.nodenm}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};
