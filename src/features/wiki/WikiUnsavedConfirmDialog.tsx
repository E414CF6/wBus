"use client";

import React from "react";
import {AlertTriangle, Save, Trash2} from "lucide-react";
import {UI_TEXT} from "@shared/config/locale";

export interface WikiUnsavedConfirmDialogProps {
    isOpen: boolean;
    onContinueEditing: () => void;
    onSaveDraftAndLeave: () => void;
    onDiscardAndLeave: () => void;
}

export const WikiUnsavedConfirmDialog: React.FC<WikiUnsavedConfirmDialogProps> = ({
    isOpen,
    onContinueEditing,
    onSaveDraftAndLeave,
    onDiscardAndLeave,
}) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="wiki-unsaved-title"
        >
            <div
                className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4">
                <div className="flex items-start gap-3">
                    <div
                        className="flex items-center justify-center w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
                        <AlertTriangle className="w-5 h-5"/>
                    </div>
                    <div className="space-y-1">
                        <h3
                            id="wiki-unsaved-title"
                            className="text-sm font-black text-slate-900 dark:text-white"
                        >
                            {UI_TEXT.WIKI.DRAFT.UNSAVED_TITLE}
                        </h3>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                            {UI_TEXT.WIKI.DRAFT.UNSAVED_DESC}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row sm:justify-end gap-2 pt-1">
                    <button
                        type="button"
                        onClick={onDiscardAndLeave}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900/70 text-xs font-extrabold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                    >
                        <Trash2 className="w-3.5 h-3.5"/>
                        <span>{UI_TEXT.WIKI.DRAFT.DISCARD_AND_LEAVE}</span>
                    </button>
                    <button
                        type="button"
                        onClick={onSaveDraftAndLeave}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black transition cursor-pointer"
                    >
                        <Save className="w-3.5 h-3.5"/>
                        <span>{UI_TEXT.WIKI.DRAFT.SAVE_DRAFT_AND_LEAVE}</span>
                    </button>
                    <button
                        type="button"
                        onClick={onContinueEditing}
                        className="inline-flex items-center justify-center px-3.5 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black transition cursor-pointer"
                    >
                        {UI_TEXT.WIKI.DRAFT.CONTINUE_EDITING}
                    </button>
                </div>
            </div>
        </div>
    );
};
