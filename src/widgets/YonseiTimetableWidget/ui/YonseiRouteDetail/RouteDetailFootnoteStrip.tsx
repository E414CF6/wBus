"use client";

import React from "react";
import {Info, RotateCcw} from "lucide-react";

import {UI_TEXT} from "@shared/config/locale";

import {getFootnoteSymbol} from "../../utils/footnoteUtils";

interface RouteDetailFootnoteStripProps {
    footnoteMap: Map<string, number>;
    selectedFootnote: number | null;
    onSelectFootnote: (num: number | null) => void;
    footnoteCounts: Map<number, number>;
}

export const RouteDetailFootnoteStrip: React.FC<RouteDetailFootnoteStripProps> = ({
                                                                                      footnoteMap,
                                                                                      selectedFootnote,
                                                                                      onSelectFootnote,
                                                                                      footnoteCounts,
                                                                                  }) => {
    if (footnoteMap.size === 0) return null;

    return (
        <div
            className="p-3 sm:p-4 bg-slate-100/90 dark:bg-white/[0.04] border-t border-slate-200/80 dark:border-white/10 text-xs shrink-0">
            <div className="flex items-center justify-between gap-2 mb-1.5 sm:mb-2">
                <div className="flex items-center gap-1.5 font-extrabold text-slate-800 dark:text-slate-200 text-xs">
                    <Info className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"/>
                    <span>{UI_TEXT.YONSEI.FOOTNOTE_TITLE}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {selectedFootnote !== null && (
                        <button
                            type="button"
                            onClick={() => onSelectFootnote(null)}
                            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 text-[11px] font-black transition-all cursor-pointer shrink-0 active:scale-95 animate-fadeIn"
                        >
                            <RotateCcw className="w-3 h-3"/>
                            <span>{UI_TEXT.YONSEI.FOOTNOTE_CLEAR}</span>
                        </button>
                    )}
                    <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 dark:text-slate-400">
                        {UI_TEXT.YONSEI.FOOTNOTE_SCROLL_HINT} →
                    </span>
                </div>
            </div>

            {/* Single-row Horizontal Scroll Strip */}
            <div
                className="flex items-center gap-2 overflow-x-auto custom-scrollbar py-1 scroll-smooth touch-pan-x overscroll-x-contain">
                {Array.from(footnoteMap.entries()).map(([noteText, num]) => {
                    const isHighlighted = selectedFootnote === num;
                    const count = footnoteCounts.get(num) || 0;

                    return (
                        <button
                            key={num}
                            type="button"
                            onClick={() => onSelectFootnote(isHighlighted ? null : num)}
                            title={
                                isHighlighted
                                    ? UI_TEXT.YONSEI.FOOTNOTE_TOOLTIP_CLEAR
                                    : UI_TEXT.YONSEI.FOOTNOTE_TOOLTIP_ACTIVE
                            }
                            className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl border shrink-0 transition-all cursor-pointer select-none active:scale-95 ${
                                isHighlighted
                                    ? "bg-amber-100 dark:bg-amber-950/80 border-amber-500 dark:border-amber-400 text-amber-950 dark:text-amber-100 shadow-md ring-2 ring-amber-400"
                                    : "bg-white dark:bg-[#181d2a] border-slate-200/80 dark:border-white/10 hover:border-blue-400/60 text-slate-700 dark:text-slate-200"
                            }`}
                        >
                            <span
                                className="font-black text-amber-600 dark:text-amber-400 text-xs sm:text-sm shrink-0 font-mono">
                                {getFootnoteSymbol(num)}
                            </span>
                            <span className="font-bold text-[11px] sm:text-xs whitespace-nowrap">
                                {noteText}
                            </span>
                            {count > 0 && (
                                <span
                                    className={`text-[10px] font-black px-1.5 py-0.2 rounded-md ${
                                        isHighlighted
                                            ? "bg-amber-500/20 text-amber-900 dark:text-amber-200"
                                            : "bg-slate-100 dark:bg-white/5 text-slate-400"
                                    }`}
                                >
                                    {UI_TEXT.YONSEI.FOOTNOTE_COUNT_SUFFIX(count)}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
