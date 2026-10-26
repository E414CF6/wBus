"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from "react";
import {createPortal} from "react-dom";
import {Clock, LocateFixed, RotateCw, Search, X} from "lucide-react";

import {
    type BusRoute,
    DualHourlyTimetableBlock,
    getNextDeparture,
    resolveActiveScheduleVariant,
    useSchedule
} from "@entities/schedule";
import {getRouteMeta} from "@entities/route/routeMetadata";
import {NoticeBanner, NoticeModal} from "@widgets/NoticeWidget";
import {useBodyScrollLock} from "@shared/ui/useBodyScrollLock";
import type {DayMode} from "@shared/types/navigation";

export interface RouteScheduleModalProps {
    isOpen: boolean;
    routeName: string;
    onClose: () => void;
    dayMode?: DayMode;
    isTodayWeekendOrHoliday?: boolean;
    embedded?: boolean;
}

type TimetableViewMode = "summary" | "full";

const emptySubscribe = () => () => {
};

export const RouteScheduleModal: React.FC<RouteScheduleModalProps> = ({
    isOpen,
    routeName,
    onClose,
    dayMode = "AUTO",
    isTodayWeekendOrHoliday,
                                                                          embedded = false,
}) => {
    const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);
    useBodyScrollLock(isOpen && !embedded);

    // Escape key to close
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    // Live clock for next departure countdown
    const [now, setNow] = useState<Date>(() => new Date());
    useEffect(() => {
        if (!isOpen) return;
        const timer = setInterval(() => setNow(new Date()), 15000);
        return () => clearInterval(timer);
    }, [isOpen]);

    // Fetch Wonju bus schedule data
    const {
        data: scheduleData,
        routes: scheduleRoutes,
        meta: scheduleMeta,
        isLoading,
        refresh: refreshSchedule,
        isRefreshing: isScheduleRefreshing,
    } = useSchedule(isOpen);

    // Format recent update timestamp
    const formattedUpdatedAt = useMemo(() => {
        const raw = scheduleData?.updatedAt || scheduleMeta?.updatedAt;
        if (!raw) return null;
        try {
            const d = new Date(raw);
            if (isNaN(d.getTime())) return null;
            return (
                d.toLocaleDateString("ko-KR", {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                }) +
                " " +
                d.toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                })
            );
        } catch {
            return null;
        }
    }, [scheduleData?.updatedAt, scheduleMeta?.updatedAt]);

    // Notice modal state
    const [isNoticeModalOpen, setIsNoticeModalOpen] = useState(false);
    const [selectedNoticeId, setSelectedNoticeId] = useState<string | null>(null);

    const handleOpenNotice = useCallback((noticeId?: string) => {
        setSelectedNoticeId(noticeId || null);
        setIsNoticeModalOpen(true);
    }, []);

    const handleCloseNotice = useCallback(() => {
        setIsNoticeModalOpen(false);
        setSelectedNoticeId(null);
    }, []);

    const matchingVariants = useMemo(
        () => (scheduleRoutes ? scheduleRoutes.filter((r) => r.routeNo === routeName) : []),
        [scheduleRoutes, routeName]
    );

    // Day type selection (평일, 토요일, 방학·휴일 등)
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [prevSelectionKey, setPrevSelectionKey] = useState(() => `${dayMode}_${routeName}`);

    // Reset variant selection during render when dayMode or routeName changes
    const currentSelectionKey = `${dayMode}_${routeName}`;
    if (prevSelectionKey !== currentSelectionKey) {
        setPrevSelectionKey(currentSelectionKey);
        setSelectedVariantId(null);
    }

    const activeVariant: BusRoute | null = useMemo(() => {
        return resolveActiveScheduleVariant(
            matchingVariants,
            selectedVariantId,
            dayMode,
            isTodayWeekendOrHoliday
        );
    }, [matchingVariants, selectedVariantId, dayMode, isTodayWeekendOrHoliday]);

    const routeMeta = useMemo(() => getRouteMeta(routeName, "32020"), [routeName]);

    const originName = activeVariant?.origin || routeMeta.origin || "기점";
    const destName = activeVariant?.destination || routeMeta.destination || "종점";

    const nextDepInfo = useMemo(() => {
        if (!activeVariant?.timetable) return null;
        return getNextDeparture(activeVariant.timetable, now);
    }, [activeVariant, now]);

    // View states
    const [viewMode, setViewMode] = useState<TimetableViewMode>("summary");
    const [hourlyLocation, setHourlyLocation] = useState<"dest" | "origin">("dest");
    const [tableSearch, setTableSearch] = useState("");
    const tableRef = useRef<HTMLDivElement>(null);

    const filteredTimetable = useMemo(() => {
        if (!activeVariant?.timetable) return [];
        if (!tableSearch.trim()) return activeVariant.timetable;
        const q = tableSearch.toLowerCase().trim();
        return activeVariant.timetable.filter(
            (item) =>
                item.originDepTime.toLowerCase().includes(q) ||
                item.destDepTime.toLowerCase().includes(q) ||
                item.type.toLowerCase().includes(q) ||
                item.notes.toLowerCase().includes(q)
        );
    }, [activeVariant, tableSearch]);

    const scrollToNextRow = useCallback(() => {
        if (!tableRef.current) return;
        const target = tableRef.current.querySelector<HTMLElement>('[data-next-departure="true"]');
        if (target && typeof target.scrollIntoView === "function") {
            target.scrollIntoView({behavior: "smooth", block: "center"});
        }
    }, []);

    if (!isOpen || !isClient) return null;

    const renderBodyContent = () => (
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-3.5 sm:space-y-4 custom-scrollbar flex-1 min-h-0">
            {/* 원주시 교통정보센터 공지사항 배너 */}
            <NoticeBanner onClick={handleOpenNotice} compact={embedded}/>

            {isLoading ? (
                <div className="py-16 text-center text-xs font-bold text-slate-400">
                    시간표 데이터를 불러오는 중입니다...
                </div>
            ) : !activeVariant ? (
                <div className="py-16 text-center text-xs font-bold text-slate-400">
                    {routeName}번 노선의 시간표 정보가 제공되지 않는 노선입니다.
                </div>
            ) : (
                <>
                    {/* Real-time Next Departure Spotlight (Dual Cards) */}
                    {nextDepInfo && (
                        <div className={`grid ${embedded ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2"} gap-2.5`}>
                            {/* Origin Next Departure */}
                            <div
                                className="p-3 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <div
                                        className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700 dark:text-blue-300">
                                        <Clock className="w-3 h-3 shrink-0"/>
                                        <span className="truncate">기점 ({originName}) 출발</span>
                                    </div>
                                    <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
                                        {nextDepInfo.nextOrigin ? (
                                            <>
                                                <span
                                                    className="font-mono text-xl font-black text-blue-900 dark:text-blue-100">
                                                    {nextDepInfo.nextOrigin.originDepTime}
                                                </span>
                                                <span
                                                    className="text-[11px] font-extrabold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                                                    (
                                                    {nextDepInfo.originWaitMins !== null &&
                                                        (nextDepInfo.originWaitMins <= 0
                                                            ? "곧 출발"
                                                            : `${nextDepInfo.originWaitMins}분 후`)}
                                                    )
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-xs font-bold text-slate-400">
                                                금일 운행 종료
                                            </span>
                                        )}
                                    </div>
                                    {nextDepInfo.nextOrigin?.notes && (
                                        <div
                                            className="text-[10px] font-bold text-blue-600 dark:text-blue-400 mt-1">
                                            ※ {nextDepInfo.nextOrigin.notes}
                                        </div>
                                    )}
                                </div>
                                <span
                                    className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-[10px] font-black text-blue-700 dark:text-blue-300 shrink-0 self-start">
                                    {activeVariant.dayType}
                                </span>
                            </div>

                            {/* Turnaround Next Departure */}
                            <div
                                className="p-3 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 flex items-center justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <div
                                        className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                                        <RotateCw className="w-3 h-3 shrink-0"/>
                                        <span className="truncate">회차지 ({destName}) 출발</span>
                                    </div>
                                    <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
                                        {nextDepInfo.nextDest ? (
                                            <>
                                                <span
                                                    className="font-mono text-xl font-black text-amber-900 dark:text-amber-100">
                                                    {nextDepInfo.nextDest.destDepTime}
                                                </span>
                                                <span
                                                    className="text-[11px] font-extrabold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                                                    (
                                                    {nextDepInfo.destWaitMins !== null &&
                                                        (nextDepInfo.destWaitMins <= 0
                                                            ? "곧 출발"
                                                            : `${nextDepInfo.destWaitMins}분 후`)}
                                                    )
                                                </span>
                                            </>
                                        ) : (
                                            <span className="text-xs font-bold text-slate-400">
                                                금일 운행 종료
                                            </span>
                                        )}
                                    </div>
                                    {nextDepInfo.nextDest?.notes && (
                                        <div
                                            className="text-[10px] font-bold text-amber-600 dark:text-amber-400 mt-1">
                                            ※ {nextDepInfo.nextDest.notes}
                                        </div>
                                    )}
                                </div>
                                <span
                                    className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-[10px] font-black text-amber-700 dark:text-amber-300 shrink-0 self-start">
                                    {activeVariant.dayType}
                                </span>
                            </div>
                        </div>
                    )}

                    {/* View Switcher & Day Type Selector Bar */}
                    <div
                        className={`flex ${
                            embedded ? "flex-col" : "flex-col sm:flex-row sm:items-center"
                        } justify-between gap-2 border-b border-black/5 dark:border-white/5 pb-2.5`}
                    >
                        <div className="flex items-center gap-1 rounded-xl bg-slate-100 dark:bg-white/5 p-1 shrink-0">
                            <button
                                type="button"
                                onClick={() => setViewMode("summary")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                    viewMode === "summary"
                                        ? "bg-white dark:bg-[#1f2433] text-slate-900 dark:text-white shadow-xs"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                시간대별 요약
                            </button>
                            <button
                                type="button"
                                onClick={() => setViewMode("full")}
                                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                    viewMode === "full"
                                        ? "bg-white dark:bg-[#1f2433] text-slate-900 dark:text-white shadow-xs"
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                                }`}
                            >
                                전체 회차 시간표
                            </button>
                        </div>

                        {matchingVariants.length > 1 && (
                            <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar-hidden">
                                {matchingVariants.map((v) => (
                                    <button
                                        key={v.id}
                                        type="button"
                                        onClick={() => setSelectedVariantId(v.id)}
                                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer whitespace-nowrap ${
                                            activeVariant.id === v.id
                                                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs"
                                                : "bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10"
                                        }`}
                                    >
                                        {v.dayType}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* View 1: 시간대별 요약 그리드 */}
                    {viewMode === "summary" && (
                        <div className="space-y-3">
                            <div
                                className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
                                <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300 shrink-0">
                                    출발 기준:
                                </span>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => setHourlyLocation("dest")}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer whitespace-nowrap ${
                                            hourlyLocation === "dest"
                                                ? "bg-amber-600 text-white shadow-xs"
                                                : "bg-white dark:bg-white/10 text-slate-600 dark:text-slate-300"
                                        }`}
                                    >
                                        회차지 ({destName}) 출발
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setHourlyLocation("origin")}
                                        className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer whitespace-nowrap ${
                                            hourlyLocation === "origin"
                                                ? "bg-blue-600 text-white shadow-xs"
                                                : "bg-white dark:bg-white/10 text-slate-600 dark:text-slate-300"
                                        }`}
                                    >
                                        기점 ({originName}) 출발
                                    </button>
                                </div>
                            </div>

                            <DualHourlyTimetableBlock
                                route={activeVariant}
                                allRoutes={scheduleRoutes}
                                now={now}
                                locationLabel={
                                    hourlyLocation === "dest"
                                        ? `${destName} 종점`
                                        : `${originName} 기점`
                                }
                                compact={embedded}
                            />
                        </div>
                    )}

                    {/* View 2: 전체 회차별 시간표 목록 */}
                    {viewMode === "full" && (
                        <div className="space-y-3">
                            <div
                                className={`flex ${
                                    embedded ? "flex-col" : "flex-col sm:flex-row sm:items-center"
                                } justify-between gap-2`}
                            >
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                                        {activeVariant.dayType} 운행 회차 ({filteredTimetable.length}회)
                                    </span>
                                    {nextDepInfo && (nextDepInfo.nextOrigin || nextDepInfo.nextDest) && (
                                        <button
                                            type="button"
                                            onClick={scrollToNextRow}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 text-[11px] font-extrabold border border-blue-200 dark:border-blue-800 cursor-pointer active:scale-95 transition whitespace-nowrap"
                                        >
                                            <LocateFixed className="w-3 h-3"/>
                                            <span>다음 출발 행으로</span>
                                        </button>
                                    )}
                                </div>

                                <div className={`relative w-full ${embedded ? "" : "sm:w-56"}`}>
                                    <Search
                                        className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                                    <input
                                        type="text"
                                        value={tableSearch}
                                        onChange={(e) => setTableSearch(e.target.value)}
                                        placeholder="시각·비고 검색"
                                        className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#11141c] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    />
                                    {tableSearch && (
                                        <button
                                            type="button"
                                            onClick={() => setTableSearch("")}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                        >
                                            <X className="w-3 h-3"/>
                                        </button>
                                    )}
                                </div>
                            </div>

                            <div
                                ref={tableRef}
                                className="max-h-96 overflow-y-auto rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#12151e] shadow-xs custom-scrollbar"
                            >
                                <table className="w-full border-collapse text-left text-xs">
                                    <thead
                                        className="sticky top-0 z-10 bg-slate-100/95 dark:bg-[#1b202e]/95 backdrop-blur-md text-slate-700 dark:text-slate-200 border-b border-black/5 dark:border-white/10 font-extrabold">
                                    <tr>
                                        <th className="py-2 px-2.5 w-12 text-center border-r border-black/5 dark:border-white/10">
                                            회차
                                        </th>
                                        <th className="py-2 px-3 border-r border-black/5 dark:border-white/10">
                                            기점 출발 ({originName})
                                        </th>
                                        <th className="py-2 px-3 border-r border-black/5 dark:border-white/10">
                                            회차지 출발 ({destName})
                                        </th>
                                        <th className="py-2 px-3">비고</th>
                                    </tr>
                                    </thead>
                                    <tbody className="divide-y divide-black/5 dark:divide-white/5">
                                    {filteredTimetable.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={4}
                                                className="py-8 text-center text-slate-400"
                                            >
                                                일치하는 운행 회차가 없습니다.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredTimetable.map((row) => {
                                            const isNextOrigin =
                                                nextDepInfo?.nextOrigin?.seq === row.seq;
                                            const isNextDest =
                                                nextDepInfo?.nextDest?.seq === row.seq;

                                            return (
                                                <tr
                                                    key={row.seq}
                                                    data-next-departure={
                                                        isNextOrigin || isNextDest
                                                            ? "true"
                                                            : undefined
                                                    }
                                                    className={
                                                        isNextOrigin || isNextDest
                                                            ? "bg-blue-50/80 dark:bg-blue-950/40 font-bold"
                                                            : "hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                                                    }
                                                >
                                                    <td className="py-2 px-2.5 text-center font-mono text-slate-400 border-r border-black/5 dark:border-white/10">
                                                        {row.seq}
                                                    </td>
                                                    <td className="py-2 px-3 font-mono border-r border-black/5 dark:border-white/10">
                                                            <span
                                                                className={
                                                                    isNextOrigin
                                                                        ? "px-1.5 py-0.5 rounded bg-blue-600 text-white font-black"
                                                                        : "font-bold text-slate-900 dark:text-slate-100"
                                                                }
                                                            >
                                                                {row.originDepTime}
                                                            </span>
                                                    </td>
                                                    <td className="py-2 px-3 font-mono border-r border-black/5 dark:border-white/10">
                                                            <span
                                                                className={
                                                                    isNextDest
                                                                        ? "px-1.5 py-0.5 rounded bg-amber-600 text-white font-black"
                                                                        : "font-bold text-slate-900 dark:text-slate-100"
                                                                }
                                                            >
                                                                {row.destDepTime}
                                                            </span>
                                                    </td>
                                                    <td className="py-2 px-3 text-slate-600 dark:text-slate-400">
                                                        {row.notes || "-"}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );

    if (embedded) {
        return (
            <div
                role="region"
                aria-label={`${routeName}번 버스 시간표`}
                className="w-full h-full flex flex-col overflow-hidden bg-white dark:bg-[#11131a] select-none text-slate-900 dark:text-white"
            >
                {/* Embedded Header */}
                <div
                    className="px-4 py-3 border-b border-black/5 dark:border-white/5 bg-slate-50/70 dark:bg-white/[0.02] flex items-center justify-between gap-2 shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                        <span
                            className="px-2 py-0.5 rounded-lg text-xs font-black text-white shadow-xs shrink-0"
                            style={{backgroundColor: routeMeta.colorTheme.main}}
                        >
                            {routeName}번
                        </span>
                        <div className="min-w-0">
                            <h2 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                                {originName} ↔ {destName}
                            </h2>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate">
                                    운행 시간표
                                </p>
                                {formattedUpdatedAt && (
                                    <span
                                        className="inline-flex items-center gap-1 text-[9px] font-bold text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-white/10 px-1.5 py-0.2 rounded font-mono">
                                        <Clock className="w-2.5 h-2.5 opacity-70 shrink-0"/>
                                        <span>갱신 {formattedUpdatedAt}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            onClick={() => refreshSchedule()}
                            disabled={isScheduleRefreshing}
                            className="p-1.5 rounded-full bg-black/5 dark:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer active:scale-95 disabled:opacity-40"
                            aria-label="시간표 새로고침"
                            title="시간표 새로고침"
                        >
                            <RotateCw className={`w-3.5 h-3.5 ${isScheduleRefreshing ? "animate-spin" : ""}`}/>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-full bg-black/5 dark:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer active:scale-95"
                            aria-label="시간표 닫기"
                        >
                            <X className="w-3.5 h-3.5"/>
                        </button>
                    </div>
                </div>

                {renderBodyContent()}

                <NoticeModal
                    isOpen={isNoticeModalOpen}
                    onClose={handleCloseNotice}
                    initialNoticeId={selectedNoticeId}
                />
            </div>
        );
    }

    const modalContent = (
        <div
            className="fixed inset-0 z-120 flex items-center justify-center p-3.5 sm:p-5 bg-black/60 dark:bg-black/75 backdrop-blur-sm transition-opacity duration-200 animate-fadeIn pointer-events-auto"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
            role="dialog"
            aria-modal="true"
            aria-label={`${routeName}번 버스 시간표`}
        >
            <div
                className="relative flex flex-col w-full max-w-2xl h-[82dvh] sm:h-[82dvh] max-h-[82dvh] sm:max-h-[820px] bg-white/95 dark:bg-[#0e1118]/95 backdrop-blur-3xl rounded-[28px] sm:rounded-[32px] shadow-[0_24px_70px_rgba(0,0,0,0.35)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.85)] border border-black/10 dark:border-white/10 overflow-hidden animate-slideUp select-none"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div
                    className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-black/5 dark:border-white/5 bg-slate-50/70 dark:bg-white/[0.02] flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <span
                            className="px-2.5 py-1 rounded-xl text-xs font-black text-white shadow-xs shrink-0"
                            style={{backgroundColor: routeMeta.colorTheme.main}}
                        >
                            {routeName}번
                        </span>
                        <div className="min-w-0">
                            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight truncate">
                                {originName} ↔ {destName}
                            </h2>
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 truncate">
                                    원주시 시내버스 운행 시간표
                                </p>
                                {formattedUpdatedAt && (
                                    <span
                                        className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-200/60 dark:bg-white/10 px-1.5 py-0.5 rounded-md font-mono">
                                        <Clock className="w-2.5 h-2.5 opacity-70 shrink-0"/>
                                        <span>최근 갱신 {formattedUpdatedAt}</span>
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                        <button
                            type="button"
                            onClick={() => refreshSchedule()}
                            disabled={isScheduleRefreshing}
                            className="p-1.5 rounded-full bg-black/5 dark:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer active:scale-95 disabled:opacity-40"
                            aria-label="시간표 새로고침"
                            title="시간표 새로고침"
                        >
                            <RotateCw className={`w-4 h-4 ${isScheduleRefreshing ? "animate-spin" : ""}`}/>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 rounded-full bg-black/5 dark:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer active:scale-95"
                            aria-label="시간표 닫기"
                        >
                            <X className="w-4 h-4"/>
                        </button>
                    </div>
                </div>

                {renderBodyContent()}
            </div>

            {/* 원주시 교통정보센터 공지사항 상세 모달 */}
            <NoticeModal
                isOpen={isNoticeModalOpen}
                onClose={handleCloseNotice}
                initialNoticeId={selectedNoticeId}
            />
        </div>
    );

    return createPortal(modalContent, document.body);
};

export default RouteScheduleModal;
