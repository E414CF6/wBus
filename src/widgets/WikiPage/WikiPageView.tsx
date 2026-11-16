"use client";

import React, {useCallback, useEffect, useMemo, useState, useSyncExternalStore} from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {useTheme} from "next-themes";
import {
    ArrowLeft,
    ArrowRight,
    BookOpen,
    Bus,
    Calendar,
    Camera,
    Clock,
    ExternalLink,
    History,
    Info,
    Lock,
    Map as MapIcon,
    MapPin,
    Moon,
    Navigation,
    PenLine,
    Plus,
    Sun,
    User,
} from "lucide-react";

import {NATIONWIDE_CITIES} from "@entities/city";
import {
    type BusRoute,
    getStaticYonseiBusRoutes,
    selectRouteVariant,
    type ShuttleBusScheduleData,
    useSchedule,
} from "@entities/schedule";
import {getKakaoMapUrl, getKakaoRoadviewUrl} from "@entities/station";
import {
    mutateAllWikiQueries,
    useWikiNickname,
    useWikiPage,
    WIKI_CATEGORY_LABELS,
    type WikiLinkedRoute,
    type WikiPageDocument,
    YONSEI_MIRAE_WIKI_SLUG,
} from "@entities/wiki";
import {
    WikiEditorForm,
    WikiHistoryPanel,
    WikiMarkdownRenderer,
} from "@features/wiki";
import {UI_TEXT} from "@shared/config/locale";
import {resolveInitialCampusDirection} from "@shared/config/settingsCookie";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {isWeekend} from "@shared/lib/timeUtils";
import {Footer} from "@shared/ui/Footer";
import {triggerHaptic} from "@shared/utils/haptics";
import {buildMapUrl} from "@widgets/AppShell/hooks/useAppNavigation";

import {formatHeaderClock} from "./lib/campusPageHelpers";
import {type CampusDirectionMode, getNextShuttleDepartures} from "./lib/yonseiShuttleUtils";
import {CampusDirectionBar} from "./ui/CampusDirectionBar";
import {CityBusTimetableModal} from "./ui/CityBusTimetableModal";
import {FloatingBottomNav} from "./ui/FloatingBottomNav";
import {ShuttleSpotlightSection} from "./ui/ShuttleSpotlightSection";
import {ShuttleStopsModal} from "./ui/ShuttleStopsModal";
import {ShuttleTimetableModal} from "./ui/ShuttleTimetableModal";
import {WikiTransitSettingsModal} from "./ui/WikiTransitSettingsModal";
import {YonseiCityBusCard} from "./ui/YonseiCityBusCard";

const emptySubscribe = () => () => {
};

export interface WikiPageViewProps {
    slug: string;
    initialDocument?: WikiPageDocument;
    initialMode?: "read" | "edit" | "history";
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

export const WikiPageView: React.FC<WikiPageViewProps> = ({
                                                              slug,
                                                              initialDocument,
                                                              initialMode = "read",
                                                          }) => {
    const router = useRouter();
    const {settings, updateSettings} = useAppSettings();
    const {storedNickname, saveNickname} = useWikiNickname();
    const {
        data: wikiDoc,
        error,
        isLoading,
        mutate,
    } = useWikiPage(slug, initialDocument);

    const [viewMode, setViewMode] = useState<"read" | "edit" | "history">(initialMode);
    const [editSessionId, setEditSessionId] = useState(0);

    const [now, setNow] = useState<Date>(() => new Date());
    const [directionOverride, setDirectionOverride] = useState<CampusDirectionMode | null>(null);
    const dayMode = settings.defaultDayMode;
    const directionMode = useMemo(
        () => directionOverride ?? resolveInitialCampusDirection(settings.yonseiDefaultDirection, now),
        [directionOverride, settings.yonseiDefaultDirection, now]
    );

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
        }, 15000);
        return () => clearInterval(timer);
    }, []);

    const {setTheme, resolvedTheme} = useTheme();
    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const isDark = mounted
        ? resolvedTheme === "dark" ||
        (typeof document !== "undefined" && document.documentElement.classList.contains("dark"))
        : false;

    const handleToggleTheme = useCallback(() => {
        triggerHaptic("light");
        setTheme(isDark ? "light" : "dark");
    }, [isDark, setTheme]);

    const isTodayWeekendOrHoliday = useMemo(() => isWeekend(now), [now]);
    const isHolidayOrVacation = useMemo(() => {
        if (dayMode === "WEEKDAY") return false;
        if (dayMode === "VACATION") return true;
        return isTodayWeekendOrHoliday;
    }, [dayMode, isTodayWeekendOrHoliday]);

    const hasScheduleLinkedRoutes = useMemo(() => {
        if (!wikiDoc?.linkedRoutes.length) return false;
        return wikiDoc.linkedRoutes.some((r) => r.cityCode === "32020");
    }, [wikiDoc]);

    const {routes: liveScheduleRoutes} = useSchedule(hasScheduleLinkedRoutes);
    const staticYonseiRoutes = useMemo(() => getStaticYonseiBusRoutes(), []);
    const allRoutes = useMemo(
        () => (liveScheduleRoutes.length > 0 ? liveScheduleRoutes : staticYonseiRoutes),
        [liveScheduleRoutes, staticYonseiRoutes]
    );

    const linkedRoutes = useMemo(() => wikiDoc?.linkedRoutes ?? [], [wikiDoc]);

    const routeOverridesMap = useMemo(() => {
        const map: Record<string, WikiLinkedRoute> = {};
        for (const r of linkedRoutes) {
            map[r.routeNo] = r;
        }
        return map;
    }, [linkedRoutes]);

    const routeScheduleMap = useMemo(() => {
        const map = new Map<string, BusRoute | null>();
        for (const linked of linkedRoutes) {
            const routeNo = linked.routeNo;
            if (linked.cityCode !== "32020") {
                map.set(routeNo, null);
                continue;
            }
            if (routeNo === "30") {
                const variants = allRoutes.filter((r) => r.routeNo === "30");
                const targetDayType = isHolidayOrVacation ? "방학,휴일" : "평일";
                map.set("30", variants.find((v) => v.dayType === targetDayType) ?? variants[0] ?? null);
            } else {
                map.set(routeNo, selectRouteVariant(allRoutes, routeNo, isHolidayOrVacation));
            }
        }
        return map;
    }, [allRoutes, isHolidayOrVacation, linkedRoutes]);

    const shuttleScheduleData: ShuttleBusScheduleData | null = useMemo(() => {
        if (!wikiDoc?.shuttle?.enabled) return null;
        return {
            title: wikiDoc.shuttle.title,
            stop_locations: wikiDoc.shuttle.stop_locations,
            inbound_to_campus: wikiDoc.shuttle.inbound_to_campus,
            outbound_from_campus: wikiDoc.shuttle.outbound_from_campus,
            guidelines: wikiDoc.shuttle.guidelines,
        };
    }, [wikiDoc]);

    const shuttleInfo = useMemo(() => {
        if (!shuttleScheduleData) return null;
        return getNextShuttleDepartures(shuttleScheduleData, dayMode, now);
    }, [shuttleScheduleData, dayMode, now]);

    const [cityModalState, setCityModalState] = useState<{
        isOpen: boolean;
        routeNo: string;
        location: "origin" | "dest";
    }>({
        isOpen: false,
        routeNo: "30",
        location: "dest",
    });

    const [shuttleModalState, setShuttleModalState] = useState<{
        isOpen: boolean;
        tab: "OUTBOUND" | "INBOUND" | "GUIDELINES";
    }>({
        isOpen: false,
        tab: "OUTBOUND",
    });

    const [isStopsModalOpen, setIsStopsModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);

    const handleOpenCityTimetable = useCallback((routeNo: string, location: "origin" | "dest") => {
        triggerHaptic("light");
        setCityModalState({
            isOpen: true,
            routeNo,
            location,
        });
    }, []);

    const handleOpenShuttleModal = useCallback((tab: "OUTBOUND" | "INBOUND" | "GUIDELINES") => {
        triggerHaptic("light");
        setShuttleModalState({
            isOpen: true,
            tab,
        });
    }, []);

    const activeModal: "city" | "shuttle" | "stops" | "settings" | null = cityModalState.isOpen
        ? "city"
        : shuttleModalState.isOpen
            ? "shuttle"
            : isStopsModalOpen
                ? "stops"
                : isSettingsModalOpen
                    ? "settings"
                    : null;

    const dayModeBadgeLabel =
        dayMode === "AUTO"
            ? isTodayWeekendOrHoliday
                ? `자동(${UI_TEXT.YONSEI.MODE_VACATION})`
                : `자동(${UI_TEXT.YONSEI.MODE_WEEKDAY})`
            : dayMode === "WEEKDAY"
                ? UI_TEXT.YONSEI.MODE_WEEKDAY
                : UI_TEXT.YONSEI.MODE_VACATION;

    if (isLoading && !wikiDoc) {
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-[#080c15] flex items-center justify-center p-6">
                <div className="text-center space-y-2">
                    <div
                        className="w-9 h-9 mx-auto rounded-full border-2 border-[#003876] border-t-transparent animate-spin"/>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                        위키 문서를 불러오는 중...
                    </p>
                </div>
            </div>
        );
    }

    if (error || !wikiDoc) {
        const status = (error as (Error & { status?: number }) | undefined)?.status;
        return (
            <div className="min-h-screen bg-slate-50 dark:bg-[#080c15] flex flex-col">
                <main
                    className="flex-1 max-w-2xl mx-auto w-full px-4 py-16 flex flex-col items-center justify-center text-center space-y-4">
                    <div
                        className="w-14 h-14 rounded-2xl bg-sky-100 dark:bg-sky-950/60 flex items-center justify-center text-sky-700 dark:text-sky-300">
                        <BookOpen className="w-7 h-7"/>
                    </div>
                    <h1 className="text-xl font-black text-slate-900 dark:text-white">
                        {status === 404
                            ? "아직 작성되지 않은 위키 문서입니다"
                            : "위키 문서를 불러오지 못했습니다"}
                    </h1>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        슬러그 <code
                        className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-800 font-mono text-xs">{slug}</code> 문서를
                        직접 개설해 첫 번째 버스 위키 기여자가 되어 보세요.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                        <Link
                            href="/wiki"
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-extrabold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        >
                            <ArrowLeft className="w-3.5 h-3.5"/>
                            위키 전체 목록
                        </Link>
                        <Link
                            href={`/wiki/new?slug=${encodeURIComponent(slug)}`}
                            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#003876] hover:bg-[#00295a] dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-black transition shadow-sm"
                        >
                            <Plus className="w-3.5 h-3.5"/>
                            이 이름으로 새 위키 만들기
                        </Link>
                    </div>
                </main>
                <Footer/>
            </div>
        );
    }

    const cityName = resolveCityName(wikiDoc.cityCode);
    const hasInteractiveTransit =
        Boolean(shuttleScheduleData && shuttleInfo) || wikiDoc.linkedRoutes.length > 0;
    const firstLinkedRoute = wikiDoc.linkedRoutes[0];
    const mapHref = buildMapUrl(
        firstLinkedRoute?.routeNo,
        firstLinkedRoute?.cityCode || wikiDoc.cityCode || "32020",
        wikiDoc.slug
    );
    const linkedRouteNumbers = wikiDoc.linkedRoutes
        .filter((r) => r.cityCode === "32020")
        .map((r) => r.routeNo);
    const isYonseiCampus =
        wikiDoc.slug === YONSEI_MIRAE_WIKI_SLUG ||
        (wikiDoc.category === "campus" && wikiDoc.title.includes("연세"));

    return (
        <div
            className="min-h-screen bg-[#f4f7fb] dark:bg-[#080c15] text-slate-900 dark:text-slate-100 transition-colors flex flex-col">
            {/* Top Sticky Header */}
            <header
                className="sticky top-0 z-30 backdrop-blur-2xl bg-white/88 dark:bg-[#0b101b]/88 border-b border-slate-200/80 dark:border-white/[0.08]">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                        <Link
                            href="/wiki"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.07] dark:hover:bg-white/15 text-xs font-black text-slate-700 dark:text-slate-200 transition shrink-0"
                        >
                            <BookOpen className="w-3.5 h-3.5 text-[#003876] dark:text-sky-400"/>
                            <span className="hidden xs:inline">wBus 위키</span>
                            <span className="xs:hidden">위키</span>
                        </Link>
                        <span className="text-slate-300 dark:text-slate-700 text-xs">/</span>
                        <span className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                            {wikiDoc.title}
                        </span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        {hasInteractiveTransit && (
                            <span
                                className="hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-white/[0.06] text-[11px] font-extrabold text-slate-600 dark:text-slate-300 tabular-nums">
                                <Clock className="w-3 h-3 text-[#003876] dark:text-sky-400"/>
                                {formatHeaderClock(now)}
                            </span>
                        )}

                        {/* Read / Edit / History Mode Buttons */}
                        <div
                            className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-white/[0.06] p-0.5 border border-slate-200/60 dark:border-white/10">
                            <button
                                type="button"
                                onClick={() => setViewMode("read")}
                                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-black transition cursor-pointer ${
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
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black transition cursor-pointer ${
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
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-black transition cursor-pointer ${
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
                            href={mapHref}
                            title="실시간 지도에서 보기"
                            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.07] dark:hover:bg-white/15 text-[11px] font-extrabold text-slate-700 dark:text-slate-200 transition"
                        >
                            <MapIcon className="w-3.5 h-3.5 text-[#003876] dark:text-sky-400"/>
                            <span>지도</span>
                        </Link>

                        {hasInteractiveTransit && (
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic("light");
                                    setIsSettingsModalOpen(true);
                                }}
                                title={UI_TEXT.YONSEI.MODE_OVERRIDE_LABEL}
                                className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.07] dark:hover:bg-white/15 text-[11px] font-extrabold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                            >
                                <Calendar className="w-3.5 h-3.5 text-[#003876] dark:text-blue-400"/>
                                <span>{dayModeBadgeLabel}</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={handleToggleTheme}
                            aria-label={UI_TEXT.ACCESSIBILITY.THEME_SWITCH}
                            className="flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.07] dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                        >
                            {mounted ? (
                                isDark ? (
                                    <Sun className="w-4 h-4 text-amber-400"/>
                                ) : (
                                    <Moon className="w-4 h-4 text-slate-700"/>
                                )
                            ) : (
                                <span className="w-4 h-4"/>
                            )}
                        </button>
                    </div>
                </div>
            </header>

            <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-5 sm:py-6 space-y-5">
                {/* Hero Metadata Banner */}
                <section
                    className="rounded-3xl p-5 sm:p-6 bg-white dark:bg-[#111623] border border-slate-200/85 dark:border-white/10 shadow-xs space-y-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                            <span
                                className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#003876]/10 dark:bg-sky-500/20 text-[#003876] dark:text-sky-300">
                                {WIKI_CATEGORY_LABELS[wikiDoc.category]}
                            </span>
                            {cityName && (
                                <span
                                    className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                                    {cityName}
                                </span>
                            )}
                            {wikiDoc.isProtected && (
                                <span
                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300">
                                    <Lock className="w-3 h-3"/>
                                    보호된 문서
                                </span>
                            )}
                        </div>

                        <div
                            className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            <span
                                className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-black text-slate-700 dark:text-slate-200 tabular-nums">
                                v{wikiDoc.version}
                            </span>
                            <span className="inline-flex items-center gap-1">
                                <User className="w-3 h-3"/>
                                {wikiDoc.lastEditor.nickname}
                            </span>
                            <span>· {formatUpdatedAt(wikiDoc.updatedAt)}</span>
                        </div>
                    </div>

                    <div>
                        <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                            {wikiDoc.title}
                        </h1>
                        {wikiDoc.subtitle && (
                            <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300 mt-1">
                                {wikiDoc.subtitle}
                            </p>
                        )}
                    </div>

                    {wikiDoc.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-0.5">
                            {wikiDoc.tags.map((tag) => (
                                <Link
                                    key={tag}
                                    href={`/wiki?q=${encodeURIComponent(tag)}`}
                                    className="px-2.5 py-0.5 rounded-lg bg-slate-100/90 hover:bg-sky-50 dark:bg-white/[0.06] dark:hover:bg-sky-950/40 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-[#003876] dark:hover:text-sky-300 transition"
                                >
                                    #{tag}
                                </Link>
                            ))}
                        </div>
                    )}
                </section>

                {/* View Mode Switching */}
                {viewMode === "edit" && (
                    <WikiEditorForm
                        key={`${wikiDoc.slug}:${wikiDoc.version}:${editSessionId}`}
                        doc={wikiDoc}
                        initialNickname={storedNickname}
                        onSaveNickname={saveNickname}
                        onSaved={async (saved) => {
                            await mutateAllWikiQueries().catch(() => []);
                            if (saved.slug !== slug) {
                                router.replace(`/wiki/${encodeURIComponent(saved.slug)}`);
                                return;
                            }
                            await mutate(saved, false);
                            setViewMode("read");
                        }}
                        onCancel={() => setViewMode("read")}
                        onReloadLatest={async () => {
                            await mutate();
                            setEditSessionId((n) => n + 1);
                        }}
                    />
                )}

                {viewMode === "history" && (
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

                {viewMode === "read" && (
                    <>
                        {/* Live Transit Widgets */}
                        {hasInteractiveTransit && (
                            <CampusDirectionBar
                                directionMode={directionMode}
                                dayModeBadgeLabel={dayModeBadgeLabel}
                                badgeLabel={
                                    isYonseiCampus
                                        ? UI_TEXT.YONSEI.HERO_BADGE
                                        : WIKI_CATEGORY_LABELS[wikiDoc.category]
                                }
                                outboundTitle={isYonseiCampus ? "하교 · 시내방면" : "시내 · 종점 방면"}
                                outboundSubtitle={isYonseiCampus ? "연세대 출발" : "주요 방면 출발"}
                                inboundTitle={isYonseiCampus ? "등교 · 학교방면" : "학교 · 기점 방면"}
                                inboundSubtitle={isYonseiCampus ? "장양리·시내 출발" : "반대 방향 출발"}
                                onDirectionChange={setDirectionOverride}
                                onOpenSettings={() => setIsSettingsModalOpen(true)}
                            />
                        )}

                        {wikiDoc.linkedRoutes.length > 0 && (
                            <section className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-2">
                                        <Bus className="w-4 h-4 text-[#003876] dark:text-blue-400"/>
                                        <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                                            연결 시내버스 ({wikiDoc.linkedRoutes.map((r) => `${r.routeNo}번`).join(" · ")})
                                        </h2>
                                    </div>
                                    {linkedRouteNumbers.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleOpenCityTimetable(
                                                    linkedRouteNumbers[0],
                                                    directionMode === "OUTBOUND" ? "dest" : "origin"
                                                )
                                            }
                                            className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#003876] dark:text-blue-400 hover:underline cursor-pointer"
                                        >
                                            <span>전체 시간표</span>
                                            <ArrowRight className="w-3 h-3"/>
                                        </button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {wikiDoc.linkedRoutes.map((linked) => (
                                        <YonseiCityBusCard
                                            key={`${linked.cityCode}:${linked.routeNo}`}
                                            routeNo={linked.routeNo}
                                            cityCode={linked.cityCode}
                                            routeOverride={linked}
                                            scheduleRoute={routeScheduleMap.get(linked.routeNo) ?? null}
                                            directionMode={directionMode}
                                            now={now}
                                            onOpenTimetable={handleOpenCityTimetable}
                                        />
                                    ))}
                                </div>
                            </section>
                        )}

                        {shuttleScheduleData && shuttleInfo && (
                            <ShuttleSpotlightSection
                                directionMode={directionMode}
                                shuttleDayType={shuttleInfo.dayType}
                                nextOutbound={shuttleInfo.nextOutbound}
                                nextInbound={shuttleInfo.nextInbound}
                                shuttleSchedule={shuttleScheduleData}
                                onOpenShuttleModal={handleOpenShuttleModal}
                                onOpenStopsModal={() => setIsStopsModalOpen(true)}
                            />
                        )}

                        {wikiDoc.boardingStops.length > 0 && (
                            <section className="space-y-3">
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400"/>
                                        <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white tracking-tight">
                                            주요 승강장 · 탑승 위치 ({wikiDoc.boardingStops.length})
                                        </h2>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsStopsModalOpen(true)}
                                        className="inline-flex items-center gap-1 text-[11px] font-extrabold text-emerald-700 dark:text-emerald-400 hover:underline cursor-pointer"
                                    >
                                        <span>모달로 크게 보기</span>
                                        <ArrowRight className="w-3 h-3"/>
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {wikiDoc.boardingStops.map((stop) => {
                                        const kakaoMapUrl = getKakaoMapUrl(stop.name, stop.lat, stop.lng);
                                        const kakaoRoadviewUrl = getKakaoRoadviewUrl(stop.lat, stop.lng);
                                        return (
                                            <div
                                                key={stop.id}
                                                className="rounded-2xl p-4 bg-white dark:bg-[#111623] border border-slate-200/85 dark:border-white/10 shadow-xs flex flex-col justify-between gap-3"
                                            >
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span
                                                            className="text-sm font-black text-slate-900 dark:text-white">
                                                            {stop.name}
                                                        </span>
                                                        <span
                                                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black shrink-0 ${
                                                                stop.directionTag === "시내방면"
                                                                    ? "bg-blue-500/12 text-blue-700 dark:text-blue-300"
                                                                    : stop.directionTag === "공통"
                                                                        ? "bg-slate-500/12 text-slate-700 dark:text-slate-300"
                                                                        : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                                                            }`}
                                                        >
                                                            {stop.directionTag}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                                                        {stop.locationDescription}
                                                    </p>
                                                    {stop.tips && (
                                                        <p className="flex items-start gap-1.5 text-[11px] font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/[0.06] rounded-xl px-2.5 py-2">
                                                            <Info
                                                                className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[#003876] dark:text-blue-400"/>
                                                            <span>{stop.tips}</span>
                                                        </p>
                                                    )}
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <a
                                                        href={kakaoMapUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-50 dark:bg-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/12 border border-slate-200/80 dark:border-white/10 text-xs font-extrabold text-slate-800 dark:text-slate-100 transition"
                                                    >
                                                        <Navigation
                                                            className="w-3.5 h-3.5 text-[#003876] dark:text-blue-400"/>
                                                        <span>카카오맵</span>
                                                        <ExternalLink className="w-3 h-3 opacity-60"/>
                                                    </a>
                                                    <a
                                                        href={kakaoRoadviewUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-50 dark:bg-white/[0.06] hover:bg-slate-100 dark:hover:bg-white/12 border border-slate-200/80 dark:border-white/10 text-xs font-extrabold text-slate-800 dark:text-slate-100 transition"
                                                    >
                                                        <Camera
                                                            className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400"/>
                                                        <span>로드뷰</span>
                                                        <ExternalLink className="w-3 h-3 opacity-60"/>
                                                    </a>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </section>
                        )}

                        {/* Community Wiki Markdown Article */}
                        <section
                            id="wiki-article-body"
                            className="rounded-3xl p-5 sm:p-7 bg-white dark:bg-[#111623] border border-slate-200/85 dark:border-white/10 shadow-xs space-y-5"
                        >
                            <div
                                className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-white/[0.07]">
                                <div className="flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-[#003876] dark:text-sky-400"/>
                                    <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                                        사용자 참여 위키 가이드
                                    </h2>
                                </div>
                                {!wikiDoc.isProtected && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic("light");
                                            setEditSessionId((n) => n + 1);
                                            setViewMode("edit");
                                        }}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/50 dark:hover:bg-sky-900/50 text-xs font-black text-[#003876] dark:text-sky-300 transition cursor-pointer"
                                    >
                                        <PenLine className="w-3.5 h-3.5"/>
                                        이 문서 직접 편집하기
                                    </button>
                                )}
                            </div>

                            {wikiDoc.markdownBody.trim() ? (
                                <WikiMarkdownRenderer markdown={wikiDoc.markdownBody}/>
                            ) : (
                                <div className="py-10 text-center space-y-2">
                                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                        아직 본문 가이드가 비어 있습니다. 첫 번째 탑승 팁이나 환승 노하우를 남겨 보세요!
                                    </p>
                                    {!wikiDoc.isProtected && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditSessionId((n) => n + 1);
                                                setViewMode("edit");
                                            }}
                                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#003876] text-white text-xs font-black cursor-pointer"
                                        >
                                            <PenLine className="w-3.5 h-3.5"/>
                                            내용 채우기
                                        </button>
                                    )}
                                </div>
                            )}
                        </section>
                    </>
                )}
            </main>

            <Footer isCampusPage={wikiDoc.slug === YONSEI_MIRAE_WIKI_SLUG}/>

            {viewMode === "read" && hasInteractiveTransit && (
                <>
                    <FloatingBottomNav
                        activeModal={activeModal}
                        cityCode={wikiDoc.cityCode}
                        hasLinkedRoutes={wikiDoc.linkedRoutes.length > 0}
                        hasShuttle={Boolean(shuttleScheduleData && shuttleInfo)}
                        hasBoardingStops={wikiDoc.boardingStops.length > 0}
                        onScrollTop={() => {
                            triggerHaptic("light");
                            window.scrollTo({top: 0, behavior: "smooth"});
                        }}
                        onOpenCityBusModal={() =>
                            handleOpenCityTimetable(
                                linkedRouteNumbers[0] ?? wikiDoc.linkedRoutes[0]?.routeNo ?? "30",
                                directionMode === "OUTBOUND" ? "dest" : "origin"
                            )
                        }
                        onOpenShuttleModal={() => handleOpenShuttleModal(directionMode)}
                        onOpenStopsModal={() => {
                            triggerHaptic("light");
                            setIsStopsModalOpen(true);
                        }}
                        onOpenSettingsModal={() => {
                            triggerHaptic("light");
                            setIsSettingsModalOpen(true);
                        }}
                    />

                    <CityBusTimetableModal
                        key={`${cityModalState.routeNo}-${cityModalState.location}-${cityModalState.isOpen}`}
                        isOpen={cityModalState.isOpen}
                        initialRouteNo={cityModalState.routeNo}
                        initialLocation={cityModalState.location}
                        allRoutes={allRoutes}
                        routeNumbers={linkedRouteNumbers.length > 0 ? linkedRouteNumbers : undefined}
                        routeOverrides={routeOverridesMap}
                        isHolidayOrVacation={isHolidayOrVacation}
                        now={now}
                        onClose={() => setCityModalState((prev) => ({...prev, isOpen: false}))}
                    />

                    {shuttleScheduleData && (
                        <ShuttleTimetableModal
                            key={`shuttle-${shuttleModalState.tab}-${shuttleModalState.isOpen}`}
                            isOpen={shuttleModalState.isOpen}
                            initialTab={shuttleModalState.tab}
                            dayMode={dayMode}
                            now={now}
                            shuttleSchedule={shuttleScheduleData}
                            onClose={() => setShuttleModalState((prev) => ({...prev, isOpen: false}))}
                        />
                    )}

                    <ShuttleStopsModal
                        key={`stops-${directionMode}-${isStopsModalOpen}`}
                        isOpen={isStopsModalOpen}
                        initialDirectionMode={directionMode}
                        stops={wikiDoc.boardingStops}
                        onClose={() => setIsStopsModalOpen(false)}
                    />

                    <WikiTransitSettingsModal
                        isOpen={isSettingsModalOpen}
                        dayMode={dayMode}
                        isTodayWeekendOrHoliday={isTodayWeekendOrHoliday}
                        directionPreference={settings.yonseiDefaultDirection}
                        onDayModeChange={(mode) => updateSettings({defaultDayMode: mode})}
                        onDirectionPreferenceChange={(pref) => {
                            setDirectionOverride(null);
                            updateSettings({yonseiDefaultDirection: pref});
                        }}
                        onClose={() => setIsSettingsModalOpen(false)}
                    />
                </>
            )}
        </div>
    );
};

export default WikiPageView;
