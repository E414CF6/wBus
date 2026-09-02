"use client";

import {UI_TEXT} from "@shared/config/locale";
import {MapPin, X} from "lucide-react";
import React from "react";
import {getRouteBadgeGradient} from "../../utils/footnoteUtils";

interface RouteDetailHeaderProps {
    targetRouteNo: string;
    locationLabel: string;
    isSingleSchedule: boolean;
    onClose: () => void;
    onSelectMapRoute?: (routeName: string) => void;
}

export const RouteDetailHeader: React.FC<RouteDetailHeaderProps> = ({
                                                                        targetRouteNo,
                                                                        locationLabel,
                                                                        isSingleSchedule,
                                                                        onClose,
                                                                        onSelectMapRoute,
                                                                    }) => {
    return (
        <div
            className="p-4 sm:p-6 border-b border-slate-200/70 dark:border-white/10 bg-slate-50/90 dark:bg-white/[0.03] flex items-center justify-between gap-3 sm:gap-4 shrink-0">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <div
                    className={`px-3.5 sm:px-4 py-1 sm:py-1.5 rounded-2xl bg-gradient-to-r ${getRouteBadgeGradient(
                        targetRouteNo
                    )} font-black text-white text-lg sm:text-xl tracking-tight shadow-md font-mono shrink-0`}
                >
                    {UI_TEXT.COMMON.ROUTE_LABEL(targetRouteNo)}
                </div>
                <div className="min-w-0">
                    <h3 className="text-sm sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-1.5 sm:gap-2 truncate">
                        <span>{UI_TEXT.YONSEI.TIMETABLE_TITLE(locationLabel)}</span>
                        {isSingleSchedule && (
                            <span
                                className="px-1.5 sm:px-2 py-0.5 rounded-lg text-[10px] sm:text-[11px] font-black bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30 shrink-0">
                                {UI_TEXT.YONSEI.SCHEDULE_APPLIED_ALL_DAYS}
                            </span>
                        )}
                    </h3>
                </div>
            </div>

            <div className="flex items-center space-x-1.5 sm:space-x-2 shrink-0">
                {onSelectMapRoute && (
                    <button
                        onClick={() => {
                            onClose();
                            onSelectMapRoute(targetRouteNo);
                        }}
                        className="flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-xl sm:rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold shadow-md shadow-blue-600/20 transition-all cursor-pointer active:scale-95"
                    >
                        <MapPin className="h-3.5 w-3.5"/>
                        <span className="hidden sm:inline">
                            {UI_TEXT.YONSEI.REALTIME_MAP_BTN}
                        </span>
                        <span className="sm:hidden text-[11px]">
                            {UI_TEXT.YONSEI.MAP_SHORT_BTN}
                        </span>
                    </button>
                )}
                <button
                    onClick={onClose}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer active:scale-95"
                >
                    <X className="h-4 w-4"/>
                </button>
            </div>
        </div>
    );
};
