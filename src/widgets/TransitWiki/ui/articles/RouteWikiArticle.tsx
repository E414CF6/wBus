"use client";

import React, {useCallback, useMemo, useRef, useState} from "react";
import {Clock, LocateFixed, MapPin, RotateCw, Search, Star, X,} from "lucide-react";
import {type BusRoute, getNextDeparture} from "@entities/schedule";
import {getRouteMeta} from "@entities/route/routeMetadata";
import {useBusStop} from "@entities/station/hooks";
import type {BusStop} from "@entities/station/types";
import type {CityInfo} from "@entities/city";
import {DualHourlyTimetableBlock} from "../WikiPrimitives";

interface RouteWikiArticleProps {
    routeNo: string;
    city: CityInfo;
    routes: BusRoute[];
    isRouteBookmarked: (route: BusRoute) => boolean;
    onToggleBookmark: (routeId: string) => void;
    onNavigate: (docId: string) => void;
    onSelectMapRoute?: (routeName: string) => void;
    onFocusStopOnMap?: (stop: BusStop, routeName: string) => void;
    now: Date;
}

type TimetableViewMode = "summary" | "full" | "stops";

export const RouteWikiArticle: React.FC<RouteWikiArticleProps> = ({
    routeNo,
    city,
    routes,
    isRouteBookmarked,
    onToggleBookmark,
                                                                      onNavigate: _onNavigate,
    onSelectMapRoute,
    onFocusStopOnMap,
    now,
}) => {
    const shortCity = city.name.split("/")[0];
    const routeMeta = useMemo(
        () => getRouteMeta(routeNo, city.code),
        [routeNo, city.code]
    );

    // Matching schedule variants for this routeNo (e.g. 평일, 방학·휴일, 토요일 등)
    const variants = useMemo(
        () => routes.filter((r) => r.routeNo === routeNo),
        [routes, routeNo]
    );

    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const activeVariant: BusRoute | null = useMemo(() => {
        if (variants.length === 0) return null;
        if (selectedVariantId) {
            const found = variants.find((v) => v.id === selectedVariantId);
            if (found) return found;
        }
        return variants[0];
    }, [variants, selectedVariantId]);

    const [viewMode, setViewMode] = useState<TimetableViewMode>("summary");
    const [hourlyLocation, setHourlyLocation] = useState<"dest" | "origin">("dest");
    const [tableSearch, setTableSearch] = useState("");
    const [stopSearch, setStopSearch] = useState("");
    const tableRef = useRef<HTMLDivElement>(null);

    // Fetch route stops
    const routeStops = useBusStop(routeNo, city.code);

    const nextDepInfo = useMemo(() => {
        if (!activeVariant) return null;
        return getNextDeparture(activeVariant.timetable, now);
    }, [activeVariant, now]);

    const filteredTimetable = useMemo(() => {
        if (!activeVariant) return [];
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

    const filteredStops = useMemo(() => {
        if (!stopSearch.trim()) return routeStops;
        const q = stopSearch.toLowerCase().trim();
        return routeStops.filter(
            (s) =>
                s.nodenm.toLowerCase().includes(q) ||
                (s.nodeno && String(s.nodeno).toLowerCase().includes(q))
        );
    }, [routeStops, stopSearch]);

    const scrollToNextRow = useCallback(() => {
        if (!tableRef.current) return;
        const target = tableRef.current.querySelector<HTMLElement>(
            '[data-next-departure="true"]'
        );
        if (target && typeof target.scrollIntoView === "function") {
            target.scrollIntoView({behavior: "smooth", block: "center"});
        }
    }, []);

    const isBookmarked = activeVariant ? isRouteBookmarked(activeVariant) : false;
    const originName = activeVariant?.origin || routeMeta.origin || shortCity;
    const destName = activeVariant?.destination || routeMeta.destination || "종점";
    const typeLabel =
        routeMeta.genericType === "EXPRESS"
            ? "급행버스"
            : routeMeta.genericType === "BRANCH"
                ? "지선·공영버스"
                : "간선버스";

    return (
        <div className="space-y-4">
            {/* 1. Modern Route Header Hero Banner */}
            <div
                className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-[#131722] dark:via-[#181d2b] dark:to-[#131722] text-white p-4 sm:p-5 shadow-md border border-slate-700/60 dark:border-white/10">
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span
                                className="px-2.5 py-1 rounded-xl text-xs font-black shadow-xs shrink-0"
                                style={{backgroundColor: routeMeta.colorTheme.main}}
                            >
                                {routeNo}번
                            </span>
                            <span
                                className="px-2 py-0.5 rounded-lg bg-white/10 text-[11px] font-bold text-slate-300 shrink-0">
                                {shortCity} {typeLabel}
                            </span>
                        </div>
                        <h2 className="text-lg sm:text-xl font-extrabold tracking-tight truncate">
                            {originName} ↔ {destName}
                        </h2>
                        {activeVariant && (
                            <div className="flex items-center gap-2 text-xs text-slate-300 flex-wrap">
                                <span className="font-mono font-bold">
                                    첫차 {activeVariant.firstBus} · 막차 {activeVariant.lastBus}
                                </span>
                                <span>•</span>
                                <span>
                                    {activeVariant.runCount}회 운행 (배차 {activeVariant.interval})
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
                        {activeVariant && (
                            <button
                                type="button"
                                onClick={() => onToggleBookmark(activeVariant.id)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border transition cursor-pointer active:scale-95 ${
                                    isBookmarked
                                        ? "bg-amber-500 text-white border-amber-400 shadow-xs"
                                        : "bg-white/10 hover:bg-white/15 text-slate-200 border-white/10"
                                }`}
                            >
                                <Star
                                    className={`w-3.5 h-3.5 ${
                                        isBookmarked ? "fill-white text-white" : "text-amber-400"
                                    }`}
                                />
                                <span>{isBookmarked ? "즐겨찾기됨" : "즐겨찾기"}</span>
                            </button>
                        )}
                        {onSelectMapRoute && (
                            <button
                                type="button"
                                onClick={() => onSelectMapRoute(routeNo)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-black shadow-xs transition cursor-pointer active:scale-95"
                            >
                                <MapPin className="w-3.5 h-3.5"/>
                                <span>지도에서 노선·핀 보기</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. Next Departure Spotlight (Dual Terminus Cards) */}
            {activeVariant && nextDepInfo && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Origin Terminus Next Departure */}
                    <div
                        className="p-3.5 rounded-2xl bg-blue-50/70 dark:bg-blue-950/25 border border-blue-200 dark:border-blue-900/50 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <div
                                className="flex items-center gap-1.5 text-[11px] font-bold text-blue-700 dark:text-blue-300">
                                <Clock className="w-3.5 h-3.5 shrink-0"/>
                                <span className="truncate">기점 ({originName}) 다음 출발</span>
                            </div>
                            <div className="flex items-baseline gap-2 mt-1">
                                {nextDepInfo.nextOrigin ? (
                                    <>
                                        <span className="font-mono text-xl font-black text-blue-900 dark:text-blue-100">
                                            {nextDepInfo.nextOrigin.originDepTime}
                                        </span>
                                        <span className="text-xs font-extrabold text-blue-600 dark:text-blue-400">
                                            {nextDepInfo.originWaitMins !== null &&
                                                (nextDepInfo.originWaitMins <= 0
                                                    ? "곧 출발"
                                                    : `${nextDepInfo.originWaitMins}분 후`)}
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-xs font-bold text-slate-400">
                                        금일 운행 종료
                                    </span>
                                )}
                            </div>
                        </div>
                        <span
                            className="px-2 py-0.5 rounded-lg bg-blue-500/10 text-[10px] font-black text-blue-700 dark:text-blue-300 shrink-0">
                            {activeVariant.dayType}
                        </span>
                    </div>

                    {/* Turnaround Terminus Next Departure */}
                    <div
                        className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/50 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                            <div
                                className="flex items-center gap-1.5 text-[11px] font-bold text-amber-700 dark:text-amber-300">
                                <RotateCw className="w-3.5 h-3.5 shrink-0"/>
                                <span className="truncate">종점/회차지 ({destName}) 다음 출발</span>
                            </div>
                            <div className="flex items-baseline gap-2 mt-1">
                                {nextDepInfo.nextDest ? (
                                    <>
                                        <span
                                            className="font-mono text-xl font-black text-amber-900 dark:text-amber-100">
                                            {nextDepInfo.nextDest.destDepTime}
                                        </span>
                                        <span className="text-xs font-extrabold text-amber-600 dark:text-amber-400">
                                            {nextDepInfo.destWaitMins !== null &&
                                                (nextDepInfo.destWaitMins <= 0
                                                    ? "곧 출발"
                                                    : `${nextDepInfo.destWaitMins}분 후`)}
                                        </span>
                                    </>
                                ) : (
                                    <span className="text-xs font-bold text-slate-400">
                                        금일 운행 종료
                                    </span>
                                )}
                            </div>
                        </div>
                        <span
                            className="px-2 py-0.5 rounded-lg bg-amber-500/10 text-[10px] font-black text-amber-700 dark:text-amber-300 shrink-0">
                            {activeVariant.dayType}
                        </span>
                    </div>
                </div>
            )}

            {/* 3. View Mode Switcher (Clean Segments instead of Wiki TOC) */}
            <div className="flex items-center justify-between gap-2 border-b border-black/5 dark:border-white/5 pb-2">
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
                    <button
                        type="button"
                        onClick={() => setViewMode("stops")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                            viewMode === "stops"
                                ? "bg-white dark:bg-[#1f2433] text-slate-900 dark:text-white shadow-xs"
                                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                    >
                        경유 정류장 ({routeStops.length})
                    </button>
                </div>

                {/* Day Variant Quick Switcher (when active in any view) */}
                {variants.length > 1 && (
                    <div className="flex items-center gap-1 overflow-x-auto custom-scrollbar-hidden">
                        {variants.map((v) => (
                            <button
                                key={v.id}
                                type="button"
                                onClick={() => setSelectedVariantId(v.id)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition cursor-pointer whitespace-nowrap ${
                                    activeVariant?.id === v.id
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

            {/* 4. Tab Content 1: 시간대별 요약 시간표 */}
            {viewMode === "summary" && activeVariant && (
                <div className="space-y-3">
                    {/* Location Toggle (회차지 vs 기점) */}
                    <div
                        className="flex items-center justify-between gap-2 p-2 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-black/5 dark:border-white/5">
                        <span className="text-xs font-extrabold text-slate-600 dark:text-slate-300">
                            출발 기준 선택:
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                type="button"
                                onClick={() => setHourlyLocation("dest")}
                                className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
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
                                className={`px-2.5 py-1 rounded-lg text-xs font-black transition cursor-pointer ${
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
                        allRoutes={routes}
                        now={now}
                        locationLabel={hourlyLocation === "dest" ? `${destName} 종점` : `${originName} 기점`}
                    />
                </div>
            )}

            {/* 5. Tab Content 2: 회차별 전체 상세 시간표 */}
            {viewMode === "full" && activeVariant && (
                <div className="space-y-3">
                    {/* Search & Actions Bar */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                                {activeVariant.dayType} 전체 운행 회차 ({filteredTimetable.length}회)
                            </span>
                            {nextDepInfo && (nextDepInfo.nextOrigin || nextDepInfo.nextDest) && (
                                <button
                                    type="button"
                                    onClick={scrollToNextRow}
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-300 text-[11px] font-extrabold border border-blue-200 dark:border-blue-800 cursor-pointer active:scale-95 transition"
                                >
                                    <LocateFixed className="w-3 h-3"/>
                                    <span>다음 출발 행으로</span>
                                </button>
                            )}
                        </div>

                        <div className="relative w-full sm:w-60">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
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
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Full Sequence Timetable Table */}
                    <div
                        ref={tableRef}
                        className="max-h-120 overflow-y-auto rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#12151e] shadow-xs custom-scrollbar"
                    >
                        <table className="w-full border-collapse text-left text-xs">
                            <thead
                                className="sticky top-0 z-10 bg-slate-100/95 dark:bg-[#1b202e]/95 backdrop-blur-md text-slate-700 dark:text-slate-200 border-b border-black/5 dark:border-white/10 font-extrabold">
                                <tr>
                                    <th className="py-2.5 px-3 w-14 text-center border-r border-black/5 dark:border-white/10">
                                        회차
                                    </th>
                                    <th className="py-2.5 px-3 border-r border-black/5 dark:border-white/10">
                                        기점 출발 ({originName})
                                    </th>
                                    <th className="py-2.5 px-3 border-r border-black/5 dark:border-white/10">
                                        종점/회차지 출발 ({destName})
                                    </th>
                                    <th className="py-2.5 px-3">비고 / 경유</th>
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
                                                <td className="py-2.5 px-2.5 text-center font-mono text-slate-400 border-r border-black/5 dark:border-white/10">
                                                    {row.seq}
                                                </td>
                                                <td className="py-2.5 px-3 font-mono border-r border-black/5 dark:border-white/10">
                                                    <span
                                                        className={
                                                            isNextOrigin
                                                                ? "px-2 py-0.5 rounded-md bg-blue-600 text-white font-black"
                                                                : "font-bold text-slate-900 dark:text-slate-100"
                                                        }
                                                    >
                                                        {row.originDepTime}
                                                    </span>
                                                    {isNextOrigin && (
                                                        <span
                                                            className="ml-1.5 text-[10px] font-sans font-extrabold text-blue-600 dark:text-blue-400">
                                                            다음 기점 출발
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3 font-mono border-r border-black/5 dark:border-white/10">
                                                    <span
                                                        className={
                                                            isNextDest
                                                                ? "px-2 py-0.5 rounded-md bg-amber-600 text-white font-black"
                                                                : "font-bold text-slate-900 dark:text-slate-100"
                                                        }
                                                    >
                                                        {row.destDepTime}
                                                    </span>
                                                    {isNextDest && (
                                                        <span
                                                            className="ml-1.5 text-[10px] font-sans font-extrabold text-amber-600 dark:text-amber-400">
                                                            다음 종점 출발
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-2.5 px-3 text-slate-600 dark:text-slate-400">
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

            {/* 6. Tab Content 3: 경유 정류장 일람 */}
            {viewMode === "stops" && (
                <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-slate-700 dark:text-slate-200">
                            총 {routeStops.length}개 정류소 (정류장 클릭 시 지도 이동)
                        </span>

                        <div className="relative w-full sm:w-60">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                            <input
                                type="text"
                                value={stopSearch}
                                onChange={(e) => setStopSearch(e.target.value)}
                                placeholder="정류장 이름·번호 검색"
                                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#11141c] text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                            {stopSearch && (
                                <button
                                    type="button"
                                    onClick={() => setStopSearch("")}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                >
                                    <X className="w-3 h-3"/>
                                </button>
                            )}
                        </div>
                    </div>

                    <div
                        className="max-h-120 overflow-y-auto rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#12151e] p-2 custom-scrollbar">
                        {filteredStops.length === 0 ? (
                            <div className="py-8 text-center text-slate-400 text-xs">
                                {stopSearch ? `"${stopSearch}" 검색 결과가 없습니다.` : "경유 정류장 정보가 없습니다."}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-1.5">
                                {filteredStops.map((stop, idx) => (
                                    <button
                                        key={`${stop.nodeid}-${idx}`}
                                        type="button"
                                        onClick={() => onFocusStopOnMap?.(stop, routeNo)}
                                        className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-black/5 dark:border-white/10 hover:border-blue-500 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 text-left transition cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span
                                                className="w-5 h-5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                                                {stop.nodeord ?? idx + 1}
                                            </span>
                                            <span
                                                className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate">
                                                {stop.nodenm}
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-mono text-slate-400 shrink-0">
                                            {stop.nodeno || ""}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default RouteWikiArticle;
