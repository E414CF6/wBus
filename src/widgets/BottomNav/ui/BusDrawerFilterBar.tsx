import React from "react";
import {Search, Star, X} from "lucide-react";
import type {RouteVariation, RouteVariationStop} from "@entities/route/types";
import type {DirectionFilter} from "../hooks/useStopSearchFilter";

interface BusDrawerFilterBarProps {
    effectiveVariations: RouteVariation[];
    currentVariant: RouteVariation | null;
    busesPerVariation: Map<string, number>;
    onSelectVariant: (variantId: string) => void;
    hasDirections: boolean;
    directionFilter: DirectionFilter;
    onDirectionFilterChange: (filter: DirectionFilter) => void;
    favoriteStopsCountInRoute: number;
    stopCount: number;
    stopSearchQuery: string;
    onSearchQueryChange: (q: string) => void;
    turningStop?: RouteVariationStop | null;
    metaThemeMainColor?: string;
    metaThemeBadgeBg?: string;
    metaThemeBg?: string;
    metaThemeText?: string;
    metaThemeBorder?: string;
}

export const BusDrawerFilterBar: React.FC<BusDrawerFilterBarProps> = ({
                                                                          effectiveVariations,
                                                                          currentVariant,
                                                                          busesPerVariation,
                                                                          onSelectVariant,
                                                                          hasDirections,
                                                                          directionFilter,
                                                                          onDirectionFilterChange,
                                                                          favoriteStopsCountInRoute,
                                                                          stopCount,
                                                                          stopSearchQuery,
                                                                          onSearchQueryChange,
                                                                          turningStop,
                                                                          metaThemeMainColor: _metaThemeMainColor = "#2563eb",
                                                                          metaThemeBadgeBg = "bg-blue-500/15 dark:bg-blue-500/25",
                                                                          metaThemeBg = "bg-blue-600",
                                                                          metaThemeText = "text-blue-700 dark:text-blue-300",
                                                                          metaThemeBorder = "border-blue-500/30",
                                                                      }) => {
    return (
        <>
            {/* 1. Variation Selector (if route has multiple variations) */}
            {effectiveVariations.length > 1 && (
                <div
                    className="flex items-center gap-1.5 px-4 pb-2 text-xs shrink-0 overflow-x-auto custom-scrollbar-hidden"
                    role="tablist"
                    aria-label="노선 종류 선택"
                >
                    <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500 shrink-0 mr-0.5">
                        노선
                    </span>
                    {effectiveVariations.map((variant) => {
                        const isSelectedVariant = variant.routeId === currentVariant?.routeId;
                        const busCountOnVariant = busesPerVariation.get(variant.routeId) ?? 0;

                        return (
                            <button
                                key={variant.routeId}
                                type="button"
                                role="tab"
                                aria-selected={isSelectedVariant}
                                onClick={() => {
                                    onSelectVariant(variant.routeId);
                                    onDirectionFilterChange("all");
                                }}
                                className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                                    isSelectedVariant
                                        ? `${metaThemeBadgeBg} ${metaThemeText} border ${metaThemeBorder}`
                                        : "bg-slate-100/90 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-transparent"
                                }`}
                            >
                                <span>{variant.label}</span>
                                {busCountOnVariant > 0 && (
                                    <span
                                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-black leading-none ${
                                            isSelectedVariant
                                                ? `${metaThemeBg} text-white`
                                                : "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300"
                                        }`}
                                    >
                                        {busCountOnVariant}대
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* 2. Direction Filter & Stop Quick Search Bar */}
            {(hasDirections || favoriteStopsCountInRoute > 0 || stopCount > 5) && (
                <div className="flex flex-col gap-2 px-4 pb-2.5 shrink-0">
                    {(hasDirections || favoriteStopsCountInRoute > 0) && (
                        <div className="flex items-center gap-1.5 text-xs overflow-x-auto custom-scrollbar-hidden">
                            <button
                                type="button"
                                onClick={() => onDirectionFilterChange("all")}
                                className={`px-2.5 py-1 rounded-full font-bold transition cursor-pointer whitespace-nowrap ${
                                    directionFilter === "all"
                                        ? `${metaThemeBadgeBg} ${metaThemeText} border ${metaThemeBorder}`
                                        : "bg-slate-100/90 dark:bg-white/[0.06] border border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                전체
                            </button>
                            {hasDirections && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => onDirectionFilterChange("up")}
                                        className={`px-2.5 py-1 rounded-full font-bold transition cursor-pointer whitespace-nowrap ${
                                            directionFilter === "up"
                                                ? `${metaThemeBadgeBg} ${metaThemeText} border ${metaThemeBorder}`
                                                : "bg-slate-100/90 dark:bg-white/[0.06] border border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                                        }`}
                                    >
                                        {turningStop ? `${turningStop.nodenm} 방면` : "기점 방면"}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onDirectionFilterChange("down")}
                                        className={`px-2.5 py-1 rounded-full font-bold transition cursor-pointer whitespace-nowrap ${
                                            directionFilter === "down"
                                                ? `${metaThemeBadgeBg} ${metaThemeText} border ${metaThemeBorder}`
                                                : "bg-slate-100/90 dark:bg-white/[0.06] border border-transparent text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                                        }`}
                                    >
                                        {turningStop ? `${turningStop.nodenm} 이후` : "종점 방면"}
                                    </button>
                                </>
                            )}
                            {favoriteStopsCountInRoute > 0 && (
                                <button
                                    type="button"
                                    onClick={() => onDirectionFilterChange("fav")}
                                    className={`px-2.5 py-1 rounded-full font-bold transition cursor-pointer whitespace-nowrap flex items-center gap-1 ${
                                        directionFilter === "fav"
                                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                                            : "bg-slate-100/90 dark:bg-white/[0.06] border border-transparent text-slate-600 dark:text-slate-300 hover:text-amber-600 dark:hover:text-amber-400"
                                    }`}
                                >
                                    <Star className="w-3 h-3 fill-amber-400 text-amber-500"/>
                                    <span>즐겨찾기 ({favoriteStopsCountInRoute})</span>
                                </button>
                            )}
                        </div>
                    )}

                    {stopCount > 5 && (
                        <div className="relative flex items-center">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none"/>
                            <input
                                id="bus-drawer-stop-search"
                                name="bus-drawer-stop-search"
                                type="text"
                                value={stopSearchQuery}
                                onChange={(e) => onSearchQueryChange(e.target.value)}
                                placeholder="정류장 이름 또는 번호 검색..."
                                aria-label="정류장 검색"
                                className="w-full pl-8.5 pr-8 py-1.5 rounded-xl bg-slate-100/85 dark:bg-white/[0.06] border border-transparent focus:border-blue-500/40 focus:bg-white dark:focus:bg-white/10 text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition"
                            />
                            {stopSearchQuery && (
                                <button
                                    type="button"
                                    onClick={() => onSearchQueryChange("")}
                                    className="absolute right-2 p-0.5 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                                    aria-label="검색어 지우기"
                                >
                                    <X className="w-3.5 h-3.5"/>
                                </button>
                            )}
                        </div>
                    )}
                </div>
            )}
        </>
    );
};
