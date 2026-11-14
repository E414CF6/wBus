"use client";

import React from "react";
import {Clock, Star} from "lucide-react";
import type {RouteMeta} from "@entities/route";
import {UI_TEXT} from "@shared/config/locale";

interface RouteGridCardProps {
    route: string;
    meta: RouteMeta;
    categoryLabel?: string;
    isSelected: boolean;
    isYonsei: boolean;
    isBookmarked: boolean;
    onSelect: (route: string) => void;
    onToggleBookmark: (e: React.MouseEvent, route: string) => void;
}

export const RouteGridCard: React.FC<RouteGridCardProps> = ({
    route,
    meta,
    categoryLabel,
    isSelected,
    isYonsei,
    isBookmarked,
    onSelect,
    onToggleBookmark,
}) => (
    <div
        className={`cv-auto-route group relative flex items-start justify-between rounded-2xl transition-all duration-200 select-none border ${
            isSelected
                ? `bg-slate-50/90 dark:bg-white/[0.06] ${meta.colorTheme.border} shadow-md ring-2 ${meta.colorTheme.ring || "ring-blue-500/30"}`
                : "bg-black/[0.02] dark:bg-white/[0.03] hover:bg-black/[0.05] dark:hover:bg-white/[0.06] border-black/5 dark:border-white/5 hover:border-black/15 dark:hover:border-white/15"
        }`}
    >
        <button
            type="button"
            onClick={() => onSelect(route)}
            className="flex items-start gap-3 min-w-0 flex-1 p-3.5 sm:p-4 pr-1 text-left cursor-pointer active:scale-[0.98] rounded-l-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
            <div
                className={`flex items-center justify-center min-w-[50px] sm:min-w-[56px] px-2.5 py-1.5 rounded-xl font-black text-sm sm:text-base tracking-tight shrink-0 shadow-xs ${meta.colorTheme.bg} text-white`}
            >
                <span>{UI_TEXT.COMMON.ROUTE_LABEL(route)}</span>
            </div>

            <div className="flex flex-col min-w-0 flex-1 pr-1">
                <div className="flex items-center gap-1.5 flex-wrap mb-1">
                    <span
                        className={`px-1.5 py-0.5 rounded-md text-[9px] font-black ${meta.colorTheme.badgeBg} ${meta.colorTheme.text}`}
                    >
                        {meta.routeType ||
                            categoryLabel ||
                            (meta.genericType === "EXPRESS"
                                ? "급행"
                                : meta.genericType === "BRANCH"
                                    ? "지선"
                                    : meta.genericType === "VILLAGE"
                                        ? "마을"
                                        : "간선")}
                    </span>
                    {isYonsei && (
                        <span className="px-1.5 py-0.5 rounded-md text-[9px] font-black bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700">
                            {UI_TEXT.ROUTE_SELECT.YONSEI_BADGE}
                        </span>
                    )}
                </div>
                <div
                    className="font-extrabold text-xs sm:text-[13px] text-slate-900 dark:text-white leading-snug break-keep line-clamp-2"
                    title={`${meta.origin} ↔ ${meta.destination}`}
                >
                    {meta.origin} <span className="text-slate-400 font-normal">↔</span> {meta.destination}
                </div>
                {meta.description && (
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-1">
                        {meta.description}
                    </p>
                )}
                {(meta.firstTime || meta.lastTime) && (
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400 shrink-0"/>
                        <span>
                            첫차 {meta.firstTime || "--:--"} · 막차 {meta.lastTime || "--:--"}
                        </span>
                    </p>
                )}
            </div>
        </button>

        <div className="flex items-center gap-1.5 shrink-0 pt-3.5 sm:pt-4 pr-3.5 sm:pr-4 pl-1">
            <button
                type="button"
                onClick={(e) => onToggleBookmark(e, route)}
                className={`p-1.5 rounded-full transition-colors cursor-pointer ${
                    isBookmarked
                        ? "text-amber-500 hover:text-amber-600"
                        : "text-slate-300 dark:text-slate-600 hover:text-amber-500 dark:hover:text-amber-400"
                }`}
                title={
                    isBookmarked
                        ? UI_TEXT.ROUTE_SELECT.BOOKMARK_REMOVE_TITLE
                        : UI_TEXT.ROUTE_SELECT.BOOKMARK_ADD_TITLE
                }
                aria-label={
                    isBookmarked
                        ? UI_TEXT.ROUTE_SELECT.BOOKMARK_REMOVE_TITLE
                        : UI_TEXT.ROUTE_SELECT.BOOKMARK_ADD_TITLE
                }
            >
                <Star className={`w-4 h-4 ${isBookmarked ? "fill-amber-500" : ""}`}/>
            </button>
        </div>
    </div>
);
