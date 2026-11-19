"use client";

import React from "react";
import {History, RotateCcw, Trash2} from "lucide-react";
import type {WikiLocalDraft} from "./lib/wikiLocalDraft";
import {LOCALE, UI_TEXT} from "@shared/config/locale";

export interface WikiDraftBannerProps {
    draft: WikiLocalDraft;
    currentVersion?: number;
    onRestore: () => void;
    onDiscard: () => void;
}

function formatSavedAt(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(LOCALE, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export const WikiDraftBanner: React.FC<WikiDraftBannerProps> = ({
                                                                    draft,
                                                                    currentVersion,
                                                                    onRestore,
                                                                    onDiscard,
                                                                }) => {
    const versionMismatch =
        typeof draft.baseVersion === "number" &&
        typeof currentVersion === "number" &&
        draft.baseVersion !== currentVersion;

    return (
        <div
            className="rounded-2xl border border-sky-200 dark:border-sky-800/80 bg-sky-50/90 dark:bg-sky-950/40 p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
                <History className="w-4 h-4 shrink-0 mt-0.5 text-sky-700 dark:text-sky-300"/>
                <div className="space-y-0.5 text-xs">
                    <p className="font-black text-sky-950 dark:text-sky-100">
                        {UI_TEXT.WIKI.DRAFT.BANNER_TITLE(formatSavedAt(draft.savedAt))}
                    </p>
                    <p className="text-[11px] font-medium text-sky-800/90 dark:text-sky-300">
                        {versionMismatch
                            ? UI_TEXT.WIKI.DRAFT.BANNER_VERSION_MISMATCH(draft.baseVersion!, currentVersion!)
                            : UI_TEXT.WIKI.DRAFT.BANNER_CONTINUE_HINT}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <button
                    type="button"
                    onClick={onDiscard}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-sky-200 dark:border-sky-800 bg-white dark:bg-slate-900 text-[11px] font-extrabold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                >
                    <Trash2 className="w-3 h-3"/>
                    <span>{UI_TEXT.WIKI.DRAFT.DISCARD_BTN}</span>
                </button>
                <button
                    type="button"
                    onClick={onRestore}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-black shadow-xs transition cursor-pointer"
                >
                    <RotateCcw className="w-3 h-3"/>
                    <span>{UI_TEXT.WIKI.DRAFT.RESTORE_BTN}</span>
                </button>
            </div>
        </div>
    );
};
