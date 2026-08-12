"use client";

import React, {useEffect, useState} from "react";
import {createPortal} from "react-dom";
import {BusRoute} from "@shared/types/bus";
import {parseTimeToMinutes} from "@shared/lib/timeUtils";
import {Download, GraduationCap, MapPin, Search, Star, X} from "lucide-react";

interface YonseiRouteDetailModalProps {
    route: BusRoute | null;
    onClose: () => void;
    isBookmarked: boolean;
    onToggleBookmark: (routeId: string) => void;
    onSelectMapRoute?: (routeName: string) => void;
    currentTime?: Date;
}

export const YonseiRouteDetailModal: React.FC<YonseiRouteDetailModalProps> = ({
                                                                                  route,
                                                                                  onClose,
                                                                                  isBookmarked,
                                                                                  onToggleBookmark,
                                                                                  onSelectMapRoute,
                                                                                  currentTime,
                                                                              }) => {
    const [mounted, setMounted] = useState(false);
    const [tableSearch, setTableSearch] = useState("");
    const [now, setNow] = useState<Date>(() => currentTime || new Date());

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (currentTime) {
            setNow(currentTime);
        }
    }, [currentTime]);

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(new Date());
        }, 10000);
        return () => clearInterval(timer);
    }, []);

    if (!route || !mounted) return null;

    const isHoechon = route.routeNo === "34-1";
    const locationLabel = isHoechon ? "회촌 출발" : "연세대 출발";

    const currentMins = now.getHours() * 60 + now.getMinutes();

    // Valid campus departure timetable entries (excluding Jangyang-ri)
    const campusTimetable = route.timetable.filter(
        (item) => item.destDepTime && item.destDepTime !== "-" && item.destDepTime !== ""
    );

    // Find next upcoming departure index
    let nextUpcomingSeq = -1;
    for (const item of campusTimetable) {
        const mins = parseTimeToMinutes(item.destDepTime);
        if (mins !== null && mins >= currentMins) {
            nextUpcomingSeq = item.seq;
            break;
        }
    }

    const filteredTimetable = campusTimetable.filter((item) => {
        if (!tableSearch) return true;
        const q = tableSearch.toLowerCase();
        return (
            item.destDepTime.includes(q) ||
            item.type.toLowerCase().includes(q) ||
            item.notes.toLowerCase().includes(q)
        );
    });

    const exportCsv = () => {
        const headers = ["순번", `${locationLabel} 시각`, "비고"];
        const rows = campusTimetable.map((t) => [t.seq, t.destDepTime, t.notes]);
        const csvContent =
            "data:text/csv;charset=utf-8,\uFEFF" +
            [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `원주시_시내버스_${route.routeNo}번_${locationLabel}_시간표.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const getRouteBadgeGradient = (no: string) => {
        if (no === "30") return "from-[#003876] to-blue-700 shadow-blue-900/30";
        if (no === "34") return "from-blue-600 to-indigo-600 shadow-blue-500/20";
        if (no === "34-1") return "from-indigo-600 to-purple-600 shadow-indigo-500/20";
        return "from-[#003876] to-blue-700 shadow-blue-900/30";
    };

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 dark:bg-black/80 backdrop-blur-lg animate-fadeIn pointer-events-auto"
            onClick={onClose}
        >
            <div
                className="w-full max-w-3xl max-h-[92vh] rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden bg-white dark:bg-[#121212] transition-colors duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="p-5 sm:p-6 border-b border-black/5 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center space-x-3 mb-2">
                            <div
                                className={`px-4 py-1.5 rounded-2xl bg-gradient-to-r ${getRouteBadgeGradient(
                                    route.routeNo
                                )} font-black text-white text-xl tracking-tight shadow-md`}
                            >
                                {route.routeNo}번
                            </div>
                            <span
                                className="px-3 py-1 rounded-xl text-xs font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                {route.dayType}
                            </span>
                            <button
                                onClick={() => onToggleBookmark(route.id)}
                                className="p-1.5 rounded-xl bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors cursor-pointer"
                                title={isBookmarked ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                            >
                                <Star
                                    className={`h-4 w-4 ${
                                        isBookmarked ? "fill-amber-400 text-amber-500 dark:text-amber-400" : ""
                                    }`}
                                />
                            </button>
                        </div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                            <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400"/>
                            <span>{locationLabel} 시간표</span>
                        </h3>
                    </div>

                    <div className="flex items-center space-x-2">
                        {onSelectMapRoute && (
                            <button
                                onClick={() => {
                                    onClose();
                                    onSelectMapRoute(route.routeNo);
                                }}
                                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold border border-blue-200/80 dark:border-blue-500/20 transition-all cursor-pointer"
                            >
                                <MapPin className="h-3.5 w-3.5"/>
                                <span className="hidden sm:inline">실시간 지도</span>
                            </button>
                        )}
                        <button
                            onClick={exportCsv}
                            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-700 dark:text-slate-200 text-xs font-bold border border-black/5 dark:border-white/10 transition-colors cursor-pointer"
                            title="CSV 다운로드"
                        >
                            <Download className="h-3.5 w-3.5"/>
                            <span className="hidden sm:inline">CSV</span>
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                        >
                            <X className="h-4 w-4"/>
                        </button>
                    </div>
                </div>

                {/* Sub-header Filter Bar */}
                <div
                    className="p-4 border-b border-black/5 dark:border-white/10 bg-white/50 dark:bg-[#121212]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative flex-1">
                        <Search className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
                        <input
                            type="text"
                            value={tableSearch}
                            onChange={(e) => setTableSearch(e.target.value)}
                            placeholder="시각 또는 비고 검색..."
                            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.06] border border-transparent focus:border-blue-500/50 text-xs font-semibold text-slate-900 dark:text-white outline-none transition-all"
                        />
                    </div>
                    <div className="text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0">
                        총 <span className="font-mono text-blue-600 dark:text-blue-400">{filteredTimetable.length}</span>회
                        운행
                    </div>
                </div>

                {/* Single Focused Timetable Table */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                        <tr className="border-b border-black/5 dark:border-white/10 text-slate-400 dark:text-slate-500 font-extrabold uppercase tracking-wider">
                            <th className="py-2.5 px-3 w-16">순번</th>
                            <th className="py-2.5 px-3 text-blue-600 dark:text-blue-400">{locationLabel}</th>
                            <th className="py-2.5 px-3">비고</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5 dark:divide-white/5 font-mono">
                        {filteredTimetable.length === 0 ? (
                            <tr>
                                <td colSpan={3}
                                    className="py-8 text-center text-slate-400 dark:text-slate-500 font-sans">
                                    검색 조건에 맞는 출발 시각이 없습니다.
                                </td>
                            </tr>
                        ) : (
                            filteredTimetable.map((row) => {
                                const isNextBus = row.seq === nextUpcomingSeq;
                                return (
                                    <tr
                                        key={row.seq}
                                        className={`transition-colors ${
                                            isNextBus
                                                ? "bg-blue-500/10 dark:bg-blue-500/15"
                                                : "hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                                        }`}
                                    >
                                        <td className="py-3 px-3 font-semibold text-slate-400 dark:text-slate-500">
                                            {row.seq}
                                        </td>
                                        <td className="py-3 px-3 font-extrabold text-sm">
                                            {isNextBus ? (
                                                <span
                                                    className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-blue-600 text-white font-extrabold shadow-sm">
                                                        <span>{row.destDepTime}</span>
                                                        <span
                                                            className="text-[10px] px-1.5 py-0.5 rounded-md bg-white/20 text-white font-sans font-bold">
                                                            다음 버스
                                                        </span>
                                                    </span>
                                            ) : (
                                                <span className="text-slate-900 dark:text-white font-mono">
                                                        {row.destDepTime}
                                                    </span>
                                            )}
                                        </td>
                                        <td className="py-3 px-3 font-sans text-xs text-slate-500 dark:text-slate-400 font-medium">
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
        </div>
    );

    return createPortal(modalContent, document.body);
};
