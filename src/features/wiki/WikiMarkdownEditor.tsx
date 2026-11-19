"use client";

import React, {useMemo, useRef, useState} from "react";
import {
    Bold,
    BookOpen,
    Bus,
    Camera,
    Clock,
    Code,
    Columns2,
    Eye,
    Heading2,
    Info,
    Italic,
    Link2,
    List,
    ListTree,
    MapPin,
    Minus,
    PenLine,
    Redo2,
    Route,
    Save,
    Strikethrough,
    Table2,
    Undo2,
} from "lucide-react";
import {extractWikiStructuredCounts} from "@entities/wiki";
import {UI_TEXT} from "@shared/config/locale";
import {
    applySnippetAtSelection,
    extractMarkdownHeadings,
    indentSelectedLines,
    insertMarkdownLink,
    toggleInlineWrap,
    toggleLinePrefix,
} from "./lib/markdownEditorOps";
import {useMarkdownHistory} from "./lib/useMarkdownHistory";
import {WikiMarkdownRenderer} from "./WikiMarkdownRenderer";

export interface WikiMarkdownEditorProps {
    value: string;
    onChange: (next: string) => void;
    onSaveDraft?: () => void;
    draftStatusLabel?: string | null;
}

const ROUTES_SNIPPET = UI_TEXT.WIKI.MARKDOWN_EDITOR.SNIPPET_ROUTES;

const SHUTTLE_SNIPPET = UI_TEXT.WIKI.MARKDOWN_EDITOR.SNIPPET_SHUTTLE;

const STOPS_SNIPPET = UI_TEXT.WIKI.MARKDOWN_EDITOR.SNIPPET_STOPS;

export const WikiMarkdownEditor: React.FC<WikiMarkdownEditorProps> = ({
                                                                          value,
                                                                          onChange,
                                                                          onSaveDraft,
                                                                          draftStatusLabel,
                                                                      }) => {
    const [mode, setMode] = useState<"write" | "split" | "preview">("write");
    const [tocOpen, setTocOpen] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const {
        canUndo,
        canRedo,
        isComposingRef,
        undo,
        redo,
        applyEdit,
        handleTextareaChange,
        handleCompositionStart,
        handleCompositionEnd,
    } = useMarkdownHistory({value, onChange, textareaRef});

    const getSelection = () => {
        const el = textareaRef.current;
        return {
            start: el?.selectionStart ?? value.length,
            end: el?.selectionEnd ?? value.length,
        };
    };

    const insertSnippet = (snippet: string, source: "toolbar" | "shortcut" = "toolbar") => {
        const {start, end} = getSelection();
        applyEdit(applySnippetAtSelection(value, start, end, snippet), source);
    };

    const handleInlineFormat = (
        marker: string,
        placeholder: string,
        source: "toolbar" | "shortcut" = "toolbar",
    ) => {
        const {start, end} = getSelection();
        applyEdit(toggleInlineWrap(value, start, end, marker, placeholder), source);
    };

    const handleLinkInsert = (source: "toolbar" | "shortcut" = "toolbar") => {
        const {start, end} = getSelection();
        applyEdit(insertMarkdownLink(value, start, end), source);
    };

    const handleLinePrefix = (prefix: string) => {
        const {start, end} = getSelection();
        applyEdit(toggleLinePrefix(value, start, end, prefix), "toolbar");
    };

    const jumpToHeading = (offset: number) => {
        setTocOpen(false);
        if (mode === "preview") {
            setMode("write");
        }
        requestAnimationFrame(() => {
            const el = textareaRef.current;
            if (!el) return;
            el.focus();
            const safeOffset = Math.min(offset, value.length);
            el.setSelectionRange(safeOffset, safeOffset);
            const linesBefore = value.slice(0, safeOffset).split("\n").length - 1;
            const totalLines = Math.max(1, value.split("\n").length);
            el.scrollTop = Math.max(0, (linesBefore / totalLines) * el.scrollHeight - 40);
        });
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (isComposingRef.current || e.nativeEvent.isComposing) {
            return;
        }

        const mod = e.metaKey || e.ctrlKey;
        const key = e.key.toLowerCase();

        if (mod && key === "z") {
            e.preventDefault();
            if (e.shiftKey) {
                redo();
            } else {
                undo();
            }
            return;
        }

        if (mod && !e.shiftKey && key === "y") {
            e.preventDefault();
            redo();
            return;
        }

        if (mod && !e.shiftKey && key === "b") {
            e.preventDefault();
            handleInlineFormat("**", UI_TEXT.WIKI.MARKDOWN_EDITOR.BOLD_PLACEHOLDER, "shortcut");
            return;
        }

        if (mod && !e.shiftKey && key === "i") {
            e.preventDefault();
            handleInlineFormat("*", UI_TEXT.WIKI.MARKDOWN_EDITOR.ITALIC_PLACEHOLDER, "shortcut");
            return;
        }

        if (mod && !e.shiftKey && key === "k") {
            e.preventDefault();
            handleLinkInsert("shortcut");
            return;
        }

        if (mod && !e.shiftKey && key === "s") {
            if (onSaveDraft) {
                e.preventDefault();
                onSaveDraft();
            }
            return;
        }

        if (e.key === "Tab") {
            e.preventDefault();
            const {start, end} = getSelection();
            applyEdit(indentSelectedLines(value, start, end, e.shiftKey), "shortcut");
        }
    };

    const headings = useMemo(() => extractMarkdownHeadings(value), [value]);
    const stats = useMemo(() => {
        const lines = value ? value.split("\n").length : 0;
        const chars = value.length;
        const charsNoSpace = value.replace(/\s+/g, "").length;
        const structured = extractWikiStructuredCounts(value);
        return {lines, chars, charsNoSpace, structured};
    }, [value]);

    const blockToolbarItems: Array<{
        label: string;
        icon: React.ReactNode;
        kind: "prefix" | "snippet";
        payload: string;
    }> = [
        {
            label: UI_TEXT.WIKI.MARKDOWN_EDITOR.TOOLBAR.HEADING.label,
            icon: <Heading2 className="w-3.5 h-3.5"/>,
            kind: "prefix",
            payload: "## ",
        },
        {
            label: UI_TEXT.WIKI.MARKDOWN_EDITOR.TOOLBAR.LIST.label,
            icon: <List className="w-3.5 h-3.5"/>,
            kind: "prefix",
            payload: "- ",
        },
        {
            label: UI_TEXT.WIKI.MARKDOWN_EDITOR.TOOLBAR.TIP.label,
            icon: <Info className="w-3.5 h-3.5"/>,
            kind: "snippet",
            payload: UI_TEXT.WIKI.MARKDOWN_EDITOR.TOOLBAR.TIP.snippet,
        },
        {
            label: UI_TEXT.WIKI.MARKDOWN_EDITOR.TOOLBAR.TABLE.label,
            icon: <Table2 className="w-3.5 h-3.5"/>,
            kind: "snippet",
            payload: UI_TEXT.WIKI.MARKDOWN_EDITOR.TOOLBAR.TABLE.snippet,
        },
        {
            label: UI_TEXT.WIKI.MARKDOWN_EDITOR.TOOLBAR.ROUTES.label,
            icon: <Route className="w-3.5 h-3.5"/>,
            kind: "snippet",
            payload: ROUTES_SNIPPET,
        },
        {
            label: UI_TEXT.WIKI.MARKDOWN_EDITOR.TOOLBAR.SHUTTLE.label,
            icon: <Clock className="w-3.5 h-3.5"/>,
            kind: "snippet",
            payload: SHUTTLE_SNIPPET,
        },
        {
            label: UI_TEXT.WIKI.MARKDOWN_EDITOR.TOOLBAR.STOPS.label,
            icon: <MapPin className="w-3.5 h-3.5"/>,
            kind: "snippet",
            payload: STOPS_SNIPPET,
        },
        {
            label: UI_TEXT.WIKI.MARKDOWN_EDITOR.TOOLBAR.WIKI_LINK.label,
            icon: <BookOpen className="w-3.5 h-3.5"/>,
            kind: "snippet",
            payload: UI_TEXT.WIKI.MARKDOWN_EDITOR.TOOLBAR.WIKI_LINK.snippet,
        },
        {
            label: UI_TEXT.WIKI.MARKDOWN_EDITOR.TOOLBAR.ROUTE_BADGE.label,
            icon: <Bus className="w-3.5 h-3.5"/>,
            kind: "snippet",
            payload: UI_TEXT.WIKI.MARKDOWN_EDITOR.TOOLBAR.ROUTE_BADGE.snippet,
        },
        {
            label: UI_TEXT.WIKI.MARKDOWN_EDITOR.TOOLBAR.ROADVIEW.label,
            icon: <Camera className="w-3.5 h-3.5"/>,
            kind: "snippet",
            payload: UI_TEXT.WIKI.MARKDOWN_EDITOR.TOOLBAR.ROADVIEW.snippet,
        },
    ];

    const showWritePane = mode === "write" || mode === "split";
    const showPreviewPane = mode === "preview" || mode === "split";

    return (
        <div className="space-y-2.5">
            {/* Top Mode Switcher + TOC Jump + Draft Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/[0.06]">
                        <button
                            type="button"
                            onClick={() => setMode("write")}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                                mode === "write"
                                    ? "bg-white dark:bg-[#1b2234] text-[#003876] dark:text-blue-300 shadow-xs"
                                    : "text-slate-600 dark:text-slate-300"
                            }`}
                        >
                            <PenLine className="w-3.5 h-3.5"/>
                            <span>{UI_TEXT.WIKI.MARKDOWN_EDITOR.WRITE_TAB}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode("split")}
                            className={`hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                                mode === "split"
                                    ? "bg-white dark:bg-[#1b2234] text-[#003876] dark:text-blue-300 shadow-xs"
                                    : "text-slate-600 dark:text-slate-300"
                            }`}
                        >
                            <Columns2 className="w-3.5 h-3.5"/>
                            <span>{UI_TEXT.WIKI.MARKDOWN_EDITOR.SPLIT_TAB}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setMode("preview")}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                                mode === "preview"
                                    ? "bg-white dark:bg-[#1b2234] text-[#003876] dark:text-blue-300 shadow-xs"
                                    : "text-slate-600 dark:text-slate-300"
                            }`}
                        >
                            <Eye className="w-3.5 h-3.5"/>
                            <span>{UI_TEXT.WIKI.MARKDOWN_EDITOR.PREVIEW_TAB}</span>
                        </button>
                    </div>

                    {/* Section TOC Jump */}
                    {headings.length > 0 && (
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => setTocOpen((v) => !v)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.04] text-[11px] font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition cursor-pointer"
                            >
                                <ListTree className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400"/>
                                <span>{UI_TEXT.WIKI.MARKDOWN_EDITOR.TOC_BUTTON(headings.length)}</span>
                            </button>
                            {tocOpen && (
                                <div
                                    className="absolute left-0 mt-1.5 w-64 max-h-60 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl z-20 p-1.5 space-y-0.5">
                                    {headings.map((h) => (
                                        <button
                                            key={`${h.lineNumber}-${h.offset}`}
                                            type="button"
                                            onClick={() => jumpToHeading(h.offset)}
                                            className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-950/50 truncate cursor-pointer flex items-center gap-1.5"
                                            style={{paddingLeft: `${(h.level - 1) * 10 + 10}px`}}
                                        >
                                            <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                                L{h.lineNumber}
                                            </span>
                                            <span className="truncate">{h.text}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Draft Save Pill */}
                {(onSaveDraft || draftStatusLabel) && (
                    <div className="flex items-center gap-2">
                        {draftStatusLabel && (
                            <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                                {draftStatusLabel}
                            </span>
                        )}
                        {onSaveDraft && (
                            <button
                                type="button"
                                onClick={onSaveDraft}
                                title={UI_TEXT.WIKI.MARKDOWN_EDITOR.SAVE_DRAFT_TITLE}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[0.05] hover:bg-slate-100 dark:hover:bg-white/[0.1] text-[11px] font-extrabold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                            >
                                <Save className="w-3 h-3"/>
                                <span>{UI_TEXT.WIKI.MARKDOWN_EDITOR.SAVE_DRAFT_LABEL}</span>
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Formatting & Block Toolbars */}
            {showWritePane && (
                <div
                    className="rounded-xl border border-slate-200/90 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] p-2 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-1">
                        <button
                            type="button"
                            onClick={() => undo()}
                            disabled={!canUndo}
                            title={UI_TEXT.WIKI.MARKDOWN_EDITOR.UNDO_TITLE}
                            aria-label={UI_TEXT.WIKI.MARKDOWN_EDITOR.UNDO_ARIA}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/10 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.12] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                            <Undo2 className="w-3.5 h-3.5"/>
                            <span className="hidden sm:inline">{UI_TEXT.WIKI.MARKDOWN_EDITOR.UNDO_LABEL}</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => redo()}
                            disabled={!canRedo}
                            title={UI_TEXT.WIKI.MARKDOWN_EDITOR.REDO_TITLE}
                            aria-label={UI_TEXT.WIKI.MARKDOWN_EDITOR.REDO_ARIA}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-white/[0.06] border border-slate-200/80 dark:border-white/10 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/[0.12] disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                        >
                            <Redo2 className="w-3.5 h-3.5"/>
                            <span className="hidden sm:inline">{UI_TEXT.WIKI.MARKDOWN_EDITOR.REDO_LABEL}</span>
                        </button>

                        <span className="h-4 w-px bg-slate-200 dark:bg-white/10 mx-1"/>

                        <button
                            type="button"
                            onClick={() => handleInlineFormat("**", UI_TEXT.WIKI.MARKDOWN_EDITOR.BOLD_PLACEHOLDER)}
                            title={UI_TEXT.WIKI.MARKDOWN_EDITOR.BOLD_TITLE}
                            aria-label={UI_TEXT.WIKI.MARKDOWN_EDITOR.BOLD_ARIA}
                            className="p-1.5 rounded-lg hover:bg-slate-200/80 dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 transition cursor-pointer"
                        >
                            <Bold className="w-3.5 h-3.5"/>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleInlineFormat("*", UI_TEXT.WIKI.MARKDOWN_EDITOR.ITALIC_PLACEHOLDER)}
                            title={UI_TEXT.WIKI.MARKDOWN_EDITOR.ITALIC_TITLE}
                            aria-label={UI_TEXT.WIKI.MARKDOWN_EDITOR.ITALIC_ARIA}
                            className="p-1.5 rounded-lg hover:bg-slate-200/80 dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 transition cursor-pointer"
                        >
                            <Italic className="w-3.5 h-3.5"/>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleInlineFormat("~~", UI_TEXT.WIKI.MARKDOWN_EDITOR.STRIKE_PLACEHOLDER)}
                            title={UI_TEXT.WIKI.MARKDOWN_EDITOR.STRIKE_TITLE}
                            aria-label={UI_TEXT.WIKI.MARKDOWN_EDITOR.STRIKE_ARIA}
                            className="p-1.5 rounded-lg hover:bg-slate-200/80 dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 transition cursor-pointer"
                        >
                            <Strikethrough className="w-3.5 h-3.5"/>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleInlineFormat("`", UI_TEXT.WIKI.MARKDOWN_EDITOR.CODE_PLACEHOLDER)}
                            title={UI_TEXT.WIKI.MARKDOWN_EDITOR.CODE_TITLE}
                            aria-label={UI_TEXT.WIKI.MARKDOWN_EDITOR.CODE_ARIA}
                            className="p-1.5 rounded-lg hover:bg-slate-200/80 dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 transition cursor-pointer"
                        >
                            <Code className="w-3.5 h-3.5"/>
                        </button>
                        <button
                            type="button"
                            onClick={() => handleLinkInsert()}
                            title={UI_TEXT.WIKI.MARKDOWN_EDITOR.LINK_TITLE}
                            aria-label={UI_TEXT.WIKI.MARKDOWN_EDITOR.LINK_ARIA}
                            className="p-1.5 rounded-lg hover:bg-slate-200/80 dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 transition cursor-pointer"
                        >
                            <Link2 className="w-3.5 h-3.5"/>
                        </button>
                        <button
                            type="button"
                            onClick={() => insertSnippet("\n---\n")}
                            title={UI_TEXT.WIKI.MARKDOWN_EDITOR.HR_TITLE}
                            aria-label={UI_TEXT.WIKI.MARKDOWN_EDITOR.HR_ARIA}
                            className="p-1.5 rounded-lg hover:bg-slate-200/80 dark:hover:bg-white/[0.1] text-slate-700 dark:text-slate-200 transition cursor-pointer"
                        >
                            <Minus className="w-3.5 h-3.5"/>
                        </button>
                    </div>

                    <div
                        className="flex flex-wrap items-center gap-1 pt-1 border-t border-slate-200/60 dark:border-white/[0.06]">
                        {blockToolbarItems.map((btn) => (
                            <button
                                key={btn.label}
                                type="button"
                                onClick={() =>
                                    btn.kind === "prefix"
                                        ? handleLinePrefix(btn.payload)
                                        : insertSnippet(btn.payload)
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-100 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] border border-slate-200/70 dark:border-white/[0.08] text-[11px] font-bold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                            >
                                {btn.icon}
                                <span>{btn.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Editor / Split / Preview Panes */}
            <div className={mode === "split" ? "grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch" : ""}>
                {showWritePane && (
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => handleTextareaChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onCompositionStart={handleCompositionStart}
                        onCompositionEnd={(e) => handleCompositionEnd(e.currentTarget.value)}
                        rows={18}
                        placeholder={UI_TEXT.WIKI.MARKDOWN_EDITOR.TEXTAREA_PLACEHOLDER}
                        className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 p-4 font-mono text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#003876]/40 dark:focus:ring-blue-500/40 resize-y min-h-[360px] max-h-[640px]"
                    />
                )}

                {showPreviewPane && (
                    <div
                        className={`rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 p-5 min-h-[360px] ${
                            mode === "split" ? "max-h-[640px] overflow-y-auto custom-scrollbar" : ""
                        }`}
                    >
                        {value.trim() ? (
                            <WikiMarkdownRenderer markdown={value}/>
                        ) : (
                            <p className="text-xs font-medium text-slate-400">
                                {UI_TEXT.WIKI.MARKDOWN_EDITOR.EMPTY_PREVIEW}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Bottom Status Bar */}
            <div
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/70 dark:border-white/[0.06] text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <div className="flex flex-wrap items-center gap-2.5 tabular-nums">
                    <span>{UI_TEXT.WIKI.MARKDOWN_EDITOR.STATS_LINES(stats.lines.toLocaleString())}</span>
                    <span>{UI_TEXT.WIKI.MARKDOWN_EDITOR.STATS_CHARS(stats.chars.toLocaleString(), stats.charsNoSpace.toLocaleString())}</span>
                    {stats.structured.linkedRouteCount > 0 && (
                        <span>{UI_TEXT.WIKI.MARKDOWN_EDITOR.STATS_ROUTES(stats.structured.linkedRouteCount)}</span>
                    )}
                    {stats.structured.boardingStopCount > 0 && (
                        <span>{UI_TEXT.WIKI.MARKDOWN_EDITOR.STATS_STOPS(stats.structured.boardingStopCount)}</span>
                    )}
                    {stats.structured.hasShuttle && <span>{UI_TEXT.WIKI.MARKDOWN_EDITOR.STATS_HAS_SHUTTLE}</span>}
                </div>
                <span className="text-[10.5px] text-slate-400 dark:text-slate-500">
                    {UI_TEXT.WIKI.MARKDOWN_EDITOR.SHORTCUT_HINT}
                </span>
            </div>
        </div>
    );
};
