"use client";

import React, {useMemo, useState} from "react";
import Link from "next/link";
import {
    BookOpen,
    Bus,
    Camera,
    Clock,
    ExternalLink,
    History,
    Info,
    Lock,
    MapPin,
    Navigation,
    PenLine,
    Plus,
    User,
} from "lucide-react";

import {NATIONWIDE_CITIES} from "@entities/city";
import {getKakaoMapUrl, getKakaoRoadviewUrl} from "@entities/station";
import {
    mutateAllWikiQueries,
    useWikiNickname,
    useWikiPage,
    WIKI_CATEGORY_LABELS,
    type WikiPageDocument,
} from "@entities/wiki";
import {WikiEditorForm, WikiHistoryPanel, WikiMarkdownRenderer} from "@features/wiki";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {Modal} from "@shared/ui";
import {triggerHaptic} from "@shared/utils/haptics";
import {WIKI_CATEGORY_PIN_STYLES} from "../lib/wikiPinTheme";

export interface WikiPinModalProps {
    slug: string | null;
    initialMode?: "read" | "edit" | "history";
    onClose: () => void;
    onSelectSlug: (nextSlug: string) => void;
    onSelectRouteOnMap: (routeNo: string, cityCode: string) => void;
    onCreateNewFromSlug?: (slug: string) => void;
}

function formatUpdatedAt(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString("ko-KR", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function resolveCityName(cityCode?: string): string | null {
    if (!cityCode) return null;
    return NATIONWIDE_CITIES.find((c) => c.code === cityCode)?.name ?? null;
}

export const WikiPinModal: React.FC<WikiPinModalProps> = ({
                                                              slug,
                                                              initialMode = "read",
                                                              onClose,
                                                              onSelectSlug,
                                                              onSelectRouteOnMap,
                                                              onCreateNewFromSlug,
                                                          }) => {
    const isOpen = Boolean(slug);
    const {map} = useAppMapContext();
    const {storedNickname, saveNickname} = useWikiNickname();

    const {data: wikiDoc, error, isLoading, mutate} = useWikiPage(slug);

    const [viewMode, setViewMode] = useState<"read" | "edit" | "history">(initialMode);
    const [editSessionId, setEditSessionId] = useState(0);
    const openKey = `${slug ?? ""}:${initialMode}`;
    const [prevOpenKey, setPrevOpenKey] = useState<string>(openKey);
    if (openKey !== prevOpenKey) {
        setPrevOpenKey(openKey);
        setViewMode(initialMode);
        if (initialMode === "edit") {
            setEditSessionId((n) => n + 1);
        }
    }

    const style = useMemo(() => {
        const cat = wikiDoc?.category ?? "guide";
        return WIKI_CATEGORY_PIN_STYLES[cat] ?? WIKI_CATEGORY_PIN_STYLES.guide;
    }, [wikiDoc?.category]);

    const CategoryIcon = style.icon;
    const cityName = resolveCityName(wikiDoc?.cityCode);

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
            className={`flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl text-white shadow-sm shrink-0 ${style.badgeBg}`}
        >
            <CategoryIcon className="w-5 h-5"/>
        </div>
    );

    const headerBadge = wikiDoc ? (
        <span
            className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-white/10 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-200 tabular-nums">
            v{wikiDoc.version}
        </span>
    ) : null;

    const headerActions = wikiDoc ? (
        <div className="flex items-center gap-1.5">
            <div
                className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-white/[0.06] p-0.5 border border-slate-200/60 dark:border-white/10">
                <button
                    type="button"
                    onClick={() => setViewMode("read")}
                    className={`px-2 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                        viewMode === "read"
                            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                >
                    보기
                </button>
                <button
                    type="button"
                    onClick={() => {
                        triggerHaptic("light");
                        setEditSessionId((n) => n + 1);
                        setViewMode("edit");
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                        viewMode === "edit"
                            ? "bg-[#003876] dark:bg-sky-600 text-white shadow-xs"
                            : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    }`}
                >
                    <PenLine className="w-3 h-3"/>
                    편집
                </button>
                <button
                    type="button"
                    onClick={() => {
                        triggerHaptic("light");
                        setViewMode("history");
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-black transition cursor-pointer ${
                        viewMode === "history"
                            ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    }`}
                >
                    <History className="w-3 h-3"/>
                    <span className="hidden sm:inline">이력</span>
                </button>
            </div>

            <Link
                href={`/wiki/${encodeURIComponent(wikiDoc.slug)}`}
                title="전체 페이지로 열기"
                className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.07] dark:hover:bg-white/15 text-[11px] font-extrabold text-slate-700 dark:text-slate-200 transition"
            >
                <span>전체 보기</span>
                <ExternalLink className="w-3 h-3"/>
            </Link>
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
                <Link
                    href={`/wiki/${encodeURIComponent(wikiDoc.slug)}`}
                    className="sm:hidden inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-white/10 text-[11px] font-extrabold text-slate-700 dark:text-slate-200"
                >
                    <span>전체 페이지</span>
                    <ExternalLink className="w-3 h-3"/>
                </Link>
                <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black cursor-pointer hover:opacity-90 transition active:scale-95"
                >
                    닫기
                </button>
            </div>
        </>
    ) : null;

    const errorStatus = (error as (Error & { status?: number }) | undefined)?.status;

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={wikiDoc?.title ?? slug ?? "위키 문서"}
            subtitle={
                wikiDoc
                    ? `${WIKI_CATEGORY_LABELS[wikiDoc.category]}${cityName ? ` · ${cityName}` : ""}${wikiDoc.subtitle ? ` — ${wikiDoc.subtitle}` : ""}`
                    : "커뮤니티 버스 위키"
            }
            icon={modalIcon}
            headerBadge={headerBadge}
            headerActions={headerActions}
            footer={modalFooter}
            maxWidth="2xl"
            height="tall"
            zIndex="z-[120]"
            modalId="wiki-pin"
            ariaLabel={wikiDoc ? `${wikiDoc.title} 위키 문서` : "위키 문서 모달"}
        >
            <div
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-5 custom-scrollbar select-text">
                {isLoading && !wikiDoc && (
                    <div className="py-16 text-center space-y-2.5">
                        <div
                            className="w-8 h-8 mx-auto rounded-full border-2 border-[#003876] border-t-transparent animate-spin"/>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                            위키 문서를 불러오는 중...
                        </p>
                    </div>
                )}

                {!isLoading && (error || !wikiDoc) && slug && (
                    <div className="py-10 text-center space-y-3.5 max-w-md mx-auto">
                        <div
                            className="w-12 h-12 mx-auto rounded-2xl bg-sky-100 dark:bg-sky-950/60 flex items-center justify-center text-sky-700 dark:text-sky-300">
                            <BookOpen className="w-6 h-6"/>
                        </div>
                        <h3 className="text-base font-black text-slate-900 dark:text-white">
                            {errorStatus === 404
                                ? "아직 작성되지 않은 위키 문서입니다"
                                : "위키 문서를 불러오지 못했습니다"}
                        </h3>
                        <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                            <code className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono">
                                {slug}
                            </code>{" "}
                            문서를 지도의 핀으로 바로 개설할 수 있습니다.
                        </p>
                        {onCreateNewFromSlug && (
                            <button
                                type="button"
                                onClick={() => onCreateNewFromSlug(slug)}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#003876] hover:bg-[#00295a] dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-black transition cursor-pointer"
                            >
                                <Plus className="w-3.5 h-3.5"/>
                                <span>이 이름으로 새 위키 만들기</span>
                            </button>
                        )}
                    </div>
                )}

                {wikiDoc && viewMode === "edit" && (
                    <WikiEditorForm
                        key={`${wikiDoc.slug}:${wikiDoc.version}:${editSessionId}`}
                        doc={wikiDoc}
                        initialNickname={storedNickname}
                        onSaveNickname={saveNickname}
                        onSaved={async (saved) => {
                            await mutate(saved, false);
                            await mutateAllWikiQueries().catch(() => []);
                            if (saved.slug !== slug) {
                                onSelectSlug(saved.slug);
                            }
                            setViewMode("read");
                        }}
                        onCancel={() => setViewMode("read")}
                        onReloadLatest={async () => {
                            await mutate();
                            setEditSessionId((n) => n + 1);
                        }}
                    />
                )}

                {wikiDoc && viewMode === "history" && (
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
                )}

                {wikiDoc && viewMode === "read" && (
                    <>
                        {/* Badges, Tags & Map Pin Location Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap items-center gap-1.5">
                                {wikiDoc.isProtected && (
                                    <span
                                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                                        <Lock className="w-3 h-3"/>
                                        보호된 문서
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
                                        <span>핀 위치로 이동</span>
                                    </button>
                                    <a
                                        href={getKakaoRoadviewUrl(wikiDoc.lat, wikiDoc.lng)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 border border-amber-200 dark:border-amber-800 text-[11px] font-black text-amber-700 dark:text-amber-300 transition"
                                    >
                                        <Camera className="w-3 h-3"/>
                                        <span>로드뷰</span>
                                    </a>
                                </div>
                            )}
                        </div>

                        {/* Linked Routes */}
                        {wikiDoc.linkedRoutes.length > 0 && (
                            <section className="space-y-2.5">
                                <div
                                    className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
                                    <Bus className="w-4 h-4 text-[#003876] dark:text-sky-400"/>
                                    <span>연결 시내버스 ({wikiDoc.linkedRoutes.length})</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {wikiDoc.linkedRoutes.map((route) => (
                                        <button
                                            key={`${route.cityCode}:${route.routeNo}`}
                                            type="button"
                                            onClick={() => {
                                                triggerHaptic("selection");
                                                onSelectRouteOnMap(route.routeNo, route.cityCode);
                                                onClose();
                                            }}
                                            className="text-left p-3 rounded-2xl border border-slate-200/85 dark:border-white/10 bg-slate-50/70 hover:bg-sky-50/70 dark:bg-white/[0.03] dark:hover:bg-sky-950/30 transition cursor-pointer group space-y-1"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-xs font-black text-[#003876] dark:text-sky-300">
                                                    {route.label || `${route.routeNo}번`}
                                                </span>
                                                <span
                                                    className="text-[10px] font-black text-sky-600 dark:text-sky-400 group-hover:underline">
                                                    지도에서 보기 →
                                                </span>
                                            </div>
                                            {route.description && (
                                                <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 line-clamp-2">
                                                    {route.description}
                                                </p>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Shuttle Summary Card */}
                        {wikiDoc.shuttle?.enabled && (
                            <section
                                className="rounded-2xl border border-sky-200/80 dark:border-sky-800/60 bg-sky-50/60 dark:bg-sky-950/25 p-3.5 space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <div
                                        className="flex items-center gap-1.5 text-xs font-black text-[#003876] dark:text-sky-300">
                                        <Clock className="w-4 h-4"/>
                                        <span>{wikiDoc.shuttle.title}</span>
                                    </div>
                                    <Link
                                        href={`/wiki/${encodeURIComponent(wikiDoc.slug)}`}
                                        className="text-[11px] font-black text-[#003876] dark:text-sky-300 hover:underline"
                                    >
                                        전체 셔틀 시간표 →
                                    </Link>
                                </div>
                                <div
                                    className="flex flex-wrap gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
                                    <span>등교 {wikiDoc.shuttle.inbound_to_campus.length}회</span>
                                    <span>·</span>
                                    <span>하교 {wikiDoc.shuttle.outbound_from_campus.length}회</span>
                                    <span>·</span>
                                    <span>정류장 {wikiDoc.shuttle.stop_locations.length}곳</span>
                                </div>
                            </section>
                        )}

                        {/* Boarding Stops */}
                        {wikiDoc.boardingStops.length > 0 && (
                            <section className="space-y-2.5">
                                <div
                                    className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white">
                                    <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400"/>
                                    <span>주요 승강장 · 탑승 위치 ({wikiDoc.boardingStops.length})</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {wikiDoc.boardingStops.map((stop) => (
                                        <div
                                            key={stop.id}
                                            className="p-3 rounded-2xl border border-slate-200/85 dark:border-white/10 bg-slate-50/60 dark:bg-white/[0.03] space-y-1.5"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <span
                                                    className="text-xs font-black text-slate-900 dark:text-white truncate">
                                                    {stop.name}
                                                </span>
                                                <span
                                                    className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-200 shrink-0">
                                                    {stop.directionTag}
                                                </span>
                                            </div>
                                            <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                                                {stop.locationDescription}
                                            </p>
                                            {stop.tips && (
                                                <p className="flex items-start gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                                                    <Info className="w-3 h-3 shrink-0 mt-0.5"/>
                                                    <span>{stop.tips}</span>
                                                </p>
                                            )}
                                            <div className="flex items-center gap-1.5 pt-1">
                                                <a
                                                    href={getKakaoMapUrl(stop.name, stop.lat, stop.lng)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200"
                                                >
                                                    <Navigation className="w-2.5 h-2.5"/>
                                                    카카오맵
                                                </a>
                                                <a
                                                    href={getKakaoRoadviewUrl(stop.lat, stop.lng)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-200"
                                                >
                                                    <Camera className="w-2.5 h-2.5"/>
                                                    로드뷰
                                                </a>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Markdown Article Body */}
                        <section
                            className="rounded-2xl p-4 sm:p-5 bg-white dark:bg-slate-900/60 border border-slate-200/85 dark:border-white/10 space-y-4">
                            <div
                                className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100 dark:border-white/[0.07]">
                                <div className="flex items-center gap-1.5">
                                    <BookOpen className="w-4 h-4 text-[#003876] dark:text-sky-400"/>
                                    <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                        커뮤니티 위키 본문
                                    </h3>
                                </div>
                                {!wikiDoc.isProtected && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic("light");
                                            setEditSessionId((n) => n + 1);
                                            setViewMode("edit");
                                        }}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/50 text-[11px] font-black text-[#003876] dark:text-sky-300 cursor-pointer"
                                    >
                                        <PenLine className="w-3 h-3"/>
                                        편집하기
                                    </button>
                                )}
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
                    </>
                )}
            </div>
        </Modal>
    );
};
