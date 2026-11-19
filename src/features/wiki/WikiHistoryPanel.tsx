"use client";

import React, {useMemo, useState} from "react";
import {Clock, FileDiff, History, RotateCcw, User} from "lucide-react";
import {computeLineDiff, computeStructuredChanges, useWikiRevisions} from "@entities/wiki";
import {LOCALE, UI_TEXT} from "@shared/config/locale";

export interface WikiHistoryPanelProps {
    slug: string;
    currentVersion: number;
    nickname: string;
    isProtected?: boolean;
    onReverted: () => Promise<void> | void;
}

function formatRevisionTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(LOCALE, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export const WikiHistoryPanel: React.FC<WikiHistoryPanelProps> = ({
                                                                      slug,
                                                                      currentVersion,
                                                                      nickname,
                                                                      isProtected = false,
                                                                      onReverted,
                                                                  }) => {
    const [selectedVersion, setSelectedVersion] = useState<number | null>(currentVersion);
    const [compareToVersion, setCompareToVersion] = useState<number | null>(
        currentVersion > 1 ? currentVersion - 1 : null
    );
    const [revertingVersion, setRevertingVersion] = useState<number | null>(null);
    const [revertError, setRevertError] = useState<string | null>(null);

    const {data, isLoading, error, mutate} = useWikiRevisions(
        slug,
        true,
        selectedVersion,
        compareToVersion
    );

    const revisions = data?.revisions ?? [];
    const selectedRev = data?.selectedRevision ?? null;
    const compareRev = data?.compareRevision ?? null;

    const lineDiff = useMemo(() => {
        if (!selectedRev) return [];
        const beforeText = compareRev?.snapshot.markdownBody ?? "";
        return computeLineDiff(beforeText, selectedRev.snapshot.markdownBody);
    }, [selectedRev, compareRev]);

    const structuredChanges = useMemo(() => {
        if (!selectedRev) return [];
        if (compareRev) {
            return computeStructuredChanges(compareRev.snapshot, selectedRev.snapshot);
        }
        return selectedRev.diffStats.structuredChanges;
    }, [selectedRev, compareRev]);

    const handleRevert = async (targetVersion: number) => {
        if (revertingVersion !== null) return;
        setRevertingVersion(targetVersion);
        setRevertError(null);
        try {
            const res = await fetch(`/api/wiki/${encodeURIComponent(slug)}/revert`, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    targetVersion,
                    baseVersion: currentVersion,
                    nickname: nickname.trim(),
                    summary: UI_TEXT.WIKI.HISTORY.REVERT_SUMMARY(targetVersion),
                }),
            });
            const body = await res.json().catch(() => null);
            if (!res.ok) {
                setRevertError(body?.error || UI_TEXT.WIKI.HISTORY.REVERT_FAILED);
                return;
            }
            await mutate();
            await onReverted();
        } catch (err) {
            setRevertError(err instanceof Error ? err.message : UI_TEXT.WIKI.HISTORY.REVERT_ERROR);
        } finally {
            setRevertingVersion(null);
        }
    };

    if (isLoading && !data) {
        return (
            <div
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 p-8 text-center text-xs font-semibold text-slate-500">
                {UI_TEXT.WIKI.HISTORY.LOADING}
            </div>
        );
    }

    if (error) {
        return (
            <div
                className="rounded-2xl border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-5 text-xs font-bold text-rose-700 dark:text-rose-200">
                {UI_TEXT.WIKI.HISTORY.LOAD_FAILED(error.message)}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            {/* Revision List */}
            <div
                className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 overflow-hidden shadow-sm">
                <div
                    className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/70 flex items-center justify-between">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <History className="w-4 h-4 text-sky-600 dark:text-sky-400"/>
                        {UI_TEXT.WIKI.HISTORY.REVISION_LIST_TITLE(revisions.length)}
                    </span>
                    <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                        {UI_TEXT.WIKI.HISTORY.CURRENT_VERSION(currentVersion)}
                    </span>
                </div>

                {revertError && (
                    <div
                        className="m-3 p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-[11px] font-bold text-rose-700 dark:text-rose-200">
                        {revertError}
                    </div>
                )}

                <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[540px] overflow-y-auto">
                    {revisions.length === 0 ? (
                        <div className="p-6 text-center text-xs text-slate-500">
                            {UI_TEXT.WIKI.HISTORY.EMPTY_REVISIONS}
                        </div>
                    ) : (
                        revisions.map((rev) => {
                            const isSelected = selectedVersion === rev.version;
                            return (
                                <div
                                    key={rev.version}
                                    className={`p-3.5 transition ${
                                        isSelected
                                            ? "bg-sky-50/70 dark:bg-sky-950/30"
                                            : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedVersion(rev.version);
                                                setCompareToVersion(rev.version > 1 ? rev.version - 1 : null);
                                            }}
                                            className="text-left min-w-0 flex-1 cursor-pointer"
                                        >
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span
                                                    className="px-2 py-0.5 rounded-md bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-[10px] font-black tabular-nums">
                                                    v{rev.version}
                                                </span>
                                                {rev.version === currentVersion && (
                                                    <span
                                                        className="px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[10px] font-extrabold">
                                                        {UI_TEXT.WIKI.HISTORY.LATEST_BADGE}
                                                    </span>
                                                )}
                                                <span
                                                    className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                                                    {rev.summary || UI_TEXT.WIKI.HISTORY.NO_SUMMARY}
                                                </span>
                                            </div>
                                            <div
                                                className="flex flex-wrap items-center gap-2.5 mt-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                                <span className="inline-flex items-center gap-1">
                                                    <User className="w-3 h-3"/>
                                                    {rev.editor.nickname}
                                                </span>
                                                <span className="inline-flex items-center gap-1">
                                                    <Clock className="w-3 h-3"/>
                                                    {formatRevisionTime(rev.createdAt)}
                                                </span>
                                                <span className="font-mono text-[10px]">
                                                    <span
                                                        className="text-emerald-600 dark:text-emerald-400">+{rev.diffStats.added}</span>{" "}
                                                    <span className="text-rose-500">-{rev.diffStats.removed}</span>
                                                </span>
                                            </div>
                                        </button>

                                        {rev.version !== currentVersion && !isProtected && (
                                            <button
                                                type="button"
                                                disabled={revertingVersion !== null}
                                                onClick={() => handleRevert(rev.version)}
                                                className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
                                            >
                                                <RotateCcw className="w-3 h-3"/>
                                                {revertingVersion === rev.version
                                                    ? UI_TEXT.WIKI.HISTORY.REVERTING
                                                    : UI_TEXT.WIKI.HISTORY.REVERT_BTN}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* Diff Inspector */}
            <div
                className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 overflow-hidden shadow-sm">
                <div
                    className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/70 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                        <FileDiff className="w-4 h-4 text-indigo-600 dark:text-indigo-400"/>
                        {UI_TEXT.WIKI.HISTORY.DIFF_TITLE}
                    </span>
                    {revisions.length > 0 && (
                        <div className="flex items-center gap-2 text-[11px] font-bold">
                            <select
                                id="wiki-history-compare-to"
                                name="compareToVersion"
                                aria-label={UI_TEXT.WIKI.HISTORY.COMPARE_BASE_ARIA}
                                value={compareToVersion ?? ""}
                                onChange={(e) => setCompareToVersion(e.target.value ? Number(e.target.value) : null)}
                                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                            >
                                <option value="">{UI_TEXT.WIKI.HISTORY.COMPARE_EMPTY}</option>
                                {revisions.map((r) => (
                                    <option key={`cmp-${r.version}`} value={r.version}>
                                        {UI_TEXT.WIKI.HISTORY.COMPARE_PREV_OPTION(r.version)}
                                    </option>
                                ))}
                            </select>
                            <span className="text-slate-400">→</span>
                            <select
                                id="wiki-history-selected"
                                name="selectedVersion"
                                aria-label={UI_TEXT.WIKI.HISTORY.COMPARE_TARGET_ARIA}
                                value={selectedVersion ?? ""}
                                onChange={(e) => setSelectedVersion(Number(e.target.value))}
                                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                            >
                                {revisions.map((r) => (
                                    <option key={`sel-${r.version}`} value={r.version}>
                                        {UI_TEXT.WIKI.HISTORY.COMPARE_TARGET_OPTION(r.version)}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="p-4 space-y-3 max-h-[540px] overflow-y-auto">
                    {!selectedRev ? (
                        <p className="text-xs text-slate-500 text-center py-10">
                            {UI_TEXT.WIKI.HISTORY.SELECT_VERSION_HINT}
                        </p>
                    ) : (
                        <>
                            {structuredChanges.length > 0 && (
                                <div
                                    className="p-3 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200/80 dark:border-indigo-800/70 space-y-1">
                                    <p className="text-[11px] font-black text-indigo-800 dark:text-indigo-200">
                                        {UI_TEXT.WIKI.HISTORY.STRUCTURED_CHANGES_TITLE}
                                    </p>
                                    <ul className="list-disc pl-4 space-y-0.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                                        {structuredChanges.map((change, idx) => (
                                            <li key={idx}>{change}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}

                            <div
                                className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden font-mono text-[11px] leading-relaxed">
                                {lineDiff.map((entry, idx) => (
                                    <div
                                        key={idx}
                                        className={`px-3 py-0.5 whitespace-pre-wrap break-all flex gap-3 ${
                                            entry.type === "add"
                                                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200"
                                                : entry.type === "remove"
                                                    ? "bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200"
                                                    : "text-slate-600 dark:text-slate-400"
                                        }`}
                                    >
                                        <span className="w-8 shrink-0 select-none text-right opacity-50">
                                            {entry.oldLineNumber ?? ""}
                                        </span>
                                        <span className="w-8 shrink-0 select-none text-right opacity-50">
                                            {entry.newLineNumber ?? ""}
                                        </span>
                                        <span className="w-3 shrink-0 select-none font-bold">
                                            {entry.type === "add" ? "+" : entry.type === "remove" ? "-" : " "}
                                        </span>
                                        <span className="flex-1">{entry.line || " "}</span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
