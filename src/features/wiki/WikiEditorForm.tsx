"use client";

import React, {useCallback, useMemo, useState} from "react";
import {DEFAULT_WIKI_PIN_COLOR, normalizeWikiSlug, type WikiPageDocument, type WikiPinColor,} from "@entities/wiki";
import {UI_TEXT} from "@shared/config/locale";
import type {WikiFormDraft} from "./WikiCreateForm";
import {getWikiEditDraftKey, type WikiLocalDraft} from "./lib/wikiLocalDraft";
import {useWikiDraftPersistence, type WikiFormDraftActions} from "./lib/useWikiDraftPersistence";
import {WikiDraftBanner} from "./WikiDraftBanner";
import {WikiEditMetaBar} from "./WikiEditMetaBar";
import {WikiMarkdownEditor} from "./WikiMarkdownEditor";
import {WikiPinColorSelector} from "./WikiPinColorSelector";
import {WikiPinLocationFields} from "./WikiPinLocationFields";

export interface WikiEditorFormProps {
    doc: WikiPageDocument;
    initialNickname: string;
    initialDraft?: Partial<WikiFormDraft>;
    onSaveNickname: (nickname: string) => void;
    onSaved: (saved: WikiPageDocument) => Promise<void> | void;
    onCancel: () => void;
    onReloadLatest: () => Promise<void>;
    onPickOnMap?: (draft: WikiFormDraft) => void;
    onDirtyChange?: (dirty: boolean) => void;
    actionsRef?: React.RefObject<WikiFormDraftActions | null>;
}

export const WikiEditorForm: React.FC<WikiEditorFormProps> = ({
                                                                  doc,
                                                                  initialNickname,
                                                                  initialDraft,
                                                                  onSaveNickname,
                                                                  onSaved,
                                                                  onCancel,
                                                                  onReloadLatest,
                                                                  onPickOnMap,
                                                                  onDirtyChange,
                                                                  actionsRef,
                                                              }) => {
    const [baseVersion, setBaseVersion] = useState(doc.version);
    const [title, setTitle] = useState(initialDraft?.title ?? doc.title);
    const [subtitle, setSubtitle] = useState(initialDraft?.subtitle ?? doc.subtitle);
    const [pinColor, setPinColor] = useState<WikiPinColor>(
        initialDraft?.pinColor ?? doc.pinColor ?? DEFAULT_WIKI_PIN_COLOR,
    );
    const [lat, setLat] = useState<number | undefined>(
        initialDraft && "lat" in initialDraft ? initialDraft.lat : doc.lat,
    );
    const [lng, setLng] = useState<number | undefined>(
        initialDraft && "lng" in initialDraft ? initialDraft.lng : doc.lng,
    );
    const [tagsText, setTagsText] = useState(initialDraft?.tagsText ?? doc.tags.join(", "));
    const [markdownBody, setMarkdownBody] = useState(
        initialDraft?.markdownBody ?? doc.markdownBody,
    );
    const [nickname, setNickname] = useState(initialNickname);
    const [summary, setSummary] = useState(initialDraft?.summary ?? "");
    const [honeypot, setHoneypot] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [conflictVersion, setConflictVersion] = useState<number | null>(null);
    const [conflictDoc, setConflictDoc] = useState<WikiPageDocument | null>(null);

    const baselineDraft = useMemo<WikiFormDraft>(
        () => ({
            title: doc.title,
            subtitle: doc.subtitle,
            pinColor: doc.pinColor ?? DEFAULT_WIKI_PIN_COLOR,
            tagsText: doc.tags.join(", "),
            markdownBody: doc.markdownBody,
            lat: doc.lat,
            lng: doc.lng,
            summary: "",
        }),
        [doc],
    );

    const currentDraft = useMemo<WikiFormDraft>(
        () => ({
            title,
            subtitle,
            pinColor,
            tagsText,
            markdownBody,
            lat,
            lng,
            summary,
        }),
        [title, subtitle, pinColor, tagsText, markdownBody, lat, lng, summary],
    );

    const applyLocalDraft = useCallback((draft: WikiLocalDraft) => {
        setTitle(draft.title);
        setSubtitle(draft.subtitle);
        setPinColor(draft.pinColor);
        setTagsText(draft.tagsText);
        setMarkdownBody(draft.markdownBody);
        setLat(draft.lat);
        setLng(draft.lng);
        setSummary(draft.summary ?? "");
    }, []);

    const {
        recoverableDraft,
        draftStatusLabel,
        saveDraftNow,
        restoreDraft,
        discardDraft,
        clearDraft,
    } = useWikiDraftPersistence({
        draftKey: getWikiEditDraftKey(doc.slug),
        baselineDraft,
        currentDraft,
        baseVersion,
        skipInitialRestore: Boolean(initialDraft),
        onApplyDraft: applyLocalDraft,
        onDirtyChange,
        actionsRef,
    });

    const cleanedTags = useMemo(
        () =>
            tagsText
                .split(",")
                .map((t) => t.trim().replace(/^#+/, ""))
                .filter(Boolean)
                .slice(0, 12),
        [tagsText],
    );

    const localDraftDoc = useMemo<WikiPageDocument>(() => {
        const hasCoords =
            typeof lat === "number" &&
            Number.isFinite(lat) &&
            typeof lng === "number" &&
            Number.isFinite(lng);
        return {
            ...doc,
            title: normalizeWikiSlug(title) || title,
            subtitle,
            pinColor,
            ...(hasCoords ? {lat, lng} : {lat: undefined, lng: undefined}),
            tags: cleanedTags,
            markdownBody,
        };
    }, [doc, title, subtitle, pinColor, lat, lng, cleanedTags, markdownBody]);

    const applyConflictServerDoc = useCallback(() => {
        if (!conflictDoc) return;
        setBaseVersion(conflictDoc.version);
        setTitle(conflictDoc.title);
        setSubtitle(conflictDoc.subtitle);
        setPinColor(conflictDoc.pinColor ?? DEFAULT_WIKI_PIN_COLOR);
        setLat(conflictDoc.lat);
        setLng(conflictDoc.lng);
        setTagsText(conflictDoc.tags.join(", "));
        setMarkdownBody(conflictDoc.markdownBody);
        setConflictVersion(null);
        setConflictDoc(null);
        setErrorMessage(null);
    }, [conflictDoc]);

    const submitSave = async (overrideBaseVersion?: number) => {
        if (isSaving) return;

        setIsSaving(true);
        setErrorMessage(null);
        setConflictVersion(null);
        setConflictDoc(null);

        const hasCoords =
            typeof lat === "number" &&
            Number.isFinite(lat) &&
            typeof lng === "number" &&
            Number.isFinite(lng);

        try {
            const res = await fetch(`/api/wiki/${encodeURIComponent(doc.slug)}`, {
                method: "PUT",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    baseVersion: overrideBaseVersion ?? baseVersion,
                    title,
                    subtitle,
                    pinColor,
                    lat: hasCoords ? lat : null,
                    lng: hasCoords ? lng : null,
                    tags: cleanedTags,
                    markdownBody,
                    nickname: nickname.trim(),
                    summary: summary.trim(),
                    website: honeypot,
                }),
            });

            const body = await res.json().catch(() => null);
            if (res.status === 409 && body?.currentVersion) {
                setConflictVersion(Number(body.currentVersion));
                setConflictDoc((body.latestDocument as WikiPageDocument | undefined) ?? null);
                setErrorMessage(body.error || UI_TEXT.WIKI.EDIT_FORM.CONFLICT_DEFAULT);
                return;
            }
            if (!res.ok) {
                setErrorMessage(body?.error || UI_TEXT.WIKI.EDIT_FORM.SAVE_FAILED_STATUS(res.status));
                return;
            }

            clearDraft();
            if (nickname.trim()) {
                onSaveNickname(nickname.trim());
            }
            await onSaved(body.document as WikiPageDocument);
        } catch (err) {
            setErrorMessage(
                err instanceof Error ? err.message : UI_TEXT.WIKI.EDIT_FORM.SAVE_FAILED_NETWORK,
            );
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-5">
            {recoverableDraft && (
                <WikiDraftBanner
                    draft={recoverableDraft}
                    currentVersion={doc.version}
                    onRestore={restoreDraft}
                    onDiscard={discardDraft}
                />
            )}

            {/* Basic metadata editor */}
            <div
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 p-4 sm:p-5 shadow-sm space-y-4">
                <div
                    className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        <span className="text-xs font-black text-sky-700 dark:text-sky-400">
                            {UI_TEXT.WIKI.EDIT_FORM.MODE_BADGE(baseVersion)}
                        </span>
                        <h2 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                            {UI_TEXT.WIKI.EDIT_FORM.HEADING}
                        </h2>
                    </div>
                    <span
                        className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        #{normalizeWikiSlug(title) || doc.slug}
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label
                            htmlFor="wiki-edit-title"
                            className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1"
                        >
                            {UI_TEXT.WIKI.EDIT_FORM.TITLE_LABEL}
                        </label>
                        <input
                            id="wiki-edit-title"
                            name="title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={80}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-black text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                        />
                    </div>
                    <div>
                        <label
                            htmlFor="wiki-edit-subtitle"
                            className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1"
                        >
                            {UI_TEXT.WIKI.EDIT_FORM.SUBTITLE_LABEL}
                        </label>
                        <input
                            id="wiki-edit-subtitle"
                            name="subtitle"
                            type="text"
                            value={subtitle}
                            onChange={(e) => setSubtitle(e.target.value)}
                            maxLength={160}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                        />
                    </div>
                </div>

                <div>
                    <label
                        htmlFor="wiki-edit-tags"
                        className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1"
                    >
                        {UI_TEXT.WIKI.EDIT_FORM.TAGS_LABEL}
                    </label>
                    <input
                        id="wiki-edit-tags"
                        name="tags"
                        type="text"
                        value={tagsText}
                        onChange={(e) => setTagsText(e.target.value)}
                        placeholder={UI_TEXT.WIKI.EDIT_FORM.TAGS_PLACEHOLDER}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-900 dark:text-slate-100"
                    />
                </div>

                <WikiPinColorSelector id="wiki-edit-pin-color" value={pinColor} onChange={setPinColor}/>

                <WikiPinLocationFields
                    lat={lat}
                    lng={lng}
                    onClear={() => {
                        setLat(undefined);
                        setLng(undefined);
                    }}
                    onPickOnMap={
                        onPickOnMap
                            ? () =>
                                onPickOnMap({
                                    title,
                                    subtitle,
                                    pinColor,
                                    tagsText,
                                    markdownBody,
                                    lat,
                                    lng,
                                    summary,
                                })
                            : undefined
                    }
                />
            </div>

            <WikiMarkdownEditor
                value={markdownBody}
                onChange={setMarkdownBody}
                onSaveDraft={saveDraftNow}
                draftStatusLabel={draftStatusLabel}
            />

            <WikiEditMetaBar
                nickname={nickname}
                onNicknameChange={setNickname}
                summary={summary}
                onSummaryChange={setSummary}
                honeypot={honeypot}
                onHoneypotChange={setHoneypot}
                isSaving={isSaving}
                errorMessage={errorMessage}
                conflictVersion={conflictVersion}
                conflictDoc={conflictDoc}
                localDraftDoc={localDraftDoc}
                isProtected={Boolean(doc.isProtected)}
                onReloadLatest={async () => {
                    clearDraft();
                    await onReloadLatest();
                }}
                onApplyConflictServerDoc={applyConflictServerDoc}
                onForceOverwrite={() => {
                    if (conflictVersion) {
                        setBaseVersion(conflictVersion);
                        void submitSave(conflictVersion);
                    }
                }}
                onSaveDraft={saveDraftNow}
                onSave={() => void submitSave()}
                onCancel={onCancel}
            />
        </div>
    );
};
