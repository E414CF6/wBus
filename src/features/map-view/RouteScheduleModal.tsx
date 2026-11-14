"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Clock, RotateCw, X} from "lucide-react";

import {
    type BusRoute,
    DualHourlyTimetableBlock,
    getNextDeparture,
    resolveActiveScheduleVariant,
    useSchedule
} from "@entities/schedule";
import {getRouteMeta} from "@entities/route/routeMetadata";
import {NoticeBanner, NoticeModal} from "@entities/notice";
import {Modal} from "@shared/ui";
import type {DayMode} from "@shared/types/navigation";
import {exportScheduleCsv} from "./schedule-modal/exportScheduleCsv";
import {FullTimetableTable} from "./schedule-modal/FullTimetableTable";
import {NextDepartureCards} from "./schedule-modal/NextDepartureCards";

export interface RouteScheduleModalProps {
    isOpen: boolean;
    routeName: string;
    onClose: () => void;
    dayMode?: DayMode;
    isTodayWeekendOrHoliday?: boolean;
    embedded?: boolean;
    initialLocation?: "origin" | "dest";
}

type TimetableViewMode = "summary" | "full";

export const RouteScheduleModal: React.FC<RouteScheduleModalProps> = ({
                                                                          isOpen,
                                                                          routeName,
                                                                          onClose,
                                                                          dayMode = "AUTO",
                                                                          isTodayWeekendOrHoliday,
                                                                          embedded = false,
                                                                          initialLocation,
                                                                      }) => {
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
    const [hourlyLocation, setHourlyLocation] = useState<"dest" | "origin">(initialLocation ?? "dest");
    const [prevInitialLocation, setPrevInitialLocation] = useState(initialLocation);
    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

    // Sync hourlyLocation and reset nested notice modal state when modal opens/closes (render-phase state update)
    if (isOpen !== prevIsOpen || initialLocation !== prevInitialLocation) {
        setPrevIsOpen(isOpen);
        setPrevInitialLocation(initialLocation);
        if (isOpen && initialLocation && hourlyLocation !== initialLocation) {
            setHourlyLocation(initialLocation);
        }
        if (!isOpen) {
            setIsNoticeModalOpen(false);
            setSelectedNoticeId(null);
        }
    }

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
        const target =
            tableRef.current.querySelector<HTMLElement>('[data-target-next="true"]') ||
            tableRef.current.querySelector<HTMLElement>('[data-next-departure="true"]');
        if (target && typeof target.scrollIntoView === "function") {
            target.scrollIntoView({behavior: "smooth", block: "center"});
        }
    }, []);

    const handleExportCsv = useCallback(() => {
        if (!activeVariant) return;
        exportScheduleCsv(activeVariant, routeName, originName, destName);
    }, [activeVariant, originName, destName, routeName]);

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
                    {nextDepInfo && (
                        <NextDepartureCards
                            nextDepInfo={nextDepInfo}
                            dayType={activeVariant.dayType}
                            originName={originName}
                            destName={destName}
                            hourlyLocation={hourlyLocation}
                            onSelectLocation={setHourlyLocation}
                            embedded={embedded}
                        />
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
                                departureLocation={hourlyLocation}
                            />
                        </div>
                    )}

                    {viewMode === "full" && (
                        <FullTimetableTable
                            dayType={activeVariant.dayType}
                            originName={originName}
                            destName={destName}
                            hourlyLocation={hourlyLocation}
                            filteredTimetable={filteredTimetable}
                            nextDepInfo={nextDepInfo}
                            tableSearch={tableSearch}
                            onTableSearchChange={setTableSearch}
                            tableRef={tableRef}
                            onScrollToNextRow={scrollToNextRow}
                            onExportCsv={handleExportCsv}
                            embedded={embedded}
                        />
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

    const modalIcon = (
        <span
            className="px-2.5 py-1 rounded-xl text-xs font-black text-white shadow-xs shrink-0"
            style={{backgroundColor: routeMeta.colorTheme.main}}
        >
            {routeName}번
        </span>
    );

    const modalSubtitle = (
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
    );

    const modalActions = (
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
    );

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title={`${originName} ↔ ${destName}`}
                subtitle={modalSubtitle}
                icon={modalIcon}
                headerActions={modalActions}
                maxWidth="2xl"
                height="default"
                modalId="schedule"
                suspended={isNoticeModalOpen}
                ariaLabel={`${routeName}번 버스 시간표`}
            >
                {renderBodyContent()}
            </Modal>

            {/* 원주시 교통정보센터 공지사항 상세 모달 (중첩 모달, z-[120] 기본 지원) */}
            <NoticeModal
                isOpen={isNoticeModalOpen}
                onClose={handleCloseNotice}
                initialNoticeId={selectedNoticeId}
                zIndex="z-[120]"
            />
        </>
    );
};

export default RouteScheduleModal;
