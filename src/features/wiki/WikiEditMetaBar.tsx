"use client";

import React, {useState} from "react";
import {AlertTriangle, Check, FileDiff, RefreshCw, Save, ShieldAlert, User, X} from "lucide-react";
import type {WikiPageDocument} from "@entities/wiki";
import {UI_TEXT} from "@shared/config/locale";
import {WikiConflictDiffView} from "./WikiConflictDiffView";

export interface WikiEditMetaBarProps {
    nickname: string;
    onNicknameChange: (val: string) => void;
    summary: string;
    onSummaryChange: (val: string) => void;
    honeypot: string;
    onHoneypotChange: (val: string) => void;
    isSaving: boolean;
    errorMessage?: string | null;
    conflictVersion?: number | null;
    conflictDoc?: WikiPageDocument | null;
    localDraftDoc?: WikiPageDocument | null;
    onReloadLatest?: () => void;
    onApplyConflictServerDoc?: () => void;
    onForceOverwrite?: () => void;
    onSaveDraft?: () => void;
    onSave: () => void;
    onCancel: () => void;
    saveLabel?: string;
    isProtected?: boolean;
}

export const WikiEditMetaBar: React.FC<WikiEditMetaBarProps> = ({
                                                                    nickname,
                                                                    onNicknameChange,
                                                                    summary,
                                                                    onSummaryChange,
                                                                    honeypot,
                                                                    onHoneypotChange,
                                                                    isSaving,
                                                                    errorMessage,
                                                                    conflictVersion,
                                                                    conflictDoc,
                                                                    localDraftDoc,
                                                                    onReloadLatest,
                                                                    onApplyConflictServerDoc,
                                                                    onForceOverwrite,
                                                                    onSaveDraft,
                                                                    onSave,
                                                                    onCancel,
                                                                    saveLabel = UI_TEXT.WIKI.META_BAR.DEFAULT_SAVE_LABEL,
                                                                    isProtected = false,
                                                                }) => {
    const [showConflictDiff, setShowConflictDiff] = useState(true);
    return (
        <div
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 p-4 sm:p-5 shadow-sm space-y-4">
            {isProtected && (
                <div
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"/>
                    <span>{UI_TEXT.WIKI.META_BAR.PROTECTED_WARNING}</span>
                </div>
            )}

            {conflictVersion && (
                <div
                    className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 space-y-2.5">
                    <div className="flex items-start gap-2 text-amber-900 dark:text-amber-100 text-xs font-bold">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"/>
                        <div>
                            {UI_TEXT.WIKI.META_BAR.CONFLICT_PREFIX}<strong>v{conflictVersion}</strong>{UI_TEXT.WIKI.META_BAR.CONFLICT_SUFFIX}
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {conflictDoc && localDraftDoc && (
                            <button
                                type="button"
                                onClick={() => setShowConflictDiff((v) => !v)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-xs font-black text-amber-900 dark:text-amber-100 hover:bg-amber-100/60 transition cursor-pointer"
                            >
                                <FileDiff className="w-3.5 h-3.5"/>
                                {showConflictDiff ? UI_TEXT.WIKI.META_BAR.HIDE_CONFLICT_DIFF : UI_TEXT.WIKI.META_BAR.SHOW_CONFLICT_DIFF}
                            </button>
                        )}
                        {onReloadLatest && (
                            <button
                                type="button"
                                onClick={onReloadLatest}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-xs font-black text-amber-900 dark:text-amber-100 hover:bg-amber-100/60 transition cursor-pointer"
                            >
                                <RefreshCw className="w-3.5 h-3.5"/>
                                {UI_TEXT.WIKI.META_BAR.RELOAD_LATEST}
                            </button>
                        )}
                        {!conflictDoc && onForceOverwrite && (
                            <button
                                type="button"
                                onClick={onForceOverwrite}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition cursor-pointer"
                            >
                                <Check className="w-3.5 h-3.5"/>
                                {UI_TEXT.WIKI.META_BAR.FORCE_OVERWRITE(conflictVersion)}
                            </button>
                        )}
                    </div>
                    {showConflictDiff && conflictDoc && localDraftDoc && onApplyConflictServerDoc && onForceOverwrite && (
                        <WikiConflictDiffView
                            serverDoc={conflictDoc}
                            localDoc={localDraftDoc}
                            onApplyServerDoc={onApplyConflictServerDoc}
                            onForceOverwrite={onForceOverwrite}
                        />
                    )}
                </div>
            )}

            {errorMessage && !conflictVersion && (
                <div
                    className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0"/>
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* Honeypot anti-spam field */}
            <div className="sr-only" aria-hidden="true">
                <label htmlFor="wiki-website-honeypot">{UI_TEXT.WIKI.META_BAR.HONEYPOT_LABEL}</label>
                <input
                    id="wiki-website-honeypot"
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => onHoneypotChange(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                    <label
                        htmlFor="wiki-editor-nickname"
                        className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"
                    >
                        <User className="w-3 h-3"/>
                        {UI_TEXT.WIKI.META_BAR.NICKNAME_LABEL}
                    </label>
                    <input
                        id="wiki-editor-nickname"
                        name="nickname"
                        type="text"
                        value={nickname}
                        onChange={(e) => onNicknameChange(e.target.value)}
                        maxLength={24}
                        placeholder={UI_TEXT.WIKI.META_BAR.NICKNAME_PLACEHOLDER}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    />
                </div>
                <div className="sm:col-span-2">
                    <label
                        htmlFor="wiki-editor-summary"
                        className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1"
                    >
                        {UI_TEXT.WIKI.META_BAR.SUMMARY_LABEL}
                    </label>
                    <input
                        id="wiki-editor-summary"
                        name="summary"
                        type="text"
                        value={summary}
                        onChange={(e) => onSummaryChange(e.target.value)}
                        maxLength={160}
                        placeholder={UI_TEXT.WIKI.META_BAR.SUMMARY_PLACEHOLDER}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    />
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {UI_TEXT.WIKI.META_BAR.HISTORY_NOTICE}
                </p>
                <div className="flex items-center gap-2 ml-auto">
                    {onSaveDraft && (
                        <button
                            type="button"
                            onClick={onSaveDraft}
                            disabled={isSaving}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-white/[0.04] text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
                        >
                            <Save className="w-3.5 h-3.5"/>
                            {UI_TEXT.WIKI.META_BAR.SAVE_DRAFT}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-extrabold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
                    >
                        <X className="w-3.5 h-3.5"/>
                        {UI_TEXT.COMMON.CANCEL}
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#003876] hover:bg-[#00295a] dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-black shadow-sm transition cursor-pointer disabled:opacity-50"
                    >
                        <Save className="w-3.5 h-3.5"/>
                        {isSaving ? UI_TEXT.WIKI.META_BAR.SAVING : saveLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
