"use client";

import React, {useMemo, useRef, useState} from "react";
import {BookOpen, Camera, History, Lock, MapPin, MessageSquare, Move, PenLine, Plus, User,} from "lucide-react";

import {getKakaoRoadviewUrl} from "@entities/station";
import {
    mutateAllWikiQueries,
    useWikiDiscussions,
    useWikiNickname,
    useWikiPage,
    type WikiPageDocument,
} from "@entities/wiki";
import {
    WikiDiscussionPanel,
    WikiEditorForm,
    type WikiFormDraft,
    type WikiFormDraftActions,
    WikiHistoryPanel,
    WikiMarkdownRenderer,
    WikiUnsavedConfirmDialog,
} from "@features/wiki";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {Modal} from "@shared/ui";
import {LOCALE, UI_TEXT} from "@shared/config/locale";
import {triggerHaptic} from "@shared/utils/haptics";
import {resolveWikiPinTheme} from "../lib/wikiPinTheme";

export type WikiModalMode = "read" | "edit" | "history" | "discussion";

export interface WikiPinModalProps {
    slug: string | null;
    initialMode?: WikiModalMode;
    initialEditDraft?: Partial<WikiFormDraft> | null;
    onClose: () => void;
    onSelectSlug: (nextSlug: string) => void;
    onSelectRouteOnMap: (routeNo: string, cityCode: string) => void;
    onCreateNewFromSlug?: (slug: string) => void;
    onRequestMovePin?: (doc: WikiPageDocument) => void;
    onPickLocationInEditor?: (slug: string, draft: WikiFormDraft) => void;
}

type PendingExitAction =
    | { type: "close" }
    | { type: "mode"; mode: WikiModalMode };

function formatUpdatedAt(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString(LOCALE, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

export const WikiPinModal: React.FC<WikiPinModalProps> = ({
                                                              slug,
                                                              initialMode = "read",
                                                              initialEditDraft = null,
                                                              onClose,
                                                              onSelectSlug,
                                                              onSelectRouteOnMap,
                                                              onCreateNewFromSlug,
                                                              onRequestMovePin,
                                                              onPickLocationInEditor,
                                                          }) => {
    const isOpen = Boolean(slug);
    const {map} = useAppMapContext();
    const {storedNickname, saveNickname} = useWikiNickname();

    const {data: wikiDoc, error, isLoading, mutate} = useWikiPage(slug);
    const {data: discussionsData} = useWikiDiscussions(wikiDoc?.slug ?? null, isOpen && Boolean(wikiDoc));

    const [viewMode, setViewMode] = useState<WikiModalMode>(initialMode);
    const [editSessionId, setEditSessionId] = useState(0);
    const [isEditorDirty, setIsEditorDirty] = useState(false);
    const [pendingExit, setPendingExit] = useState<PendingExitAction | null>(null);
    const draftActionsRef = useRef<WikiFormDraftActions | null>(null);

    const openKey = `${slug ?? ""}:${initialMode}`;
    const [prevOpenKey, setPrevOpenKey] = useState<string>(openKey);
    if (openKey !== prevOpenKey) {
        setPrevOpenKey(openKey);
        setViewMode(initialMode);
        setIsEditorDirty(false);
        setPendingExit(null);
        if (initialMode === "edit") {
            setEditSessionId((n) => n + 1);
        }
    }

    const theme = useMemo(() => resolveWikiPinTheme(wikiDoc?.pinColor), [wikiDoc?.pinColor]);

    const applyModeChange = (nextMode: WikiModalMode) => {
        if (nextMode === "edit") {
            triggerHaptic("light");
            setEditSessionId((n) => n + 1);
        } else if (nextMode === "history" || nextMode === "discussion") {
            triggerHaptic("light");
        }
        setIsEditorDirty(false);
        setViewMode(nextMode);
    };

    const requestModeChange = (nextMode: WikiModalMode) => {
        if (nextMode === viewMode) return;
        if (viewMode === "edit" && isEditorDirty) {
            setPendingExit({type: "mode", mode: nextMode});
            return;
        }
        applyModeChange(nextMode);
    };

    const requestClose = () => {
        if (viewMode === "edit" && isEditorDirty) {
            setPendingExit({type: "close"});
            return;
        }
        onClose();
    };

    const executePendingExit = (saveDraftFirst: boolean) => {
        if (saveDraftFirst) {
            draftActionsRef.current?.saveDraft();
        } else {
            draftActionsRef.current?.clearDraft();
        }
        const action = pendingExit;
        setPendingExit(null);
        setIsEditorDirty(false);
        if (!action) return;
        if (action.type === "close") {
            onClose();
        } else {
            applyModeChange(action.mode);
        }
    };

    const handleFlyToPin = (doc: WikiPageDocument) => {
        if (!map || typeof doc.lat !== "number" || typeof doc.lng !== "number") return;
        triggerHaptic("light");
        map.flyTo({
            center: [doc.lng, doc.lat],
            zoom: Math.max(map.getZoom(), 15.5),
            duration: 650,
        });
        onClose();
    };

    const modalIcon = (
        <div
            className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl text-white shadow-sm shrink-0 ${theme.badgeBg}`}
        >
            <MapPin className="w-5 h-5"/>
        </div>
    );

    const headerSubtitle = useMemo(() => {
        if (!wikiDoc) return undefined;
        const hasTags = wikiDoc.tags.length > 0;
        const hasSubtitle = Boolean(wikiDoc.subtitle?.trim());
        if (!hasTags && !hasSubtitle) return undefined;

        return (
            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                {wikiDoc.tags.slice(0, 5).map((tag) => (
                    <span
                        key={tag}
                        className={`inline-flex items-center px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.08] text-[10.5px] font-bold ${theme.pillTextClass}`}
                    >
                        #{tag}
                    </span>
                ))}
                {hasSubtitle && (
                    <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate max-w-md">
                        {wikiDoc.subtitle}
                    </span>
                )}
            </div>
        );
    }, [wikiDoc, theme.pillTextClass]);

    const headerBadge = wikiDoc ? (
        <span
            className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-white/10 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-200 tabular-nums">
            v{wikiDoc.version}
        </span>
    ) : null;

    const openDiscussionCount = discussionsData?.openCount ?? 0;

    const headerActions = wikiDoc ? (
        <div className="flex items-center gap-1.5">
            <div
                className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-white/[0.06] p-0.5 border border-slate-200/60 dark:border-white/10">
                <button
                    type="button"
                    onClick={() => requestModeChange("read")}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                        viewMode === "read"
                            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                >
                    {UI_TEXT.WIKI.PIN_MODAL.MODE_READ}
                </button>
                <button
                    type="button"
                    onClick={() => requestModeChange("edit")}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                        viewMode === "edit"
                            ? `${theme.badgeBg} text-white shadow-xs`
                            : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    }`}
                >
                    <PenLine className="w-3 h-3"/>
                    {UI_TEXT.WIKI.PIN_MODAL.MODE_EDIT}
                </button>
                <button
                    type="button"
                    onClick={() => requestModeChange("history")}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                        viewMode === "history"
                            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                >
                    <History className="w-3 h-3"/>
                    <span>{UI_TEXT.WIKI.PIN_MODAL.MODE_HISTORY}</span>
                </button>
                <button
                    type="button"
                    onClick={() => requestModeChange("discussion")}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                        viewMode === "discussion"
                            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                >
                    <MessageSquare className="w-3 h-3"/>
                    <span>{UI_TEXT.WIKI.PIN_MODAL.MODE_DISCUSSION}</span>
                    {openDiscussionCount > 0 && (
                        <span
                            className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[9.5px] font-black tabular-nums">
                            {openDiscussionCount}
                        </span>
                    )}
                </button>
            </div>
        </div>
    ) : null;

    const modalFooter = wikiDoc ? (
        <>
            <div className="flex items-center gap-2 text-[11px] font-semibold truncate">
                <span className="inline-flex items-center gap-1 truncate">
                    <User className="w-3 h-3 shrink-0"/>
                    {wikiDoc.lastEditor.nickname}
                </span>
                <span className="hidden sm:inline">· {formatUpdatedAt(wikiDoc.updatedAt)}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <button
                    type="button"
                    onClick={requestClose}
                    className="px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black cursor-pointer hover:opacity-90 transition active:scale-95"
                >
                    {UI_TEXT.COMMON.CLOSE}
                </button>
            </div>
        </>
    ) : null;

    const errorStatus = (error as (Error & { status?: number }) | undefined)?.status;
    const blockImmediateExit = viewMode === "edit" && isEditorDirty;

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={requestClose}
                closeOnBackdropClick={!blockImmediateExit}
                closeOnEscape={!blockImmediateExit}
                title={wikiDoc?.title ?? slug ?? UI_TEXT.WIKI.PIN_MODAL.DEFAULT_TITLE}
                subtitle={headerSubtitle}
                icon={modalIcon}
                headerBadge={headerBadge}
                headerActions={headerActions}
                footer={modalFooter}
                maxWidth="full"
                height="full"
                zIndex="z-[120]"
                modalId="wiki-pin"
                ariaLabel={wikiDoc ? UI_TEXT.WIKI.PIN_MODAL.DOC_ARIA(wikiDoc.title) : UI_TEXT.WIKI.PIN_MODAL.DEFAULT_ARIA}
            >
                <div
                    className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 lg:px-8 space-y-6 custom-scrollbar select-text">
                    {isLoading && !wikiDoc && (
                        <div className="py-16 text-center space-y-2.5">
                            <div
                                className="w-8 h-8 mx-auto rounded-full border-2 border-[#003876] border-t-transparent animate-spin"/>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                {UI_TEXT.WIKI.PIN_MODAL.LOADING}
                            </p>
                        </div>
                    )}

                    {!isLoading && (error || !wikiDoc) && slug && (
                        <div className="py-12 text-center space-y-3.5 max-w-md mx-auto">
                            <div
                                className="w-12 h-12 mx-auto rounded-2xl bg-sky-100 dark:bg-sky-950/60 flex items-center justify-center text-sky-700 dark:text-sky-300">
                                <BookOpen className="w-6 h-6"/>
                            </div>
                            <h3 className="text-base font-black text-slate-900 dark:text-white">
                                {errorStatus === 404
                                    ? UI_TEXT.WIKI.PIN_MODAL.NOT_FOUND_TITLE
                                    : UI_TEXT.WIKI.PIN_MODAL.LOAD_ERROR_TITLE}
                            </h3>
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono">
                                    {slug}
                                </code>{" "}
                                {UI_TEXT.WIKI.PIN_MODAL.CREATE_FROM_SLUG_DESC}
                            </p>
                            {onCreateNewFromSlug && (
                                <button
                                    type="button"
                                    onClick={() => onCreateNewFromSlug(slug)}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#003876] hover:bg-[#00295a] dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-black transition cursor-pointer"
                                >
                                    <Plus className="w-3.5 h-3.5"/>
                                    <span>{UI_TEXT.WIKI.PIN_MODAL.CREATE_FROM_SLUG_BTN}</span>
                                </button>
                            )}
                        </div>
                    )}

                    {wikiDoc && viewMode === "edit" && (
                        <div className="max-w-6xl mx-auto">
                            <WikiEditorForm
                                key={`${wikiDoc.slug}:${wikiDoc.version}:${editSessionId}:${initialEditDraft?.lat ?? ""}:${initialEditDraft?.lng ?? ""}`}
                                doc={wikiDoc}
                                initialNickname={storedNickname}
                                initialDraft={initialEditDraft ?? undefined}
                                onSaveNickname={saveNickname}
                                onDirtyChange={setIsEditorDirty}
                                actionsRef={draftActionsRef}
                                onSaved={async (saved) => {
                                    setIsEditorDirty(false);
                                    await mutate(saved, false);
                                    await mutateAllWikiQueries().catch(() => []);
                                    if (saved.slug !== slug) {
                                        onSelectSlug(saved.slug);
                                    }
                                    setViewMode("read");
                                }}
                                onCancel={() => requestModeChange("read")}
                                onReloadLatest={async () => {
                                    setIsEditorDirty(false);
                                    await mutate();
                                    setEditSessionId((n) => n + 1);
                                }}
                                onPickOnMap={
                                    onPickLocationInEditor
                                        ? (draft) => {
                                            setIsEditorDirty(false);
                                            onPickLocationInEditor(wikiDoc.slug, draft);
                                        }
                                        : undefined
                                }
                            />
                        </div>
                    )}

                    {wikiDoc && viewMode === "history" && (
                        <div className="max-w-5xl mx-auto">
                            <WikiHistoryPanel
                                slug={wikiDoc.slug}
                                currentVersion={wikiDoc.version}
                                nickname={storedNickname}
                                isProtected={Boolean(wikiDoc.isProtected)}
                                onReverted={async () => {
                                    await mutate();
                                    await mutateAllWikiQueries().catch(() => []);
                                    setViewMode("read");
                                }}
                            />
                        </div>
                    )}

                    {wikiDoc && viewMode === "discussion" && (
                        <div className="max-w-5xl mx-auto">
                            <WikiDiscussionPanel
                                slug={wikiDoc.slug}
                                initialNickname={storedNickname}
                                onSaveNickname={saveNickname}
                                onOpenWikiSlug={(targetSlug) => {
                                    triggerHaptic("light");
                                    onSelectSlug(targetSlug);
                                }}
                                onSelectRoute={(routeNo, targetCityCode) => {
                                    triggerHaptic("selection");
                                    onSelectRouteOnMap(routeNo, targetCityCode);
                                    onClose();
                                }}
                            />
                        </div>
                    )}

                    {wikiDoc && viewMode === "read" && (
                        <div className="max-w-5xl mx-auto space-y-5">
                            {/* Badges, Hashtags & Map Pin Actions */}
                            <div className="flex flex-wrap items-center justify-between gap-2.5">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    {wikiDoc.isProtected && (
                                        <span
                                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                                            <Lock className="w-3 h-3"/>
                                            {UI_TEXT.WIKI.PIN_MODAL.PROTECTED_DOC}
                                        </span>
                                    )}
                                    {wikiDoc.tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-white/[0.06] text-[11px] font-bold text-slate-600 dark:text-slate-300"
                                        >
                                            #{tag}
                                        </span>
                                    ))}
                                </div>

                                {typeof wikiDoc.lat === "number" && typeof wikiDoc.lng === "number" && (
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => handleFlyToPin(wikiDoc)}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 text-[11px] font-black text-emerald-700 dark:text-emerald-300 transition cursor-pointer"
                                        >
                                            <MapPin className="w-3 h-3"/>
                                            <span>{UI_TEXT.WIKI.PIN_MODAL.VIEW_ON_MAP}</span>
                                        </button>
                                        {onRequestMovePin && !wikiDoc.isProtected && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    triggerHaptic("light");
                                                    onRequestMovePin(wikiDoc);
                                                }}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] border border-slate-200 dark:border-white/10 text-[11px] font-black text-slate-700 dark:text-slate-200 transition cursor-pointer"
                                            >
                                                <Move className="w-3 h-3"/>
                                                <span>{UI_TEXT.WIKI.PIN_MODAL.MOVE_PIN}</span>
                                            </button>
                                        )}
                                        <a
                                            href={getKakaoRoadviewUrl(wikiDoc.lat, wikiDoc.lng)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 text-[11px] font-black text-amber-700 dark:text-amber-300 transition"
                                        >
                                            <Camera className="w-3 h-3"/>
                                            <span>{UI_TEXT.WIKI.PIN_MODAL.ROADVIEW}</span>
                                        </a>
                                    </div>
                                )}
                            </div>

                            {/* Unified Markdown Article Body */}
                            <section
                                className="rounded-2xl p-4 sm:p-6 bg-white dark:bg-slate-900/60 border border-slate-200/85 dark:border-white/10 space-y-4">
                                <div
                                    className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-white/[0.07]">
                                    <div className="flex items-center gap-1.5">
                                        <BookOpen className="w-4 h-4 text-[#003876] dark:text-sky-400"/>
                                        <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                            {UI_TEXT.WIKI.PIN_MODAL.BODY_TITLE}
                                        </h3>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <button
                                            type="button"
                                            onClick={() => requestModeChange("discussion")}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.07] dark:hover:bg-white/[0.12] text-[11px] font-black text-slate-700 dark:text-slate-200 cursor-pointer"
                                        >
                                            <MessageSquare className="w-3 h-3"/>
                                            <span>{UI_TEXT.WIKI.PIN_MODAL.MODE_DISCUSSION}{openDiscussionCount > 0 ? ` (${openDiscussionCount})` : ""}</span>
                                        </button>
                                        {!wikiDoc.isProtected && (
                                            <button
                                                type="button"
                                                onClick={() => applyModeChange("edit")}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/50 text-[11px] font-black text-[#003876] dark:text-sky-300 cursor-pointer"
                                            >
                                                <PenLine className="w-3 h-3"/>
                                                {UI_TEXT.WIKI.PIN_MODAL.EDIT_ACTION}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <WikiMarkdownRenderer
                                    markdown={wikiDoc.markdownBody}
                                    onOpenWikiSlug={(targetSlug) => {
                                        triggerHaptic("light");
                                        onSelectSlug(targetSlug);
                                    }}
                                    onSelectRoute={(routeNo, targetCityCode) => {
                                        triggerHaptic("selection");
                                        onSelectRouteOnMap(routeNo, targetCityCode);
                                        onClose();
                                    }}
                                />
                            </section>
                        </div>
                    )}
                </div>
            </Modal>

            <WikiUnsavedConfirmDialog
                isOpen={pendingExit !== null}
                onContinueEditing={() => setPendingExit(null)}
                onSaveDraftAndLeave={() => executePendingExit(true)}
                onDiscardAndLeave={() => executePendingExit(false)}
            />
        </>
    );
};
