"use client";

import {UI_TEXT} from "@shared/config/locale";
import React from "react";

interface RouteDetailViaStripProps {
    viaStops: string;
}

export const RouteDetailViaStrip: React.FC<RouteDetailViaStripProps> = ({viaStops}) => {
    if (!viaStops) return null;

    return (
        <div
            className="w-full px-3.5 sm:px-6 py-1.5 sm:py-2 bg-slate-100/90 dark:bg-white/[0.03] border-b border-slate-200/70 dark:border-white/10 flex items-center gap-2 sm:gap-2.5 overflow-hidden shrink-0">
            <span
                className="px-1.5 sm:px-2 py-0.5 rounded-md bg-blue-600 text-white font-black text-[9px] sm:text-[10px] shrink-0 shadow-2xs">
                {UI_TEXT.YONSEI.VIA_LABEL}
            </span>
            <div
                className="relative overflow-hidden flex-1 flex items-center h-4 sm:h-4.5 text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-200">
                <div className="animate-marquee-fast flex shrink-0 items-center whitespace-nowrap">
                    <span className="mr-10 sm:mr-12">{viaStops}</span>
                    <span className="mr-10 sm:mr-12">{viaStops}</span>
                </div>
                <div
                    className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 sm:w-12 bg-gradient-to-l from-slate-100/95 dark:from-[#121620] to-transparent z-10"/>
            </div>
        </div>
    );
};
