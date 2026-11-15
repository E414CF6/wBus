"use client";

import React, {useCallback, useDeferredValue, useState, useSyncExternalStore} from "react";
import Link from "next/link";
import {useTheme} from "next-themes";
import {
    BookOpen,
    Bus,
    Clock,
    Compass,
    History,
    Map as MapIcon,
    MapPin,
    Moon,
    Plus,
    Search,
    Sparkles,
    Sun,
    User,
    X,
} from "lucide-react";

import {
    useWikiIndex,
    WIKI_CATEGORIES,
    WIKI_CATEGORY_LABELS,
    type WikiCategory,
    type WikiIndexData,
} from "@entities/wiki";
import {UI_TEXT} from "@shared/config/locale";
import {Footer} from "@shared/ui/Footer";
import {triggerHaptic} from "@shared/utils/haptics";

const emptySubscribe = () => () => {
};

export interface WikiDirectoryPageProps {
    initialData?: WikiIndexData;
    initialQuery?: string;
    initialCategory?: WikiCategory | "all";
}

function formatRelativeOrDate(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const diffMs = Date.now() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "방금 전";
    if (diffMins < 60) return `${diffMins}분 전`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;
    return d.toLocaleDateString("ko-KR", {month: "short", day: "numeric"});
}

export const WikiDirectoryPage: React.FC<WikiDirectoryPageProps> = ({
    initialData,
    initialQuery = "",
    initialCategory = "all",
}) => {
    const [activeCategory, setActiveCategory] = useState<WikiCategory | "all">(initialCategory);
    const [query, setQuery] = useState(initialQuery);
    const [limit, setLimit] = useState(24);
    const deferredQuery = useDeferredValue(query);

    const isDefaultFilter = activeCategory === "all" && !deferredQuery.trim() && limit === 24;
    const {data, isLoading} = useWikiIndex({
        category: activeCategory,
        query: deferredQuery,
        limit,
        fallbackData: isDefaultFilter ? initialData : undefined,
    });

    const pages = data?.pages ?? [];
    const totalCount = data?.totalCount ?? pages.length;
    const hasMore = Boolean(data?.hasMore);
    const recentChanges = data?.recentChanges ?? initialData?.recentChanges ?? [];

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

    return (
        <div className="min-h-screen bg-[#f4f7fb] dark:bg-[#080c15] text-slate-900 dark:text-slate-100 flex flex-col">
            {/* Top Header */}
            <header className="sticky top-0 z-30 backdrop-blur-2xl bg-white/88 dark:bg-[#0b101b]/88 border-b border-slate-200/80 dark:border-white/[0.08]">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.07] dark:hover:bg-white/15 text-xs font-black text-slate-700 dark:text-slate-200 transition shrink-0"
                        >
                            <MapIcon className="w-3.5 h-3.5 text-[#003876] dark:text-sky-400"/>
                            <span>실시간 지도</span>
                        </Link>
                        <div className="flex items-center gap-1.5 min-w-0">
                            <BookOpen className="w-4 h-4 text-[#003876] dark:text-sky-400 shrink-0"/>
                            <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                                wBus 커뮤니티 위키
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <Link
                            href="/wiki/new"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl bg-[#003876] hover:bg-[#00295a] dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-black shadow-xs transition"
                        >
                            <Plus className="w-3.5 h-3.5"/>
                            <span>새 위키</span>
                        </Link>

                        <button
                            type="button"
                            onClick={handleToggleTheme}
                            aria-label={UI_TEXT.ACCESSIBILITY.THEME_SWITCH}
                            className="flex items-center justify-center w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.07] dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
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

            <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
                {/* Intro Hero + Search */}
                <section className="relative overflow-hidden rounded-3xl p-5 sm:p-7 bg-white dark:bg-[#111623] border border-slate-200/85 dark:border-white/10 shadow-xs space-y-4">
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#003876]/[0.06] via-sky-500/[0.03] to-transparent dark:from-[#003876]/30 dark:via-sky-900/15 dark:to-transparent"
                    />
                    <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black bg-[#003876] text-white">
                                <Sparkles className="w-3 h-3"/>
                                누구나 편집하는 실시간 버스 위키
                            </span>
                            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                                캠퍼스 셔틀 · 시내버스 노선 · 정류장 꿀팁을 함께 만드세요
                            </h2>
                            <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
                                로그인 없이도 바로 문서를 고치고, 변경 이력(Diff)과 버전 되돌리기를 통해 정확한 대중교통 정보를 지킬 수 있습니다.
                            </p>
                        </div>
                        <Link
                            href="/wiki/yonsei-mirae"
                            className="shrink-0 inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-sky-50 hover:bg-sky-100 dark:bg-sky-950/60 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-800 text-xs font-black text-[#003876] dark:text-sky-300 transition"
                        >
                            <Compass className="w-4 h-4"/>
                            <span>대표 위키: 연세대 미래캠퍼스</span>
                        </Link>
                    </div>

                    {/* Search + Category Pills */}
                    <div className="relative space-y-3 pt-1">
                        <div className="relative">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"/>
                            <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="캠퍼스, 노선번호(30, 34), 정류장, 태그, 본문 내용으로 위키 검색..."
                                className="w-full pl-10 pr-9 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-950/80 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                            />
                            {query && (
                                <button
                                    type="button"
                                    onClick={() => setQuery("")}
                                    aria-label="검색어 지우기"
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
                                >
                                    <X className="w-3.5 h-3.5"/>
                                </button>
                            )}
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setActiveCategory("all")}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                                    activeCategory === "all"
                                        ? "bg-[#003876] dark:bg-sky-600 text-white"
                                        : "bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-slate-200/70"
                                }`}
                            >
                                전체
                            </button>
                            {WIKI_CATEGORIES.map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setActiveCategory(cat)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer ${
                                        activeCategory === cat
                                            ? "bg-[#003876] dark:bg-sky-600 text-white"
                                            : "bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-300 hover:bg-slate-200/70"
                                    }`}
                                >
                                    {WIKI_CATEGORY_LABELS[cat]}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Main Directory Grid + Recent Changes */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    <section className="lg:col-span-8 space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                                위키 문서 ({totalCount})
                            </h3>
                            {isLoading && (
                                <span className="text-[11px] font-bold text-slate-400">검색 중...</span>
                            )}
                        </div>

                        {pages.length === 0 ? (
                            <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111623] p-10 text-center space-y-3">
                                <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
                                    일치하는 위키 문서가 없습니다.
                                </p>
                                <Link
                                    href={query.trim() ? `/wiki/new?slug=${encodeURIComponent(query.trim())}` : "/wiki/new"}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#003876] text-white text-xs font-black"
                                >
                                    <Plus className="w-3.5 h-3.5"/>
                                    새 위키 문서 만들기
                                </Link>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                {pages.map((page) => (
                                    <Link
                                        key={page.slug}
                                        href={`/wiki/${encodeURIComponent(page.slug)}`}
                                        className="group rounded-2xl p-4 sm:p-5 bg-white dark:bg-[#111623] border border-slate-200/85 dark:border-white/10 hover:border-[#003876]/40 dark:hover:border-sky-500/40 shadow-xs hover:shadow-md transition flex flex-col justify-between gap-3"
                                    >
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[#003876]/10 dark:bg-sky-500/20 text-[#003876] dark:text-sky-300">
                                                    {WIKI_CATEGORY_LABELS[page.category]}
                                                </span>
                                                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-600 dark:text-slate-300 tabular-nums">
                                                    v{page.version}
                                                </span>
                                            </div>
                                            <h4 className="text-base font-black text-slate-900 dark:text-white group-hover:text-[#003876] dark:group-hover:text-sky-400 transition">
                                                {page.title}
                                            </h4>
                                            {page.subtitle && (
                                                <p className="text-xs font-medium text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                                                    {page.subtitle}
                                                </p>
                                            )}
                                        </div>

                                        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-white/[0.06]">
                                            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-extrabold text-slate-600 dark:text-slate-300">
                                                {page.linkedRouteCount > 0 && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300">
                                                        <Bus className="w-3 h-3"/>
                                                        노선 {page.linkedRouteCount}
                                                    </span>
                                                )}
                                                {page.hasShuttle && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300">
                                                        셔틀 시간표
                                                    </span>
                                                )}
                                                {page.boardingStopCount > 0 && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300">
                                                        <MapPin className="w-3 h-3"/>
                                                        승강장 {page.boardingStopCount}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center justify-between text-[11px] font-medium text-slate-400 dark:text-slate-500">
                                                <span className="inline-flex items-center gap-1 truncate">
                                                    <User className="w-3 h-3"/>
                                                    {page.lastEditor.nickname}
                                                </span>
                                                <span className="inline-flex items-center gap-1 shrink-0">
                                                    <Clock className="w-3 h-3"/>
                                                    {formatRelativeOrDate(page.updatedAt)}
                                                </span>
                                            </div>
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}

                        {hasMore && (
                            <div className="pt-2 flex justify-center">
                                <button
                                    type="button"
                                    onClick={() => setLimit((prev) => Math.min(100, prev + 24))}
                                    className="px-5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#111623] hover:bg-slate-50 dark:hover:bg-slate-800 text-xs font-black text-slate-700 dark:text-slate-200 transition cursor-pointer"
                                >
                                    문서 더 보기 ({pages.length} / {totalCount})
                                </button>
                            </div>
                        )}
                    </section>

                    {/* Recent Changes Feed */}
                    <aside className="lg:col-span-4 rounded-2xl border border-slate-200/85 dark:border-white/10 bg-white dark:bg-[#111623] overflow-hidden shadow-xs">
                        <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.08] flex items-center gap-2">
                            <History className="w-4 h-4 text-[#003876] dark:text-sky-400"/>
                            <h3 className="text-xs font-black text-slate-900 dark:text-white">
                                최근 위키 변경
                            </h3>
                        </div>

                        <div className="divide-y divide-slate-100 dark:divide-white/[0.06]">
                            {recentChanges.length === 0 ? (
                                <p className="p-5 text-xs font-medium text-slate-500 dark:text-slate-400 text-center">
                                    아직 커뮤니티 편집 내역이 없습니다. 첫 번째 편집자가 되어 보세요!
                                </p>
                            ) : (
                                recentChanges.map((item) => (
                                    <Link
                                        key={`${item.slug}-${item.version}`}
                                        href={`/wiki/${encodeURIComponent(item.slug)}`}
                                        className="block p-3.5 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition space-y-1"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                                                {item.title}
                                            </span>
                                            <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-black tabular-nums shrink-0">
                                                v{item.version}
                                            </span>
                                        </div>
                                        <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 line-clamp-1">
                                            {item.summary || "문서 편집"}
                                        </p>
                                        <div className="flex items-center justify-between text-[10px] font-medium text-slate-400 dark:text-slate-500">
                                            <span>{item.editor.nickname} · {formatRelativeOrDate(item.createdAt)}</span>
                                            <span className="font-mono">
                                                <span className="text-emerald-600 dark:text-emerald-400">+{item.diffStats.added}</span>{" "}
                                                <span className="text-rose-500">-{item.diffStats.removed}</span>
                                            </span>
                                        </div>
                                    </Link>
                                ))
                            )}
                        </div>
                    </aside>
                </div>
            </main>

            <Footer/>
        </div>
    );
};

export default WikiDirectoryPage;
