"use client";

import React, {useState} from "react";
import {
    DEFAULT_WIKI_PIN_COLOR,
    isValidWikiSlug,
    normalizeWikiSlug,
    useWikiNickname,
    type WikiPageDocument,
    type WikiPinColor,
} from "@entities/wiki";
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
}

const DEFAULT_MARKDOWN_TEMPLATE = `## 개요
이 장소·정류장·노선에 대한 핵심 이용 안내를 적어 주세요.

> [!TIP]
> 첫차·막차 혼잡 시간대나 탑승 위치를 공유하면 큰 도움이 됩니다.

## 주요 이용 팁
- 상단 툴바의 **노선 카드 / 셔틀 시간표 / 승강장** 버튼을 눌러 마크다운 블록을 추가할 수 있습니다.
`;

export const WikiCreateForm: React.FC<WikiCreateFormProps> = ({
                                                                  initialSlug = "",
                                                                  initialLat,
                                                                  initialLng,
                                                                  initialPinColor = DEFAULT_WIKI_PIN_COLOR,
                                                                  initialDraft,
                                                                  onCreated,
                                                                  onCancel,
                                                                  onPickOnMap,
                                                              }) => {
    const {storedNickname, saveNickname} = useWikiNickname();

    const initialNormalized = normalizeWikiSlug(initialDraft?.title ?? initialSlug);
    const [title, setTitle] = useState(
        initialDraft?.title ?? (initialNormalized || initialSlug.trim()),
    );
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
    const [summary, setSummary] = useState(initialDraft?.summary ?? "새 위키 문서 생성");
    const [honeypot, setHoneypot] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const derivedSlug = normalizeWikiSlug(title);

    const handleCreate = async () => {
        if (isSaving) return;
        if (!isValidWikiSlug(derivedSlug)) {
            setErrorMessage(
                "문서 제목(슬러그)은 2~80자여야 하며 예약어(new, edit, api 등)나 URL 특수문자(/ ? # %)를 사용할 수 없습니다.",
            );
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
                    summary: summary.trim() || "새 위키 문서 생성",
                    website: honeypot,
                }),
            });

            const body = await res.json().catch(() => null);
            if (!res.ok) {
                setErrorMessage(body?.error || `문서 생성에 실패했습니다. (${res.status})`);
                return;
            }

            if (nickname.trim()) {
                saveNickname(nickname.trim());
            }

            const created = (body?.document ?? body) as WikiPageDocument;
            await onCreated(created);
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : "문서 생성 중 오류가 발생했습니다.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-5">
            <div
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 p-4 sm:p-5 shadow-sm space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                            <label
                                htmlFor="wiki-create-title"
                                className="block text-[11px] font-bold text-slate-500 dark:text-slate-400"
                            >
                                문서 제목 * (한국어 제목이 그대로 문서 키가 됩니다)
                            </label>
                            <span
                                className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-full">
                                #{derivedSlug || "문서 제목"}
                            </span>
                        </div>
                        <input
                            id="wiki-create-title"
                            name="title"
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="예: OO역 환승 정류장 안내"
                            maxLength={80}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-black text-slate-900 dark:text-slate-100"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="wiki-create-subtitle"
                            className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1"
                        >
                            한 줄 부제목
                        </label>
                        <input
                            id="wiki-create-subtitle"
                            name="subtitle"
                            type="text"
                            value={subtitle}
                            onChange={(e) => setSubtitle(e.target.value)}
                            placeholder="이 문서가 다루는 핵심 버스·정류장 정보를 한 줄로 요약하세요."
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
                        해시태그 (쉼표로 구분 · 최대 3개가 지도 핀에 표시됨)
                    </label>
                    <input
                        id="wiki-create-tags"
                        name="tags"
                        type="text"
                        value={tagsText}
                        onChange={(e) => setTagsText(e.target.value)}
                        placeholder="예: 정류장, 환승, 첫차팁"
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
                saveLabel="새 위키 문서 개설하기"
                onSave={() => void handleCreate()}
                onCancel={onCancel}
            />
        </div>
    );
};
