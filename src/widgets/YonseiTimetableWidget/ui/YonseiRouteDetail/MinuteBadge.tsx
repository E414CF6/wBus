"use client";

import {UI_TEXT} from "@shared/config/locale";
import React from "react";
import type {MinuteItem} from "../../types";

interface MinuteBadgeProps {
    item: MinuteItem;
    isVacationCol?: boolean;
    selectedFootnote: number | null;
    onSelectFootnote: (num: number | null) => void;
}

export const MinuteBadge: React.FC<MinuteBadgeProps> = ({
                                                            item,
                                                            isVacationCol = false,
                                                            selectedFootnote,
                                                            onSelectFootnote,
                                                        }) => {
    const isFootnoteActive = selectedFootnote !== null;
    const isMatchingFootnote = isFootnoteActive && item.footnoteNumber === selectedFootnote;
    const isDimmed = isFootnoteActive && !isMatchingFootnote;
    const hasFootnote = Boolean(item.footnoteNumber);

    let chipStyle: string;
    if (isMatchingFootnote) {
        chipStyle =
            "bg-amber-400 dark:bg-amber-500 text-slate-950 dark:text-black border-amber-500 dark:border-amber-400 ring-2 ring-amber-400/90 dark:ring-amber-300 shadow-lg scale-105 sm:scale-110 z-10 font-black animate-pulse";
    } else if (isDimmed) {
        chipStyle =
            "opacity-25 dark:opacity-20 hover:opacity-80 transition-opacity bg-slate-100 dark:bg-white/5 text-slate-400 border-slate-200/40 dark:border-white/5";
    } else if (item.isNextBus) {
        chipStyle = isVacationCol
            ? "bg-indigo-600 text-white border-indigo-600 shadow-md scale-105"
            : "bg-blue-600 text-white border-blue-600 shadow-md scale-105";
    } else {
        chipStyle = isVacationCol
            ? "bg-indigo-50/80 dark:bg-indigo-950/40 text-indigo-950 dark:text-indigo-200 border-indigo-200/60 dark:border-indigo-500/20 hover:border-indigo-400/60"
            : "bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200 border-blue-200/60 dark:border-blue-500/20 hover:border-blue-400/60";
    }

    const handleItemClick = () => {
        if (item.footnoteNumber) {
            onSelectFootnote(selectedFootnote === item.footnoteNumber ? null : item.footnoteNumber);
        }
    };

    const tooltip = item.notes
        ? `${item.destDepTime} 출발 (비고: ${item.notes}) - ${
            isMatchingFootnote
                ? UI_TEXT.YONSEI.FOOTNOTE_TOOLTIP_CLEAR
                : UI_TEXT.YONSEI.FOOTNOTE_TOOLTIP_ACTIVE
        }`
        : `${item.destDepTime} 출발`;

    return (
        <button
            type="button"
            onClick={handleItemClick}
            title={tooltip}
            className={`inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-md sm:rounded-xl font-mono text-[11px] sm:text-xs font-bold border transition-all active:scale-95 ${
                hasFootnote ? "cursor-pointer" : "cursor-default"
            } ${chipStyle}`}
        >
            <span className="font-extrabold">{item.minuteStr}</span>
            {item.isNextBus && (
                <span
                    className={`text-[8px] sm:text-[9px] px-0.5 sm:px-1 py-0.2 rounded font-sans font-black ${
                        isMatchingFootnote
                            ? "bg-amber-900/30 text-amber-950 dark:text-black"
                            : "bg-white/20 text-white"
                    }`}
                >
                    {UI_TEXT.YONSEI.NEXT_BUS_BADGE}
                </span>
            )}
            {item.footnoteSymbol && (
                <span
                    className={`text-xs font-black font-mono ml-0.5 ${
                        isMatchingFootnote
                            ? "text-amber-950 dark:text-black font-black"
                            : item.isNextBus
                                ? isVacationCol
                                    ? "text-indigo-200"
                                    : "text-amber-200"
                                : "text-amber-600 dark:text-amber-400"
                    }`}
                >
                    {item.footnoteSymbol}
                </span>
            )}
        </button>
    );
};
