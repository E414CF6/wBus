"use client";

import React, {useCallback, useMemo, useState} from "react";
import {
    DEFAULT_WIKI_PIN_COLOR,
    isValidWikiSlug,
    normalizeWikiSlug,
    useWikiNickname,
    type WikiPageDocument,
    type WikiPinColor,
} from "@entities/wiki";
import {UI_TEXT} from "@shared/config/locale";
import {getWikiCreateDraftKey, type WikiLocalDraft} from "./lib/wikiLocalDraft";
import {useWikiDraftPersistence, type WikiFormDraftActions} from "./lib/useWikiDraftPersistence";
import {WikiDraftBanner} from "./WikiDraftBanner";
import {WikiEditMetaBar} from "./WikiEditMetaBar";
import {WikiMarkdownEditor} from "./WikiMarkdownEditor";
import {WikiPinColorSelector} from "./WikiPinColorSelector";
import {WikiPinLocationFields} from "./WikiPinLocationFields";

export interface WikiFormDraft {
    title: string;
    subtitle: string;
    pinColor: WikiPinColor;
    tagsText: string;
    markdownBody: string;
    lat?: number;
    lng?: number;
    summary?: string;
}

export interface WikiCreateFormProps {
    initialSlug?: string;
    initialLat?: number;
    initialLng?: number;
    initialPinColor?: WikiPinColor;
    initialDraft?: Partial<WikiFormDraft>;
    onCreated: (created: WikiPageDocument) => void | Promise<void>;
    onCancel: () => void;
    onPickOnMap?: (draft: WikiFormDraft) => void;
    onDirtyChange?: (dirty: boolean) => void;
    actionsRef?: React.RefObject<WikiFormDraftActions | null>;
}

const DEFAULT_MARKDOWN_TEMPLATE = UI_TEXT.WIKI.CREATE_FORM.DEFAULT_MARKDOWN_TEMPLATE;

export const WikiCreateForm: React.FC<WikiCreateFormProps> = ({
    initialSlug = "",
    initialLat,
    initialLng,
    initialPinColor = DEFAULT_WIKI_PIN_COLOR,
    initialDraft,
    onCreated,
    onCancel,
    onPickOnMap,
    onDirtyChange,
    actionsRef,
}) => {
    const {storedNickname, saveNickname} = useWikiNickname();

    const initialNormalized = normalizeWikiSlug(initialDraft?.title ?? initialSlug);
    const defaultTitle = initialNormalized || initialSlug.trim();
    const [title, setTitle] = useState(initialDraft?.title ?? defaultTitle);
    const [subtitle, setSubtitle] = useState(initialDraft?.subtitle ?? "");
    const [pinColor, setPinColor] = useState<WikiPinColor>(
        initialDraft?.pinColor ?? initialPinColor,
    );
    const [lat, setLat] = useState<number | undefined>(initialLat ?? initialDraft?.lat);
    const [lng, setLng] = useState<number | undefined>(initialLng ?? initialDraft?.lng);
    const [tagsText, setTagsText] = useState(initialDraft?.tagsText ?? "");
    const [markdownBody, setMarkdownBody] = useState(
        initialDraft?.markdownBody ?? DEFAULT_MARKDOWN_TEMPLATE,
    );
    const [nickname, setNickname] = useState(storedNickname);
    const [summary, setSummary] = useState(initialDraft?.summary ?? UI_TEXT.WIKI.CREATE_FORM.DEFAULT_SUMMARY);
    const [honeypot, setHoneypot] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const baselineDraft = useMemo<WikiFormDraft>(
        () => ({
            title: defaultTitle,
            subtitle: "",
            pinColor: initialPinColor,
            tagsText: "",
            markdownBody: DEFAULT_MARKDOWN_TEMPLATE,
            lat: initialLat,
            lng: initialLng,
            summary: UI_TEXT.WIKI.CREATE_FORM.DEFAULT_SUMMARY,
        }),
        [defaultTitle, initialPinColor, initialLat, initialLng],
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
        if (typeof draft.lat === "number" && typeof draft.lng === "number") {
            setLat(draft.lat);
            setLng(draft.lng);
        }
        setSummary(draft.summary || UI_TEXT.WIKI.CREATE_FORM.DEFAULT_SUMMARY);
    }, []);

    const {
        recoverableDraft,
        draftStatusLabel,
        saveDraftNow,
        restoreDraft,
        discardDraft,
        clearDraft,
    } = useWikiDraftPersistence({
        draftKey: getWikiCreateDraftKey(initialSlug),
        baselineDraft,
        currentDraft,
        skipInitialRestore: Boolean(initialDraft),
        onApplyDraft: applyLocalDraft,
        onDirtyChange,
        actionsRef,
    });

    const derivedSlug = normalizeWikiSlug(title);

    const handleCreate = async () => {
        if (isSaving) return;
        if (!isValidWikiSlug(derivedSlug)) {
            setErrorMessage(UI_TEXT.WIKI.CREATE_FORM.INVALID_SLUG_ERROR);
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);

        const cleanedTags = tagsText
            .split(",")
            .map((t) => t.trim().replace(/^#+/, ""))
            .filter(Boolean)
            .slice(0, 12);

        const hasCoords =
            typeof lat === "number" &&
            Number.isFinite(lat) &&
            typeof lng === "number" &&
            Number.isFinite(lng);

        try {
            const res = await fetch("/api/wiki", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    slug: derivedSlug,
                    title: derivedSlug,
                    subtitle: subtitle.trim(),
                    pinColor,
                    ...(hasCoords ? {lat, lng} : {}),
                    tags: cleanedTags,
                    markdownBody,
                    nickname: nickname.trim(),
                    summary: summary.trim() || UI_TEXT.WIKI.CREATE_FORM.DEFAULT_SUMMARY,
                    website: honeypot,
                }),
            });

            const body = await res.json().catch(() => null);
            if (!res.ok) {
                setErrorMessage(body?.error || UI_TEXT.WIKI.CREATE_FORM.CREATE_FAILED_STATUS(res.status));
                return;
            }

            clearDraft();
            if (nickname.trim()) {
                saveNickname(nickname.trim());
            }

            const created = (body?.document ?? body) as WikiPageDocument;
            await onCreated(created);
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : UI_TEXT.WIKI.CREATE_FORM.CREATE_FAILED_GENERIC);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-5">
            {recoverableDraft && (
                <WikiDraftBanner
                    draft={recoverableDraft}
                    onRestore={restoreDraft}
                    onDiscard={discardDraft}
                />
            )}

            <div
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 p-4 sm:p-5 shadow-sm space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                            <label
                                htmlFor="wiki-create-title"
                                className="block text-[11px] font-bold text-slate-500 dark:text-slate-400"
                            >
                                {UI_TEXT.WIKI.CREATE_FORM.TITLE_LABEL}
                            </label>
                            <span
                                className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-full">
                                #{derivedSlug || UI_TEXT.WIKI.CREATE_FORM.TITLE_FALLBACK_SLUG}
                            </span>
                        </div>
                        <input
                            id="wiki-create-title"
                            name="title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder={UI_TEXT.WIKI.CREATE_FORM.TITLE_PLACEHOLDER}
                            maxLength={80}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-black text-slate-900 dark:text-slate-100"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="wiki-create-subtitle"
                            className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1"
                        >
                            {UI_TEXT.WIKI.CREATE_FORM.SUBTITLE_LABEL}
                        </label>
                        <input
                            id="wiki-create-subtitle"
                            name="subtitle"
                            type="text"
                            value={subtitle}
                            onChange={(e) => setSubtitle(e.target.value)}
                            placeholder={UI_TEXT.WIKI.CREATE_FORM.SUBTITLE_PLACEHOLDER}
                            maxLength={160}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm text-slate-900 dark:text-slate-100"
                        />
                    </div>
                </div>

                <div>
                    <label
                        htmlFor="wiki-create-tags"
                        className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1"
                    >
                        {UI_TEXT.WIKI.CREATE_FORM.TAGS_LABEL}
                    </label>
                    <input
                        id="wiki-create-tags"
                        name="tags"
                        type="text"
                        value={tagsText}
                        onChange={(e) => setTagsText(e.target.value)}
                        placeholder={UI_TEXT.WIKI.CREATE_FORM.TAGS_PLACEHOLDER}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-900 dark:text-slate-100"
                    />
                </div>

                <WikiPinColorSelector id="wiki-create-pin-color" value={pinColor} onChange={setPinColor}/>

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
                saveLabel={UI_TEXT.WIKI.CREATE_FORM.SUBMIT_LABEL}
                onSaveDraft={saveDraftNow}
                onSave={() => void handleCreate()}
                onCancel={onCancel}
            />
        </div>
    );
};
