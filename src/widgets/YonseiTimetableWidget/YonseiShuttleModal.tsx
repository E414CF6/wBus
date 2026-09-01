"use client";

import React, {useEffect, useMemo, useState} from "react";
import {createPortal} from "react-dom";
import {YONSEI_SHUTTLE_SCHEDULE} from "@/data/yonseiShuttleSchedule";
import {parseTimeToMinutes} from "@shared/lib/timeUtils";
import {ArrowRight, Bus, Clock, Info, MapPin, Search, ShieldAlert, Sparkles, X} from "lucide-react";

interface YonseiShuttleModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentTime?: Date;
}

type ShuttleTab = "inbound" | "outbound" | "stops" | "guidelines";
type DayFilter = "ALL" | "WEEKDAY" | "SUNDAY";

export const YonseiShuttleModal: React.FC<YonseiShuttleModalProps> = ({
                                                                          isOpen,
                                                                          onClose,
                                                                          currentTime,
                                                                      }) => {
    const [mounted, setMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<ShuttleTab>("inbound");
    const [dayFilter, setDayFilter] = useState<DayFilter>("ALL");
    const [searchQuery, setSearchQuery] = useState("");
    const [now, setNow] = useState<Date>(() => currentTime || new Date());

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (currentTime) setNow(currentTime);
    }, [currentTime]);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 10000);
        return () => clearInterval(timer);
    }, []);

    const currentMins = now.getHours() * 60 + now.getMinutes();
    const isSunday = now.getDay() === 0;

    // Filter and Sort Inbound Items by departure_time ascending
    const filteredInbound = useMemo(() => {
        return YONSEI_SHUTTLE_SCHEDULE.inbound_to_campus
            .filter((item) => {
                // Day filter
                if (dayFilter === "WEEKDAY" && item.operation_type.includes("일요일")) return false;
                if (dayFilter === "SUNDAY" && !item.operation_type.includes("일요일")) return false;

                // Search query
                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase().trim();
                    const matchPoint = item.departure_point.toLowerCase().includes(q);
                    const matchTime = item.departure_time.includes(q);
                    const matchDest = item.destination.toLowerCase().includes(q);
                    const matchVia = item.via.some((v) => v.name.toLowerCase().includes(q));
                    const matchNote = item.note ? item.note.toLowerCase().includes(q) : false;
                    if (!matchPoint && !matchTime && !matchDest && !matchVia && !matchNote) return false;
                }

                return true;
            })
            .slice()
            .sort((a, b) => (parseTimeToMinutes(a.departure_time) ?? 0) - (parseTimeToMinutes(b.departure_time) ?? 0));
    }, [dayFilter, searchQuery]);

    // Filter and Sort Outbound Items by departure_time ascending
    const filteredOutbound = useMemo(() => {
        return YONSEI_SHUTTLE_SCHEDULE.outbound_from_campus
            .filter((item) => {
                // Day filter
                if (dayFilter === "WEEKDAY" && item.operation_type.includes("일요일")) return false;
                if (dayFilter === "SUNDAY" && !item.operation_type.includes("일요일")) return false;

                // Search query
                if (searchQuery.trim()) {
                    const q = searchQuery.toLowerCase().trim();
                    const matchPoint = item.departure_point.toLowerCase().includes(q);
                    const matchTime = item.departure_time.includes(q);
                    const matchDest = item.destination.toLowerCase().includes(q);
                    const matchVia = item.via.some((v) => v.name.toLowerCase().includes(q));
                    const matchNote = item.note ? item.note.toLowerCase().includes(q) : false;
                    if (!matchPoint && !matchTime && !matchDest && !matchVia && !matchNote) return false;
                }

                return true;
            })
            .slice()
            .sort((a, b) => (parseTimeToMinutes(a.departure_time) ?? 0) - (parseTimeToMinutes(b.departure_time) ?? 0));
    }, [dayFilter, searchQuery]);

    // Next upcoming index for inbound (based on earliest time >= currentMins)
    const nextInboundIdx = useMemo(() => {
        for (let i = 0; i < filteredInbound.length; i++) {
            const item = filteredInbound[i];
            const isItemSunday = item.operation_type.includes("일요일");
            if (isSunday !== isItemSunday && dayFilter === "ALL") continue;
            const mins = parseTimeToMinutes(item.departure_time);
            if (mins !== null && mins >= currentMins) {
                return i;
            }
        }
        return -1;
    }, [filteredInbound, currentMins, isSunday, dayFilter]);

    // Next upcoming index for outbound (based on earliest time >= currentMins)
    const nextOutboundIdx = useMemo(() => {
        for (let i = 0; i < filteredOutbound.length; i++) {
            const item = filteredOutbound[i];
            const isItemSunday = item.operation_type.includes("일요일");
            if (isSunday !== isItemSunday && dayFilter === "ALL") continue;
            const mins = parseTimeToMinutes(item.departure_time);
            if (mins !== null && mins >= currentMins) {
                return i;
            }
        }
        return -1;
    }, [filteredOutbound, currentMins, isSunday, dayFilter]);

    if (!isOpen || !mounted) return null;

    const modalContent = (
        <div
            className="fixed inset-0 z-9999 flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 dark:bg-black/80 backdrop-blur-lg animate-fadeIn pointer-events-auto"
            onClick={onClose}
        >
            <div
                className="w-full max-w-4xl h-[90dvh] sm:h-auto sm:max-h-[88vh] rounded-3xl border border-teal-500/30 dark:border-teal-500/20 shadow-2xl flex flex-col overflow-hidden bg-white dark:bg-[#111622] transition-colors duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="p-4 sm:p-5 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/90 dark:bg-white/[0.03] flex items-center justify-between gap-3 shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div
                            className="px-3 sm:px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-700 text-white font-black text-sm sm:text-base tracking-tight shadow-md shadow-teal-700/20 shrink-0 flex items-center gap-1.5">
                            <Bus className="w-4 h-4"/>
                            <span>셔틀버스</span>
                        </div>
                        <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate">
                                {YONSEI_SHUTTLE_SCHEDULE.title}
                            </h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium truncate">
                                연세대학교 미래캠퍼스 셔틀버스
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer active:scale-95 shrink-0"
                    >
                        <X className="h-4 w-4"/>
                    </button>
                </div>

                {/* Sub Tab Navigation */}
                <div
                    className="px-3 sm:px-6 pt-3 pb-2 border-b border-slate-200/80 dark:border-white/10 bg-white/50 dark:bg-[#111622]/50 flex flex-wrap items-center justify-between gap-2 shrink-0">
                    {/* Tabs */}
                    <div
                        className="flex items-center gap-1 sm:gap-1.5 bg-slate-100 dark:bg-white/[0.06] p-1 rounded-2xl">
                        <button
                            onClick={() => setActiveTab("inbound")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                                activeTab === "inbound"
                                    ? "bg-teal-600 text-white shadow-sm"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            <ArrowRight className="w-3.5 h-3.5 rotate-45"/>
                            <span>등교</span>
                            <span className="text-[10px] opacity-80 font-mono">17</span>
                        </button>
                        <button
                            onClick={() => setActiveTab("outbound")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                                activeTab === "outbound"
                                    ? "bg-emerald-600 text-white shadow-sm"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            <ArrowRight className="w-3.5 h-3.5 -rotate-45"/>
                            <span>하교</span>
                            <span className="text-[10px] opacity-80 font-mono">12</span>
                        </button>
                        <button
                            onClick={() => setActiveTab("stops")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                                activeTab === "stops"
                                    ? "bg-blue-600 text-white shadow-sm"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            <MapPin className="w-3.5 h-3.5"/>
                            <span>탑승 장소</span>
                        </button>
                        <button
                            onClick={() => setActiveTab("guidelines")}
                            className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 ${
                                activeTab === "guidelines"
                                    ? "bg-amber-600 text-white shadow-sm"
                                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                            }`}
                        >
                            <Info className="w-3.5 h-3.5"/>
                            <span>이용 안내</span>
                        </button>
                    </div>

                    {/* Day Filter Pills (Only for Inbound & Outbound) */}
                    {(activeTab === "inbound" || activeTab === "outbound") && (
                        <div className="flex items-center gap-1 text-[11px] font-bold">
                            <button
                                onClick={() => setDayFilter("ALL")}
                                className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                                    dayFilter === "ALL"
                                        ? "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-500/40 font-black"
                                        : "bg-slate-50 dark:bg-white/[0.03] text-slate-500 border-slate-200 dark:border-white/5"
                                }`}
                            >
                                전체
                            </button>
                            <button
                                onClick={() => setDayFilter("WEEKDAY")}
                                className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                                    dayFilter === "WEEKDAY"
                                        ? "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-500/40 font-black"
                                        : "bg-slate-50 dark:bg-white/[0.03] text-slate-500 border-slate-200 dark:border-white/5"
                                }`}
                            >
                                평일 운행
                            </button>
                            <button
                                onClick={() => setDayFilter("SUNDAY")}
                                className={`px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                                    dayFilter === "SUNDAY"
                                        ? "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-500/40 font-black"
                                        : "bg-slate-50 dark:bg-white/[0.03] text-slate-500 border-slate-200 dark:border-white/5"
                                }`}
                            >
                                일요일 특별편
                            </button>
                        </div>
                    )}
                </div>

                {/* Search Bar for Timetable Tabs */}
                {(activeTab === "inbound" || activeTab === "outbound") && (
                    <div
                        className="px-3 sm:px-6 py-2.5 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.02] flex items-center justify-between gap-3 shrink-0">
                        <div className="relative flex-1">
                            <Search className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="정류장명 (여주역, 터미널, 원주역, 세브란스 등) 또는 시간 검색..."
                                className="w-full pl-8 pr-4 py-1.5 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-transparent focus:border-teal-500/50 text-xs font-semibold text-slate-900 dark:text-white outline-none transition-all"
                            />
                        </div>
                        <div className="text-[11px] font-bold text-slate-400 shrink-0 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400"/>
                            <span>
                                {activeTab === "inbound"
                                    ? `총 ${filteredInbound.length}회 운행`
                                    : `총 ${filteredOutbound.length}회 운행`}
                            </span>
                        </div>
                    </div>
                )}

                {/* Modal Body Container */}
                <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-6 space-y-3">
                    {/* TAB 1: Inbound (등교 / 캠퍼스행) */}
                    {activeTab === "inbound" && (
                        <div className="space-y-3">
                            {filteredInbound.length === 0 ? (
                                <div className="py-12 text-center text-slate-400 text-xs font-medium">
                                    검색 조건에 일치하는 등교 셔틀버스가 없습니다.
                                </div>
                            ) : (
                                filteredInbound.map((item, idx) => {
                                    const isNext = idx === nextInboundIdx;
                                    const isSundayItem = item.operation_type.includes("일요일");

                                    return (
                                        <div
                                            key={idx}
                                            className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                                                isNext
                                                    ? "bg-teal-500/[0.08] dark:bg-teal-500/[0.14] border-teal-500 ring-2 ring-teal-500/40 shadow-md"
                                                    : "bg-slate-50/70 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/5 hover:border-teal-500/30"
                                            }`}
                                        >
                                            {/* Top Row: Operation type, Departure time & point, Destination */}
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span
                                                        className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white">
                                                        {item.departure_time}
                                                    </span>
                                                    <span
                                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                                                            isSundayItem
                                                                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30"
                                                                : "bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-300 dark:border-teal-500/30"
                                                        }`}
                                                    >
                                                        {item.operation_type}
                                                    </span>
                                                    {item.note && (
                                                        <span
                                                            className="px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 text-[10px] font-extrabold border border-blue-200 dark:border-blue-500/30">
                                                            {item.note}
                                                        </span>
                                                    )}
                                                    {isNext && (
                                                        <span
                                                            className="px-2 py-0.5 rounded-lg bg-teal-600 text-white text-[10px] font-black shadow-xs animate-pulse">
                                                            다음 버스
                                                        </span>
                                                    )}
                                                </div>

                                                <div
                                                    className="text-xs font-black text-teal-700 dark:text-teal-300 shrink-0 flex items-center gap-1">
                                                    <span>{item.destination}</span>
                                                    <span className="text-[10px] font-medium text-slate-400">도착</span>
                                                </div>
                                            </div>

                                            {/* Departure Point */}
                                            <div
                                                className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 mb-2.5">
                                                <MapPin
                                                    className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400 shrink-0"/>
                                                <span>출발지: <strong
                                                    className="text-teal-700 dark:text-teal-300">{item.departure_point}</strong></span>
                                            </div>

                                            {/* Via Stops Strip */}
                                            {item.via.length > 0 ? (
                                                <div
                                                    className="p-2.5 rounded-xl bg-white/80 dark:bg-[#161c2b] border border-slate-200/60 dark:border-white/5">
                                                    <div
                                                        className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                                        경유 정류장 및 통과 시각
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        {item.via.map((v, vIdx) => (
                                                            <div
                                                                key={vIdx}
                                                                className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium border ${
                                                                    v.time
                                                                        ? "bg-teal-50/90 dark:bg-teal-950/40 text-teal-950 dark:text-teal-200 border-teal-300 dark:border-teal-500/40 font-bold"
                                                                        : "bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 border-black/5 dark:border-white/5"
                                                                }`}
                                                            >
                                                                <span>{v.name}</span>
                                                                {v.time && (
                                                                    <span
                                                                        className="font-mono font-black text-teal-600 dark:text-teal-400 text-[11px]">
                                                                        ({v.time})
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div
                                                    className="text-[11px] font-medium text-slate-400 dark:text-slate-500 italic">
                                                    중간 경유지 없음 (직행 노선)
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* TAB 2: Outbound (하교 / 캠퍼스발) */}
                    {activeTab === "outbound" && (
                        <div className="space-y-3">
                            {filteredOutbound.length === 0 ? (
                                <div className="py-12 text-center text-slate-400 text-xs font-medium">
                                    검색 조건에 일치하는 하교 셔틀버스가 없습니다.
                                </div>
                            ) : (
                                filteredOutbound.map((item, idx) => {
                                    const isNext = idx === nextOutboundIdx;
                                    const isSundayItem = item.operation_type.includes("일요일");

                                    return (
                                        <div
                                            key={idx}
                                            className={`p-3.5 sm:p-4 rounded-2xl border transition-all ${
                                                isNext
                                                    ? "bg-emerald-500/[0.08] dark:bg-emerald-500/[0.14] border-emerald-500 ring-2 ring-emerald-500/40 shadow-md"
                                                    : "bg-slate-50/70 dark:bg-white/[0.02] border-slate-200/80 dark:border-white/5 hover:border-emerald-500/30"
                                            }`}
                                        >
                                            {/* Top Row: Operation type, Departure time & point, Destination */}
                                            <div className="flex items-start justify-between gap-2 mb-2">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span
                                                        className="text-xl sm:text-2xl font-black font-mono text-slate-900 dark:text-white">
                                                        {item.departure_time}
                                                    </span>
                                                    <span
                                                        className={`px-2 py-0.5 rounded-lg text-[10px] font-black border ${
                                                            isSundayItem
                                                                ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-300 dark:border-amber-500/30"
                                                                : "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/30"
                                                        }`}
                                                    >
                                                        {item.operation_type}
                                                    </span>
                                                    <span
                                                        className="text-xs font-bold text-slate-600 dark:text-slate-300">
                                                        출발: <strong>{item.departure_point}</strong>
                                                    </span>
                                                    {isNext && (
                                                        <span
                                                            className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black shadow-xs animate-pulse">
                                                            다음 버스
                                                        </span>
                                                    )}
                                                </div>

                                                <div
                                                    className="text-xs font-black text-emerald-700 dark:text-emerald-300 shrink-0 flex items-center gap-1">
                                                    <span>→ {item.destination} 행</span>
                                                </div>
                                            </div>

                                            {/* Note alert if present */}
                                            {item.note && (
                                                <div
                                                    className="px-2.5 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs font-bold mb-2.5 flex items-center gap-1.5">
                                                    <Sparkles
                                                        className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0"/>
                                                    <span>{item.note}</span>
                                                </div>
                                            )}

                                            {/* Via Stops */}
                                            {item.via.length > 0 ? (
                                                <div
                                                    className="p-2.5 rounded-xl bg-white/80 dark:bg-[#161c2b] border border-slate-200/60 dark:border-white/5">
                                                    <div
                                                        className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                                                        하차 경유 정류장
                                                    </div>
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        {item.via.map((v, vIdx) => (
                                                            <div
                                                                key={vIdx}
                                                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium bg-slate-100 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 border border-black/5 dark:border-white/5"
                                                            >
                                                                <span>{v.name}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div
                                                    className="text-[11px] font-medium text-slate-400 dark:text-slate-500 italic">
                                                    중간 경유지 없음 (직행 노선)
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}

                    {/* TAB 3: Stop Locations (탑승 장소 안내) */}
                    {activeTab === "stops" && (
                        <div className="space-y-3">
                            <div
                                className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-500/30 text-xs text-blue-900 dark:text-blue-200 font-medium flex items-center gap-2">
                                <Info className="w-4 h-4 text-blue-600 shrink-0"/>
                                <span>
                                    무료 셔틀버스는 지정된 탑승 장소에서만 승하차가 가능합니다. 출발 5분 전까지 대기해주세요.
                                </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {YONSEI_SHUTTLE_SCHEDULE.stop_locations.map((stop, idx) => (
                                    <div
                                        key={idx}
                                        className="p-4 rounded-2xl bg-slate-50/80 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 flex flex-col justify-between space-y-2 hover:border-blue-500/40 transition-colors"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-7 h-7 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
                                                {idx + 1}
                                            </div>
                                            <h4 className="text-sm font-black text-slate-900 dark:text-white">
                                                {stop.name}
                                            </h4>
                                        </div>

                                        <div
                                            className="p-2.5 rounded-xl bg-white dark:bg-[#181e2c] border border-slate-200/60 dark:border-white/5 text-xs font-semibold text-slate-700 dark:text-slate-200 leading-relaxed flex items-start gap-1.5">
                                            <MapPin
                                                className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5"/>
                                            <span>{stop.location_description}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* TAB 4: Guidelines (이용 안내) */}
                    {activeTab === "guidelines" && (
                        <div className="space-y-4">
                            <div
                                className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-500/30 text-amber-950 dark:text-amber-200 flex items-start gap-2.5">
                                <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5"/>
                                <div>
                                    <h4 className="text-xs sm:text-sm font-black">무료 셔틀버스 이용 시 준수사항</h4>
                                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mt-0.5 leading-relaxed">
                                        안전하고 쾌적한 통학을 위해 아래 안내사항을 반드시 숙지하여 주시기 바랍니다.
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-2.5">
                                {YONSEI_SHUTTLE_SCHEDULE.guidelines.map((rule, idx) => (
                                    <div
                                        key={idx}
                                        className="p-3.5 rounded-2xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 flex items-start gap-3"
                                    >
                                        <div
                                            className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-950/60 text-teal-800 dark:text-teal-300 font-black text-xs flex items-center justify-center shrink-0 mt-0.5">
                                            {idx + 1}
                                        </div>
                                        <div
                                            className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
                                            {rule}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
