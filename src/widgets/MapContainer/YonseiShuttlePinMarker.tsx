"use client";

import React, {memo, useCallback, useEffect, useMemo, useState} from "react";
import {Marker, Popup} from "react-map-gl/maplibre";
import {Clock, ExternalLink, GraduationCap, MapPin, RotateCw, X,} from "lucide-react";

import {type ShuttleInboundItem, type ShuttleOutboundItem, YONSEI_SHUTTLE_SCHEDULE,} from "@entities/schedule";
import {getKakaoRoadviewUrl} from "@entities/station";
import {useAppMapContext} from "@shared/context/AppMapContext";
import {MAP_SETTINGS} from "@shared/config/env";
import {parseTimeToMinutes} from "@shared/lib/timeUtils";
import type {DayMode} from "@shared/types/navigation";

// ----------------------------------------------------------------------
// Constants & Types
// ----------------------------------------------------------------------

// Exact coordinates for 연세대 미래캠퍼스 미래관 앞 셔틀 승강장
const YONSEI_CAMPUS_LAT = 37.283476;
const YONSEI_CAMPUS_LNG = 127.900657;

// Minimum zoom level required to show the campus shuttle pinpoint marker on map
export const MIN_YONSEI_SHUTTLE_PIN_ZOOM = 14.0;

export interface YonseiShuttlePinMarkerProps {
    enabled?: boolean;
    dayMode?: DayMode;
    isTodayWeekendOrHoliday?: boolean;
}

type ShuttleDirection = "OUTBOUND" | "INBOUND";
type ShuttleDayType = "WEEKDAY" | "SUNDAY";

// ----------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------

export const YonseiShuttlePinMarker = memo(function YonseiShuttlePinMarker({
                                                                               enabled = true,
                                                                               dayMode = "AUTO",
                                                                               isTodayWeekendOrHoliday: _isTodayWeekendOrHoliday,
                                                                           }: YonseiShuttlePinMarkerProps) {
    const {map} = useAppMapContext();

    // Track map zoom level to only show pin when zoomed in closely
    const [zoom, setZoom] = useState<number>(() => map?.getZoom() ?? MAP_SETTINGS.ZOOM.DEFAULT);

    useEffect(() => {
        if (!map) return;
        setZoom(map.getZoom());
        const updateZoom = () => {
            setZoom(map.getZoom());
        };
        map.on("zoom", updateZoom);
        map.on("zoomend", updateZoom);
        return () => {
            map.off("zoom", updateZoom);
            map.off("zoomend", updateZoom);
        };
    }, [map]);

    // 1. Live clock for countdown calculation (updates every 15s)
    const [now, setNow] = useState<Date>(() => new Date());
    useEffect(() => {
        if (!enabled) return;
        const timer = setInterval(() => setNow(new Date()), 15000);
        return () => clearInterval(timer);
    }, [enabled]);

    // 2. Active Day Filter (WEEKDAY vs SUNDAY)
    const [manualDayType, setManualDayType] = useState<ShuttleDayType | null>(null);

    // Reset manual selection when global dayMode changes
    useEffect(() => {
        setManualDayType(null);
    }, [dayMode]);

    const activeDayType: ShuttleDayType = useMemo(() => {
        if (manualDayType) return manualDayType;
        if (dayMode === "WEEKDAY") return "WEEKDAY";
        if (dayMode === "VACATION") return "SUNDAY";
        // AUTO: Sunday is day 0
        return now.getDay() === 0 ? "SUNDAY" : "WEEKDAY";
    }, [manualDayType, dayMode, now]);

    // 3. Direction State (OUTBOUND: 학교 출발 / INBOUND: 학교 도착)
    const [direction, setDirection] = useState<ShuttleDirection>("OUTBOUND");
    const [isPopupOpen, setIsPopupOpen] = useState(false);

    const currentMins = now.getHours() * 60 + now.getMinutes();

    // 4. Sorted departures & next departure calculation
    const isSundayFilter = activeDayType === "SUNDAY";

    // Outbound (하교 / 학교 출발)
    const outboundList: ShuttleOutboundItem[] = useMemo(() => {
        return YONSEI_SHUTTLE_SCHEDULE.outbound_from_campus
            .filter((item) =>
                isSundayFilter
                    ? item.operation_type.includes("일요일")
                    : !item.operation_type.includes("일요일")
            )
            .slice()
            .sort(
                (a, b) =>
                    (parseTimeToMinutes(a.departure_time) ?? 0) -
                    (parseTimeToMinutes(b.departure_time) ?? 0)
            );
    }, [isSundayFilter]);

    // Inbound (등교 / 학교 도착)
    const inboundList: ShuttleInboundItem[] = useMemo(() => {
        return YONSEI_SHUTTLE_SCHEDULE.inbound_to_campus
            .filter((item) =>
                isSundayFilter
                    ? item.operation_type.includes("일요일")
                    : !item.operation_type.includes("일요일")
            )
            .slice()
            .sort(
                (a, b) =>
                    (parseTimeToMinutes(a.departure_time) ?? 0) -
                    (parseTimeToMinutes(b.departure_time) ?? 0)
            );
    }, [isSundayFilter]);

    // Next Outbound
    const nextOutbound = useMemo(() => {
        return outboundList.find((item) => {
            const m = parseTimeToMinutes(item.departure_time);
            return m !== null && m >= currentMins;
        });
    }, [outboundList, currentMins]);

    const nextOutboundWaitMins = useMemo(() => {
        if (!nextOutbound) return null;
        const m = parseTimeToMinutes(nextOutbound.departure_time);
        return m !== null ? m - currentMins : null;
    }, [nextOutbound, currentMins]);

    // Next Inbound
    const nextInbound = useMemo(() => {
        return inboundList.find((item) => {
            const m = parseTimeToMinutes(item.departure_time);
            return m !== null && m >= currentMins;
        });
    }, [inboundList, currentMins]);

    const nextInboundWaitMins = useMemo(() => {
        if (!nextInbound) return null;
        const m = parseTimeToMinutes(nextInbound.departure_time);
        return m !== null ? m - currentMins : null;
    }, [nextInbound, currentMins]);

    // Active departure for popup spotlight card
    const activeNext = direction === "OUTBOUND" ? nextOutbound : nextInbound;
    const activeWaitMins = direction === "OUTBOUND" ? nextOutboundWaitMins : nextInboundWaitMins;

    const handleFlyToCampus = useCallback(() => {
        if (!map) return;
        map.flyTo({
            center: [YONSEI_CAMPUS_LNG, YONSEI_CAMPUS_LAT],
            zoom: 16.5,
            duration: 800,
        });
    }, [map]);

    const isZoomVisible = zoom >= MIN_YONSEI_SHUTTLE_PIN_ZOOM;
    if (!enabled || (!isZoomVisible && !isPopupOpen)) return null;

    return (
        <>
            {/* 1. Yonsei Shuttle Pin Marker on Map */}
            <Marker
                longitude={YONSEI_CAMPUS_LNG}
                latitude={YONSEI_CAMPUS_LAT}
                anchor="bottom"
                style={{zIndex: 36, pointerEvents: "auto", cursor: "pointer"}}
                onClick={(e) => {
                    e.originalEvent?.stopPropagation();
                    setIsPopupOpen(true);
                }}
            >
                <div
                    className="relative flex flex-col items-center select-none group transition-transform duration-200 hover:scale-105 active:scale-95"
                    title="연세대학교 미래캠퍼스 무료 셔틀버스 시간표"
                    aria-label="연세대학교 미래캠퍼스 무료 셔틀버스 시간표"
                >
                    {/* Floating Pill Label */}
                    <div
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shadow-lg border backdrop-blur-md bg-gradient-to-r from-[#003876] to-[#002147] text-white border-sky-300/80 shadow-[#003876]/40 ring-2 ring-sky-400/25">
                        <div className="flex items-center justify-center w-4 h-4 rounded-full bg-white/20 shrink-0">
                            <GraduationCap className="w-2.5 h-2.5 text-white stroke-[2.5]"/>
                        </div>
                        <div className="flex flex-col text-left leading-tight">
                            <span className="text-[9px] uppercase font-black tracking-wider text-sky-200">
                                무료 셔틀 시간표
                            </span>
                            <span className="font-extrabold text-[11px] max-w-[120px] truncate text-white">
                                연세대 미래관
                            </span>
                        </div>
                        {nextOutbound ? (
                            <div className="ml-1 pl-1.5 border-l border-white/25 flex flex-col items-end leading-none">
                                <span className="font-mono font-black text-[11px] text-white">
                                    {nextOutbound.departure_time}
                                </span>
                                <span className="text-[9px] font-bold text-sky-200">
                                    {nextOutboundWaitMins !== null && nextOutboundWaitMins <= 0
                                        ? "곧 출발"
                                        : `${nextOutboundWaitMins}분 후`}
                                </span>
                            </div>
                        ) : (
                            <div className="ml-1 pl-1.5 border-l border-white/25 flex flex-col items-end leading-none">
                                <span className="text-[10px] font-extrabold text-sky-200">
                                    운행 종료
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Downward Pointer Triangle */}
                    <div
                        className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-[#002147] -mt-px"/>

                    {/* Ground Beacon Pulse Dot */}
                    <div className="relative flex items-center justify-center w-3 h-3 -mt-0.5">
                        <span
                            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-sky-400"/>
                        <span
                            className="relative inline-flex rounded-full h-2 w-2 border border-white shadow-xs bg-[#003876]"/>
                    </div>
                </div>
            </Marker>

            {/* 2. Interactive Shuttle Timetable Popup */}
            {isPopupOpen && (
                <Popup
                    longitude={YONSEI_CAMPUS_LNG}
                    latitude={YONSEI_CAMPUS_LAT}
                    closeButton={false}
                    closeOnClick={true}
                    onClose={() => setIsPopupOpen(false)}
                    className="custom-bus-stop-popup"
                    maxWidth="none"
                    offset={[0, -24]}
                    style={{zIndex: 110}}
                >
                    <div
                        className="flex flex-col bg-white/95 dark:bg-[#111111]/95 backdrop-blur-3xl overflow-hidden rounded-[28px] shadow-[0_8px_32px_rgba(0,0,0,0.2)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.65)] border border-black/10 dark:border-white/10 w-84 sm:w-96 max-sm:fixed max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:w-full max-sm:rounded-b-none max-sm:rounded-t-[28px] max-sm:max-h-[78dvh] max-sm:z-[110] max-sm:shadow-[0_-12px_40px_rgba(0,0,0,0.4)] animate-slideUp select-none"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Mobile Drawer Grab Indicator */}
                        <div className="pt-2 pb-0.5 flex justify-center sm:hidden">
                            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-slate-700"/>
                        </div>

                        {/* Popup Header */}
                        <div className="p-4 border-b border-black/5 dark:border-white/5 space-y-3">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div
                                        className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#003876] text-white shadow-sm shrink-0">
                                        <GraduationCap className="w-4 h-4 stroke-[2.5]"/>
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span
                                                className="px-1.5 py-0.2 rounded-md text-[10px] font-black bg-[#003876] text-white shrink-0">
                                                연세대학교 무료 셔틀
                                            </span>
                                            <span
                                                className="px-1.5 py-0.2 rounded-md text-[10px] font-black bg-black/5 dark:bg-white/10 text-slate-700 dark:text-slate-300 shrink-0">
                                                연세대 미래캠퍼스
                                            </span>
                                        </div>
                                        <h3 className="text-base font-extrabold text-slate-900 dark:text-white truncate mt-0.5">
                                            미래관 앞 승하차장
                                        </h3>
                                    </div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => setIsPopupOpen(false)}
                                    className="p-1.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 hover:text-slate-900 dark:hover:text-white transition cursor-pointer"
                                    aria-label="시간표 닫기"
                                >
                                    <X className="w-4 h-4"/>
                                </button>
                            </div>

                            {/* Direction Switcher (하교 vs 등교) */}
                            <div className="grid grid-cols-2 rounded-xl bg-slate-100 dark:bg-white/5 p-1 gap-1">
                                <button
                                    type="button"
                                    onClick={() => setDirection("OUTBOUND")}
                                    className={`py-1.5 px-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer truncate ${
                                        direction === "OUTBOUND"
                                            ? "bg-[#003876] text-white shadow-xs"
                                            : "text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5"
                                    }`}
                                >
                                    <Clock className="w-3.5 h-3.5 shrink-0"/>
                                    <span>하교 (학교 출발)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setDirection("INBOUND")}
                                    className={`py-1.5 px-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer truncate ${
                                        direction === "INBOUND"
                                            ? "bg-indigo-600 text-white shadow-xs"
                                            : "text-slate-600 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5"
                                    }`}
                                >
                                    <RotateCw className="w-3.5 h-3.5 shrink-0"/>
                                    <span>등교 (학교 도착)</span>
                                </button>
                            </div>

                            {/* Day Filter Pills (평일 vs 일요일) */}
                            <div className="flex items-center justify-between pt-0.5 text-xs">
                                <span className="text-[11px] font-extrabold text-slate-500 dark:text-slate-400">
                                    운행 요일:
                                </span>
                                <div className="flex items-center gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setManualDayType("WEEKDAY")}
                                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition cursor-pointer ${
                                            activeDayType === "WEEKDAY"
                                                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-xs"
                                                : "bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10"
                                        }`}
                                    >
                                        평일 운행
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setManualDayType("SUNDAY")}
                                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border transition cursor-pointer ${
                                            activeDayType === "SUNDAY"
                                                ? "bg-indigo-600 text-white border-transparent shadow-xs"
                                                : "bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10"
                                        }`}
                                    >
                                        일요일 운행
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Popup Body: Next Departure & Full List */}
                        <div className="p-4 space-y-3.5 max-h-[50vh] overflow-y-auto custom-scrollbar">
                            {/* Live Next Departure Spotlight Card */}
                            <div
                                className={`p-3.5 rounded-2xl border ${
                                    direction === "OUTBOUND"
                                        ? "bg-blue-50/70 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60"
                                        : "bg-indigo-50/70 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-900/60"
                                }`}
                            >
                                <div
                                    className="text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center justify-between">
                                    <span>
                                        {direction === "OUTBOUND"
                                            ? "다음 하교 셔틀 출발"
                                            : "다음 등교 셔틀 (시내 발)"}
                                    </span>
                                    <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400">
                                        학생·교직원 무료
                                    </span>
                                </div>

                                {activeNext ? (
                                    <div className="space-y-1">
                                        <div className="flex items-baseline justify-between gap-2">
                                            <div className="flex items-baseline gap-1.5">
                                                <span
                                                    className="text-2xl font-black font-mono tracking-tight text-[#003876] dark:text-blue-300">
                                                    {activeNext.departure_time}
                                                </span>
                                                <span
                                                    className="text-xs font-extrabold text-slate-500 dark:text-slate-400">
                                                    출발
                                                </span>
                                            </div>
                                            <span
                                                className={`px-2 py-0.5 rounded-full text-xs font-black shadow-xs ${
                                                    activeWaitMins !== null && activeWaitMins <= 0
                                                        ? "bg-rose-600 text-white animate-pulse"
                                                        : "bg-blue-600 text-white"
                                                }`}
                                            >
                                                {activeWaitMins !== null && activeWaitMins <= 0
                                                    ? "곧 출발"
                                                    : `${activeWaitMins}분 후 출발`}
                                            </span>
                                        </div>

                                        <div
                                            className="text-xs font-extrabold text-slate-800 dark:text-slate-200 pt-0.5">
                                            {direction === "OUTBOUND" ? (
                                                <span>
                                                    행선지:{" "}
                                                    <strong className="text-blue-700 dark:text-blue-300">
                                                        {(activeNext as ShuttleOutboundItem).destination}
                                                    </strong>
                                                </span>
                                            ) : (
                                                <span>
                                                    출발지:{" "}
                                                    <strong className="text-indigo-700 dark:text-indigo-300">
                                                        {(activeNext as ShuttleInboundItem).departure_point}
                                                    </strong>
                                                </span>
                                            )}
                                        </div>

                                        {activeNext.via.length > 0 && (
                                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                                경유:{" "}
                                                {activeNext.via.map((v) => v.name).join(" → ")}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="py-2 text-center text-xs font-extrabold text-slate-400">
                                        오늘 예정된 {direction === "OUTBOUND" ? "하교" : "등교"}{" "}
                                        셔틀 운행이 종료되었습니다.
                                    </div>
                                )}
                            </div>

                            {/* Scheduled Departures List */}
                            <div className="space-y-1.5">
                                <div
                                    className="flex items-center justify-between text-[11px] font-extrabold text-slate-500 dark:text-slate-400">
                                    <span>
                                        {direction === "OUTBOUND"
                                            ? `미래관 발 전체 운행 시간표 (${activeDayType === "WEEKDAY" ? "평일" : "일요일"})`
                                            : `등교 셔틀 전체 운행 시간표 (${activeDayType === "WEEKDAY" ? "평일" : "일요일"})`}
                                    </span>
                                    <span>
                                        총{" "}
                                        {direction === "OUTBOUND"
                                            ? outboundList.length
                                            : inboundList.length}
                                        회
                                    </span>
                                </div>

                                <div
                                    className="max-h-40 overflow-y-auto rounded-xl border border-black/5 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] p-1.5 divide-y divide-black/5 dark:divide-white/5 custom-scrollbar">
                                    {(direction === "OUTBOUND" ? outboundList : inboundList).map(
                                        (item, idx) => {
                                            const isNext =
                                                activeNext?.departure_time === item.departure_time &&
                                                (direction === "OUTBOUND"
                                                    ? (item as ShuttleOutboundItem).destination ===
                                                    (activeNext as ShuttleOutboundItem)?.destination
                                                    : (item as ShuttleInboundItem).departure_point ===
                                                    (activeNext as ShuttleInboundItem)?.departure_point);

                                            return (
                                                <div
                                                    key={`${item.departure_time}-${idx}`}
                                                    className={`flex items-center justify-between px-2 py-1.5 text-xs transition-colors rounded ${
                                                        isNext
                                                            ? "bg-blue-500/15 font-black text-blue-700 dark:text-blue-300"
                                                            : "text-slate-700 dark:text-slate-300 hover:bg-black/5 dark:hover:bg-white/5"
                                                    }`}
                                                >
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <span className="font-mono font-bold text-xs">
                                                            {item.departure_time}
                                                        </span>
                                                        <div className="min-w-0">
                                                            <div className="truncate text-xs font-extrabold">
                                                                {direction === "OUTBOUND"
                                                                    ? `→ ${(item as ShuttleOutboundItem).destination}`
                                                                    : `${(item as ShuttleInboundItem).departure_point} 발`}
                                                            </div>
                                                            {item.via.length > 0 && (
                                                                <div
                                                                    className="truncate text-[10px] text-slate-400 font-normal">
                                                                    경유: {item.via.map((v) => v.name).join(", ")}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {isNext && (
                                                        <span
                                                            className="ml-2 px-1.5 py-0.2 rounded text-[10px] font-black bg-blue-600 text-white shrink-0">
                                                            다음
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        }
                                    )}
                                </div>
                            </div>

                            {/* Guidelines Note Box */}
                            <div
                                className="p-2.5 rounded-xl bg-slate-50 dark:bg-white/5 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
                                <p className="font-bold text-slate-700 dark:text-slate-300">
                                    ※ 탑승 및 운행 안내
                                </p>
                                <p>• 연세대학교 미래캠퍼스 학생 및 교직원을 위한 무료 셔틀입니다.</p>
                                <p>• 도로 및 교통 상황에 따라 5~10분 지연될 수 있습니다.</p>
                                <p>• 토요일 및 공휴일에는 셔틀버스가 운행하지 않습니다.</p>
                            </div>

                            {/* External Links */}
                            <div className="pt-1 flex items-center justify-between gap-2 text-xs">
                                <button
                                    type="button"
                                    onClick={handleFlyToCampus}
                                    className="flex items-center gap-1 text-[11px] font-bold text-slate-600 dark:text-slate-400 hover:text-blue-600 transition cursor-pointer"
                                >
                                    <MapPin className="w-3.5 h-3.5 text-blue-600"/>
                                    <span>미래관으로 이동</span>
                                </button>

                                <a
                                    href={getKakaoRoadviewUrl(YONSEI_CAMPUS_LAT, YONSEI_CAMPUS_LNG)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                                >
                                    <span>승강장 로드뷰</span>
                                    <ExternalLink className="w-3 h-3"/>
                                </a>
                            </div>
                        </div>
                    </div>
                </Popup>
            )}
        </>
    );
});

export default YonseiShuttlePinMarker;
