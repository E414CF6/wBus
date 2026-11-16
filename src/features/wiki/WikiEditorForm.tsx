"use client";

import React, {useState} from "react";
import {DEFAULT_WIKI_PIN_COLOR, normalizeWikiSlug, type WikiPageDocument, type WikiPinColor,} from "@entities/wiki";
import type {WikiFormDraft} from "./WikiCreateForm";
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

    const submitSave = async (overrideBaseVersion?: number) => {
        if (isSaving) return;

        setIsSaving(true);
        setErrorMessage(null);
        setConflictVersion(null);

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
                setErrorMessage(body.error || "다른 사용자가 먼저 이 문서를 수정했습니다.");
                return;
            }
            if (!res.ok) {
                setErrorMessage(body?.error || `저장에 실패했습니다. (${res.status})`);
                return;
            }

            if (nickname.trim()) {
                onSaveNickname(nickname.trim());
            }
            await onSaved(body.document as WikiPageDocument);
        } catch (err) {
            setErrorMessage(
                err instanceof Error ? err.message : "저장 중 네트워크 오류가 발생했습니다.",
            );
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-5">
            {/* Basic metadata editor */}
            <div
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 p-4 sm:p-5 shadow-sm space-y-4">
                <div
                    className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        <span className="text-xs font-black text-sky-700 dark:text-sky-400">
                            문서 편집 모드 · 기준 v{baseVersion}
                        </span>
                        <h2 className="text-base font-black text-slate-900 dark:text-white mt-0.5">
                            기본 정보 &amp; 통합 마크다운 편집
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
                            문서 제목 * (제목 변경 시 문서 키도 함께 변경됩니다)
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
                            한 줄 부제목
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
                        해시태그 (쉼표로 구분 · 최대 3개가 지도 핀에 표시됨)
                    </label>
                    <input
                        id="wiki-edit-tags"
                        name="tags"
                        type="text"
                        value={tagsText}
                        onChange={(e) => setTagsText(e.target.value)}
                        placeholder="예: 정류장, 환승, 첫차팁"
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

            <WikiMarkdownEditor value={markdownBody} onChange={setMarkdownBody}/>

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
                isProtected={Boolean(doc.isProtected)}
                onReloadLatest={async () => {
                    await onReloadLatest();
                }}
                onForceOverwrite={() => {
                    if (conflictVersion) {
                        setBaseVersion(conflictVersion);
                        void submitSave(conflictVersion);
                    }
                }}
                onSave={() => void submitSave()}
                onCancel={onCancel}
            />
        </div>
    );
};
