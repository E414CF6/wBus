"use client";

import React, {useState} from "react";
import {NATIONWIDE_CITIES} from "@entities/city";
import {
    normalizeWikiSlug,
    WIKI_CATEGORIES,
    WIKI_CATEGORY_LABELS,
    type WikiBoardingStop,
    type WikiCategory,
    type WikiLinkedRoute,
    type WikiPageDocument,
    type WikiShuttleBlock,
} from "@entities/wiki";
import {WikiEditMetaBar} from "./WikiEditMetaBar";
import {WikiMarkdownEditor} from "./WikiMarkdownEditor";
import {WikiPinLocationFields} from "./WikiPinLocationFields";
import {WikiRoutesEditor} from "./WikiRoutesEditor";
import {WikiShuttleEditor} from "./WikiShuttleEditor";
import {WikiStopsEditor} from "./WikiStopsEditor";

export interface WikiEditorFormProps {
    doc: WikiPageDocument;
    initialNickname: string;
    onSaveNickname: (nickname: string) => void;
    onSaved: (saved: WikiPageDocument) => Promise<void> | void;
    onCancel: () => void;
    onReloadLatest: () => Promise<void>;
}

export const WikiEditorForm: React.FC<WikiEditorFormProps> = ({
                                                                  doc,
                                                                  initialNickname,
                                                                  onSaveNickname,
                                                                  onSaved,
                                                                  onCancel,
                                                                  onReloadLatest,
                                                              }) => {
    const [baseVersion, setBaseVersion] = useState(doc.version);
    const [title, setTitle] = useState(doc.title);
    const [subtitle, setSubtitle] = useState(doc.subtitle);
    const [category, setCategory] = useState<WikiCategory>(doc.category);
    const [cityCode, setCityCode] = useState(doc.cityCode ?? "");
    const [latText, setLatText] = useState(
        typeof doc.lat === "number" && Number.isFinite(doc.lat) ? doc.lat.toFixed(6) : ""
    );
    const [lngText, setLngText] = useState(
        typeof doc.lng === "number" && Number.isFinite(doc.lng) ? doc.lng.toFixed(6) : ""
    );
    const [tagsText, setTagsText] = useState(doc.tags.join(", "));
    const [markdownBody, setMarkdownBody] = useState(doc.markdownBody);
    const [linkedRoutes, setLinkedRoutes] = useState<WikiLinkedRoute[]>(doc.linkedRoutes);
    const [shuttle, setShuttle] = useState<WikiShuttleBlock | null>(doc.shuttle);
    const [boardingStops, setBoardingStops] = useState<WikiBoardingStop[]>(doc.boardingStops);
    const [nickname, setNickname] = useState(initialNickname);
    const [summary, setSummary] = useState("");
    const [honeypot, setHoneypot] = useState("");
    const [editorTab, setEditorTab] = useState<"markdown" | "routes" | "shuttle" | "stops">("markdown");
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [conflictVersion, setConflictVersion] = useState<number | null>(null);

    const submitSave = async (overrideBaseVersion?: number) => {
        if (isSaving) return;

        const tLat = latText.trim();
        const tLng = lngText.trim();
        if ((tLat && !tLng) || (!tLat && tLng)) {
            setErrorMessage("지도 핀 좌표는 위도와 경도를 함께 입력하거나 모두 비워 주세요.");
            return;
        }
        let parsedLat: number | null = null;
        let parsedLng: number | null = null;
        if (tLat && tLng) {
            const nLat = Number(tLat);
            const nLng = Number(tLng);
            if (!Number.isFinite(nLat) || !Number.isFinite(nLng)) {
                setErrorMessage("올바른 숫자 형식의 위도·경도를 입력해 주세요.");
                return;
            }
            parsedLat = nLat;
            parsedLng = nLng;
        }

        setIsSaving(true);
        setErrorMessage(null);
        setConflictVersion(null);

        const cleanedTags = tagsText
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 12);

        const cleanedRoutes = linkedRoutes.filter((r) => r.routeNo.trim().length > 0);
        const cleanedStops = boardingStops.filter((s) => s.name.trim().length > 0 && s.locationDescription.trim().length > 0);

        try {
            const res = await fetch(`/api/wiki/${encodeURIComponent(doc.slug)}`, {
                method: "PUT",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    baseVersion: overrideBaseVersion ?? baseVersion,
                    title,
                    subtitle,
                    category,
                    cityCode: cityCode.trim() || undefined,
                    lat: parsedLat,
                    lng: parsedLng,
                    tags: cleanedTags,
                    linkedRoutes: cleanedRoutes,
                    shuttle,
                    boardingStops: cleanedStops,
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
            setErrorMessage(err instanceof Error ? err.message : "저장 중 네트워크 오류가 발생했습니다.");
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
                            기본 정보 &amp; 구조화 데이터 편집
                        </h2>
                    </div>
                    <span
                        className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                        /wiki/{normalizeWikiSlug(title) || doc.slug}
                    </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label
                            htmlFor="wiki-edit-title"
                            className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1"
                        >
                            문서 제목 * (제목 변경 시 주소도 함께 변경됩니다)
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

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <label
                            htmlFor="wiki-edit-category"
                            className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1"
                        >
                            카테고리
                        </label>
                        <select
                            id="wiki-edit-category"
                            name="category"
                            value={category}
                            onChange={(e) => setCategory(e.target.value as WikiCategory)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-slate-100"
                        >
                            {WIKI_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                    {WIKI_CATEGORY_LABELS[cat]}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label
                            htmlFor="wiki-edit-city"
                            className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1"
                        >
                            연결 지역 (선택)
                        </label>
                        <select
                            id="wiki-edit-city"
                            name="cityCode"
                            value={cityCode}
                            onChange={(e) => setCityCode(e.target.value)}
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-slate-100"
                        >
                            <option value="">전국 / 공통</option>
                            {NATIONWIDE_CITIES.map((city) => (
                                <option key={city.code} value={city.code}>
                                    {city.name} ({city.code})
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label
                            htmlFor="wiki-edit-tags"
                            className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1"
                        >
                            태그 (쉼표로 구분)
                        </label>
                        <input
                            id="wiki-edit-tags"
                            name="tags"
                            type="text"
                            value={tagsText}
                            onChange={(e) => setTagsText(e.target.value)}
                            placeholder="예: 원주, 연세대, 셔틀, 30번"
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-900 dark:text-slate-100"
                        />
                    </div>
                </div>

                <WikiPinLocationFields
                    lat={latText}
                    lng={lngText}
                    onChangeLat={setLatText}
                    onChangeLng={setLngText}
                    onClear={() => {
                        setLatText("");
                        setLngText("");
                    }}
                />
            </div>

            {/* Section switcher */}
            <div
                className="flex flex-wrap items-center gap-1.5 p-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
                {[
                    {id: "markdown" as const, label: "위키 본문 (마크다운)"},
                    {id: "routes" as const, label: `시내버스 노선 (${linkedRoutes.length})`},
                    {id: "shuttle" as const, label: `셔틀 시간표${shuttle?.enabled ? " (ON)" : ""}`},
                    {id: "stops" as const, label: `승강장 안내 (${boardingStops.length})`},
                ].map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setEditorTab(tab.id)}
                        className={`flex-1 min-w-[130px] py-2 px-3 rounded-xl text-xs font-black transition cursor-pointer ${
                            editorTab === tab.id
                                ? "bg-[#003876] dark:bg-sky-600 text-white shadow-xs"
                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {editorTab === "markdown" && (
                <WikiMarkdownEditor
                    value={markdownBody}
                    onChange={setMarkdownBody}
                    cityCode={cityCode || "32020"}
                />
            )}
            {editorTab === "routes" && (
                <WikiRoutesEditor
                    value={linkedRoutes}
                    onChange={setLinkedRoutes}
                    defaultCityCode={cityCode || "32020"}
                />
            )}
            {editorTab === "shuttle" && (
                <WikiShuttleEditor value={shuttle} onChange={setShuttle}/>
            )}
            {editorTab === "stops" && (
                <WikiStopsEditor value={boardingStops} onChange={setBoardingStops}/>
            )}

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
