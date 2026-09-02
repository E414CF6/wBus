"use client";

import {UI_TEXT} from "@shared/config/locale";
import {RotateCcw, Sparkles} from "lucide-react";
import React from "react";
import type {SelectedFootnoteInfo} from "../../types";

interface RouteDetailFootnoteBannerProps {
    selectedFootnoteInfo: SelectedFootnoteInfo | null;
    onClearFootnote: () => void;
}

export const RouteDetailFootnoteBanner: React.FC<RouteDetailFootnoteBannerProps> = ({
                                                                                        selectedFootnoteInfo,
                                                                                        onClearFootnote,
                                                                                    }) => {
    if (!selectedFootnoteInfo) return null;

    return (
        <div
            className="px-3.5 sm:px-6 py-2 bg-amber-500/15 dark:bg-amber-500/20 border-b border-amber-400/40 dark:border-amber-500/30 flex items-center justify-between gap-2 shrink-0 animate-fadeIn">
            <div
                className="flex items-center gap-2 min-w-0 text-xs font-bold text-amber-950 dark:text-amber-200 truncate">
                <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0"/>
                <span className="truncate">
                    <span className="font-mono font-black mr-1 text-amber-700 dark:text-amber-300">
                        {selectedFootnoteInfo.symbol}
                    </span>
                    &quot;{selectedFootnoteInfo.noteText}&quot; 각주 적용 시간표 강조 중
                </span>
                <span
                    className="px-1.5 py-0.2 rounded-md bg-amber-500/20 text-amber-900 dark:text-amber-300 text-[10px] font-black shrink-0">
                    {UI_TEXT.YONSEI.FOOTNOTE_COUNT_SUFFIX(selectedFootnoteInfo.count)}
                </span>
            </div>
            <button
                type="button"
                onClick={onClearFootnote}
                className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-900 dark:text-amber-200 text-[11px] font-black transition-all cursor-pointer shrink-0 active:scale-95"
            >
                <RotateCcw className="w-3 h-3"/>
                <span>{UI_TEXT.YONSEI.FOOTNOTE_CLEAR}</span>
            </button>
        </div>
    );
};
