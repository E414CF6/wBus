"use client";

import React, {useMemo} from "react";
import {ArrowDownToLine, Check, FileDiff} from "lucide-react";
import {computeLineDiff, computeStructuredChanges, type WikiPageDocument} from "@entities/wiki";
import {UI_TEXT} from "@shared/config/locale";

export interface WikiConflictDiffViewProps {
    serverDoc: WikiPageDocument;
    localDoc: WikiPageDocument;
    onApplyServerDoc: () => void;
    onForceOverwrite: () => void;
}

export const WikiConflictDiffView: React.FC<WikiConflictDiffViewProps> = ({
                                                                              serverDoc,
                                                                              localDoc,
                                                                              onApplyServerDoc,
                                                                              onForceOverwrite,
                                                                          }) => {
    const structuredChanges = useMemo(
        () => computeStructuredChanges(serverDoc, localDoc),
        [serverDoc, localDoc],
    );

    const lineDiff = useMemo(
        () => computeLineDiff(serverDoc.markdownBody, localDoc.markdownBody),
        [serverDoc.markdownBody, localDoc.markdownBody],
    );

    const changedOnlyLines = useMemo(
        () => lineDiff.filter((entry) => entry.type !== "equal"),
        [lineDiff],
    );

    return (
        <div
            className="rounded-xl border border-amber-300/90 dark:border-amber-700/80 bg-white dark:bg-slate-950/90 p-3 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 text-xs font-black text-amber-900 dark:text-amber-100">
                    <FileDiff className="w-4 h-4 text-amber-600 dark:text-amber-400"/>
                    <span>
                        {UI_TEXT.WIKI.CONFLICT_DIFF.HEADER(serverDoc.version, serverDoc.lastEditor.nickname)}
                    </span>
                </div>
                <span className="text-[10.5px] font-bold text-slate-500 dark:text-slate-400">
                    {UI_TEXT.WIKI.CONFLICT_DIFF.LEGEND}
                </span>
            </div>

            {structuredChanges.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {structuredChanges.map((item) => (
                        <span
                            key={item}
                            className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/70 text-[10.5px] font-bold text-amber-800 dark:text-amber-200"
                        >
                            {item}
                        </span>
                    ))}
                </div>
            )}

            <div
                className="rounded-lg border border-slate-200 dark:border-slate-800 max-h-56 overflow-y-auto font-mono text-[11px] leading-relaxed custom-scrollbar">
                {changedOnlyLines.length === 0 ? (
                    <div className="p-3 text-center text-slate-500">
                        {UI_TEXT.WIKI.CONFLICT_DIFF.METADATA_ONLY}
                    </div>
                ) : (
                    lineDiff.map((entry, idx) => (
                        <div
                            key={idx}
                            className={`px-2.5 py-0.5 whitespace-pre-wrap break-all flex gap-2 ${
                                entry.type === "add"
                                    ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200"
                                    : entry.type === "remove"
                                        ? "bg-rose-50 dark:bg-rose-950/40 text-rose-900 dark:text-rose-200"
                                        : "text-slate-500 dark:text-slate-500"
                            }`}
                        >
                            <span className="w-7 shrink-0 select-none text-right opacity-50">
                                {entry.oldLineNumber ?? ""}
                            </span>
                            <span className="w-7 shrink-0 select-none text-right opacity-50">
                                {entry.newLineNumber ?? ""}
                            </span>
                            <span className="w-3 shrink-0 select-none font-bold">
                                {entry.type === "add" ? "+" : entry.type === "remove" ? "-" : " "}
                            </span>
                            <span className="flex-1">{entry.line || " "}</span>
                        </div>
                    ))
                )}
            </div>

            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    onClick={onApplyServerDoc}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-black transition cursor-pointer"
                >
                    <ArrowDownToLine className="w-3.5 h-3.5"/>
                    <span>{UI_TEXT.WIKI.CONFLICT_DIFF.APPLY_SERVER_DOC(serverDoc.version)}</span>
                </button>
                <button
                    type="button"
                    onClick={onForceOverwrite}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition cursor-pointer"
                >
                    <Check className="w-3.5 h-3.5"/>
                    <span>{UI_TEXT.WIKI.CONFLICT_DIFF.FORCE_OVERWRITE(serverDoc.version)}</span>
                </button>
            </div>
        </div>
    );
};
