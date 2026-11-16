"use client";

import React, {useState} from "react";
import {NATIONWIDE_CITIES} from "@entities/city";
import {
    DEFAULT_WIKI_PIN_COLOR,
    isValidWikiSlug,
    normalizeWikiSlug,
    useWikiNickname,
    type WikiBoardingStop,
    type WikiLinkedRoute,
    type WikiPageDocument,
    type WikiPinColor,
    type WikiShuttleBlock,
} from "@entities/wiki";
import {WikiEditMetaBar} from "./WikiEditMetaBar";
import {WikiMarkdownEditor} from "./WikiMarkdownEditor";
import {WikiPinColorSelector} from "./WikiPinColorSelector";
import {WikiPinLocationFields} from "./WikiPinLocationFields";
import {WikiRoutesEditor} from "./WikiRoutesEditor";
import {WikiShuttleEditor} from "./WikiShuttleEditor";
import {WikiStopsEditor} from "./WikiStopsEditor";

export interface WikiCreateFormProps {
    initialSlug?: string;
    initialLat?: number;
    initialLng?: number;
    initialCityCode?: string;
    initialPinColor?: WikiPinColor;
    onCreated: (created: WikiPageDocument) => void | Promise<void>;
    onCancel: () => void;
    onPickOnMap?: () => void;
}

const DEFAULT_MARKDOWN_TEMPLATE = `## 개요
이 장소·정류장·노선에 대한 핵심 이용 안내를 적어 주세요.

> [!TIP]
> 첫차·막차 혼잡 시간대나 탑승 위치를 공유하면 큰 도움이 됩니다.

## 주요 이용 팁
- 탑승 위치 및 환승 팁을 자유롭게 추가하세요.
`;

function parseOptionalCoords(latText: string, lngText: string):
    | {
    ok: true;
    lat?: number;
    lng?: number;
}
    | {
    ok: false;
    message: string;
} {
    const tLat = latText.trim();
    const tLng = lngText.trim();
    if (!tLat && !tLng) {
        return {ok: true};
    }
    if (!tLat || !tLng) {
        return {ok: false, message: "지도 핀 좌표는 위도와 경도를 함께 입력하거나 모두 비워 주세요."};
    }
    const lat = Number(tLat);
    const lng = Number(tLng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return {ok: false, message: "올바른 숫자 형식의 위도·경도를 입력해 주세요."};
    }
    return {ok: true, lat, lng};
}

export const WikiCreateForm: React.FC<WikiCreateFormProps> = ({
                                                                  initialSlug = "",
                                                                  initialLat,
                                                                  initialLng,
                                                                  initialCityCode = "",
                                                                  initialPinColor = DEFAULT_WIKI_PIN_COLOR,
                                                                  onCreated,
                                                                  onCancel,
                                                                  onPickOnMap,
                                                              }) => {
    const {storedNickname, saveNickname} = useWikiNickname();

    const initialNormalized = normalizeWikiSlug(initialSlug);
    const [title, setTitle] = useState(initialNormalized || initialSlug.trim());
    const [subtitle, setSubtitle] = useState("");
    const [pinColor, setPinColor] = useState<WikiPinColor>(initialPinColor);
    const [cityCode, setCityCode] = useState(initialCityCode);
    const [latText, setLatText] = useState(
        typeof initialLat === "number" && Number.isFinite(initialLat) ? initialLat.toFixed(6) : "",
    );
    const [lngText, setLngText] = useState(
        typeof initialLng === "number" && Number.isFinite(initialLng) ? initialLng.toFixed(6) : "",
    );
    const [tagsText, setTagsText] = useState("");
    const [markdownBody, setMarkdownBody] = useState(DEFAULT_MARKDOWN_TEMPLATE);
    const [linkedRoutes, setLinkedRoutes] = useState<WikiLinkedRoute[]>([]);
    const [shuttle, setShuttle] = useState<WikiShuttleBlock | null>(null);
    const [boardingStops, setBoardingStops] = useState<WikiBoardingStop[]>([]);
    const [nickname, setNickname] = useState(storedNickname);
    const [summary, setSummary] = useState("새 위키 문서 생성");
    const [honeypot, setHoneypot] = useState("");
    const [activeTab, setActiveTab] = useState<"markdown" | "routes" | "shuttle" | "stops">(
        "markdown",
    );
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

        const parsedCoords = parseOptionalCoords(latText, lngText);
        if (!parsedCoords.ok) {
            setErrorMessage(parsedCoords.message);
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);

        const cleanedTags = tagsText
            .split(",")
            .map((t) => t.trim().replace(/^#+/, ""))
            .filter(Boolean)
            .slice(0, 12);
        const cleanedRoutes = linkedRoutes.filter((r) => r.routeNo.trim().length > 0);
        const cleanedStops = boardingStops.filter(
            (s) => s.name.trim().length > 0 && s.locationDescription.trim().length > 0,
        );

        try {
            const res = await fetch("/api/wiki", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    slug: derivedSlug,
                    title: derivedSlug,
                    subtitle: subtitle.trim(),
                    pinColor,
                    cityCode: cityCode.trim() || undefined,
                    ...(parsedCoords.lat !== undefined && parsedCoords.lng !== undefined
                        ? {lat: parsedCoords.lat, lng: parsedCoords.lng}
                        : {}),
                    tags: cleanedTags,
                    linkedRoutes: cleanedRoutes,
                    shuttle,
                    boardingStops: cleanedStops,
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
                <div className="space-y-3">
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <div>
                        <label
                            htmlFor="wiki-create-city"
                            className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1"
                        >
                            연결 지역 (선택)
                        </label>
                        <select
                            id="wiki-create-city"
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
                </div>

                <WikiPinColorSelector id="wiki-create-pin-color" value={pinColor} onChange={setPinColor}/>

                <WikiPinLocationFields
                    lat={latText}
                    lng={lngText}
                    onChangeLat={setLatText}
                    onChangeLng={setLngText}
                    onClear={() => {
                        setLatText("");
                        setLngText("");
                    }}
                    onPickOnMap={onPickOnMap}
                />
            </div>

            {/* Section Switcher */}
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
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 min-w-[130px] py-2 px-3 rounded-xl text-xs font-black transition cursor-pointer ${
                            activeTab === tab.id
                                ? "bg-[#003876] dark:bg-sky-600 text-white shadow-xs"
                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === "markdown" && (
                <WikiMarkdownEditor
                    value={markdownBody}
                    onChange={setMarkdownBody}
                    cityCode={cityCode}
                />
            )}
            {activeTab === "routes" && (
                <WikiRoutesEditor
                    value={linkedRoutes}
                    onChange={setLinkedRoutes}
                    defaultCityCode={cityCode}
                />
            )}
            {activeTab === "shuttle" && (
                <WikiShuttleEditor value={shuttle} onChange={setShuttle}/>
            )}
            {activeTab === "stops" && (
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
                saveLabel="새 위키 문서 개설하기"
                onSave={() => void handleCreate()}
                onCancel={onCancel}
            />
        </div>
    );
};
