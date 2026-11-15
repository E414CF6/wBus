"use client";

import React, {useState} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ArrowLeft, BookPlus} from "lucide-react";

import {NATIONWIDE_CITIES} from "@entities/city";
import {
    isValidWikiSlug,
    normalizeWikiSlug,
    useWikiNickname,
    WIKI_CATEGORIES,
    WIKI_CATEGORY_LABELS,
    type WikiBoardingStop,
    type WikiCategory,
    type WikiLinkedRoute,
    type WikiPageDocument,
    type WikiShuttleBlock,
} from "@entities/wiki";
import {
    WikiEditMetaBar,
    WikiMarkdownEditor,
    WikiRoutesEditor,
    WikiShuttleEditor,
    WikiStopsEditor,
} from "@features/wiki";
import {Footer} from "@shared/ui/Footer";

export interface WikiCreatePageProps {
    initialSlug?: string;
}

const DEFAULT_MARKDOWN_TEMPLATE = `## 개요
이 정류장·캠퍼스·노선에 대한 핵심 이용 안내를 적어 주세요.

> [!TIP]
> 첫차·막차 혼잡 시간대나 탑승 위치를 공유하면 큰 도움이 됩니다.

## 주요 이용 팁
- 탑승 위치 및 환승 팁을 자유롭게 추가하세요.
`;

export const WikiCreatePage: React.FC<WikiCreatePageProps> = ({initialSlug = ""}) => {
    const router = useRouter();
    const {storedNickname, saveNickname} = useWikiNickname();

    const initialNormalized = normalizeWikiSlug(initialSlug);
    const [title, setTitle] = useState(initialNormalized || initialSlug.trim());
    const [subtitle, setSubtitle] = useState("");
    const [category, setCategory] = useState<WikiCategory>("guide");
    const [cityCode, setCityCode] = useState("32020");
    const [tagsText, setTagsText] = useState("");
    const [markdownBody, setMarkdownBody] = useState(DEFAULT_MARKDOWN_TEMPLATE);
    const [linkedRoutes, setLinkedRoutes] = useState<WikiLinkedRoute[]>([]);
    const [shuttle, setShuttle] = useState<WikiShuttleBlock | null>(null);
    const [boardingStops, setBoardingStops] = useState<WikiBoardingStop[]>([]);
    const [nickname, setNickname] = useState(storedNickname);
    const [summary, setSummary] = useState("새 위키 문서 생성");
    const [honeypot, setHoneypot] = useState("");
    const [activeTab, setActiveTab] = useState<"markdown" | "routes" | "shuttle" | "stops">("markdown");
    const [isSaving, setIsSaving] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const derivedSlug = normalizeWikiSlug(title);

    const handleCreate = async () => {
        if (isSaving) return;
        if (!isValidWikiSlug(derivedSlug)) {
            setErrorMessage("문서 제목(슬러그)은 2~80자여야 하며 예약어(new, edit, api 등)나 URL 특수문자(/ ? # %)를 사용할 수 없습니다.");
            return;
        }

        setIsSaving(true);
        setErrorMessage(null);

        const cleanedTags = tagsText
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 12);
        const cleanedRoutes = linkedRoutes.filter((r) => r.routeNo.trim().length > 0);
        const cleanedStops = boardingStops.filter(
            (s) => s.name.trim().length > 0 && s.locationDescription.trim().length > 0
        );

        try {
            const res = await fetch("/api/wiki", {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify({
                    slug: derivedSlug,
                    title: derivedSlug,
                    subtitle: subtitle.trim(),
                    category,
                    cityCode: cityCode.trim() || undefined,
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

            const created = body.document as WikiPageDocument;
            router.push(`/wiki/${encodeURIComponent(created.slug)}`);
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : "문서 생성 중 오류가 발생했습니다.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f4f7fb] dark:bg-[#080c15] text-slate-900 dark:text-slate-100 flex flex-col">
            <header
                className="sticky top-0 z-30 backdrop-blur-2xl bg-white/88 dark:bg-[#0b101b]/88 border-b border-slate-200/80 dark:border-white/[0.08]">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <Link
                            href="/wiki"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.07] dark:hover:bg-white/15 text-xs font-black text-slate-700 dark:text-slate-200 transition"
                        >
                            <ArrowLeft className="w-3.5 h-3.5"/>
                            <span>위키 목록</span>
                        </Link>
                        <div className="flex items-center gap-1.5">
                            <BookPlus className="w-4 h-4 text-[#003876] dark:text-sky-400"/>
                            <h1 className="text-sm sm:text-base font-black">새 위키 문서 만들기</h1>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5">
                <div
                    className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 p-4 sm:p-5 shadow-sm space-y-4">
                    <div className="space-y-3">
                        <div>
                            <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                                <label
                                    htmlFor="wiki-create-title"
                                    className="block text-[11px] font-bold text-slate-500 dark:text-slate-400"
                                >
                                    문서 제목 * (한국어 제목이 그대로 문서 주소가 됩니다)
                                </label>
                                <span
                                    className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate max-w-full">
                                    /wiki/{derivedSlug || "문서 제목"}
                                </span>
                            </div>
                            <input
                                id="wiki-create-title"
                                name="title"
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="예: 원주고속터미널 정류장 가이드"
                                maxLength={80}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm font-black"
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
                            className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-sm"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label
                                htmlFor="wiki-create-category"
                                className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1"
                            >
                                카테고리
                            </label>
                            <select
                                id="wiki-create-category"
                                name="category"
                                value={category}
                                onChange={(e) => setCategory(e.target.value as WikiCategory)}
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold"
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
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold"
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
                                htmlFor="wiki-create-tags"
                                className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1"
                            >
                                태그 (쉼표로 구분)
                            </label>
                            <input
                                id="wiki-create-tags"
                                name="tags"
                                type="text"
                                value={tagsText}
                                onChange={(e) => setTagsText(e.target.value)}
                                placeholder="예: 원주, 터미널, 시내버스"
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-semibold"
                            />
                        </div>
                    </div>
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
                        cityCode={cityCode || "32020"}
                    />
                )}
                {activeTab === "routes" && (
                    <WikiRoutesEditor
                        value={linkedRoutes}
                        onChange={setLinkedRoutes}
                        defaultCityCode={cityCode || "32020"}
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
                    onCancel={() => router.push("/wiki")}
                />
            </main>

            <Footer/>
        </div>
    );
};

export default WikiCreatePage;
