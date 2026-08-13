"use client";

import React, {useEffect, useState} from "react";
import {createPortal} from "react-dom";
import {BusRoute} from "@shared/types/bus";
import {getNextDeparture} from "@shared/lib/timeUtils";
import {UI_TEXT} from "@shared/config/locale";
import {ArrowRight, MapPin, Search, Star, X} from "lucide-react";

interface RouteDetailModalProps {
    route: BusRoute | null;
    onClose: () => void;
    isBookmarked: boolean;
    onToggleBookmark: (routeId: string) => void;
    onSelectMapRoute?: (routeName: string) => void;
    currentTime?: Date;
}

export const RouteDetailModal: React.FC<RouteDetailModalProps> = ({
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

    const {nextOrigin, nextDest, originWaitMins, destWaitMins} = getNextDeparture(route.timetable, now);

    const filteredTimetable = route.timetable.filter((item) => {
        if (!tableSearch) return true;
        const q = tableSearch.toLowerCase();
        return (
            item.originDepTime.includes(q) ||
            item.destDepTime.includes(q) ||
            item.type.toLowerCase().includes(q) ||
            item.notes.toLowerCase().includes(q)
        );
    });


    const getRouteBadgeGradient = (no: string) => {
        if (no.startsWith("2")) return "from-teal-500 to-emerald-600 shadow-emerald-500/20";
        if (no.startsWith("16")) return "from-purple-600 to-indigo-600 shadow-purple-500/20";
        if (no.startsWith("3")) return "from-blue-600 to-indigo-600 shadow-blue-500/20";
        if (no.startsWith("4")) return "from-cyan-600 to-blue-600 shadow-cyan-500/20";
        if (no.startsWith("5")) return "from-amber-500 to-orange-600 shadow-orange-500/20";
        return "from-blue-600 to-indigo-600 shadow-blue-600/20";
    };

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 dark:bg-black/80 backdrop-blur-lg animate-fadeIn pointer-events-auto"
            onClick={onClose}
        >
            <div
                className="w-full max-w-4xl max-h-[92vh] rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden bg-white dark:bg-[#121212] transition-colors duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div
                    className="p-5 sm:p-6 border-b border-black/5 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] flex items-start justify-between gap-4">
                    <div>
                        <div className="flex items-center space-x-3 mb-2">
                            <div
                                className={`px-4 py-1.5 rounded-2xl bg-gradient-to-r ${getRouteBadgeGradient(
                                    route.routeNo
                                )} font-black text-white text-xl tracking-tight shadow-md`}
                            >
                                {route.routeNo}
                            </div>
                            <span
                                className="px-3 py-1 rounded-xl text-xs font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {route.dayType}
              </span>
                            <button
                                onClick={() => onToggleBookmark(route.id)}
                                className="p-1.5 rounded-xl bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 transition-colors cursor-pointer"
                                title={isBookmarked ? UI_TEXT.TIMETABLE.BOOKMARK_TOGGLE_REMOVE : UI_TEXT.TIMETABLE.BOOKMARK_TOGGLE_ADD}
                            >
                                <Star
                                    className={`h-4 w-4 ${isBookmarked ? "fill-amber-400 text-amber-500 dark:text-amber-400" : ""}`}/>
                            </button>
                        </div>

                        <div
                            className="flex items-center space-x-2 text-slate-900 dark:text-slate-100 font-extrabold text-lg sm:text-xl tracking-tight">
                            <span>{route.origin}</span>
                            <ArrowRight className="h-5 w-5 text-blue-500 dark:text-blue-400"/>
                            <span>{route.destination}</span>
                        </div>

                        <div
                            className="flex items-center space-x-3 mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
              <span>
                첫차: <strong
                  className="text-slate-800 dark:text-slate-200 font-mono">{route.firstBus}</strong> | 막차:{" "}
                  <strong className="text-slate-800 dark:text-slate-200 font-mono">{route.lastBus}</strong>
              </span>
                            <span>•</span>
                            <span>
                운행: <strong className="text-slate-800 dark:text-slate-200 font-mono">{route.runCount}</strong> ({route.interval})
              </span>
                        </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                        {onSelectMapRoute && (
                            <button
                                onClick={() => {
                                    onClose();
                                    onSelectMapRoute(route.routeNo);
                                }}
                                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-600/20 transition-all cursor-pointer active:scale-95"
                            >
                                <MapPin className="h-3.5 w-3.5"/>
                                <span className="hidden sm:inline">{UI_TEXT.TIMETABLE.VIEW_REALTIME_MAP_BTN}</span>
                            </button>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 rounded-2xl bg-black/[0.04] hover:bg-black/[0.08] dark:bg-white/[0.08] dark:hover:bg-white/[0.15] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-all cursor-pointer"
                        >
                            <X className="h-5 w-5"/>
                        </button>
                    </div>
                </div>

                {/* Modal Controls & Search Bar */}
                <div
                    className="px-5 py-3 bg-black/[0.02] dark:bg-white/[0.02] border-b border-black/5 dark:border-white/10 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                    <div
                        className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-slate-600 dark:text-slate-400 font-medium">

                        {nextOrigin && (
                            <span
                                className="inline-flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                <span
                    className="px-1.5 py-0.5 rounded text-[10px] bg-teal-500/10 text-teal-700 dark:text-teal-300 border border-teal-500/20">{UI_TEXT.TIMETABLE.ORIGIN_LABEL(route.origin)}</span>
                <span className="font-mono text-slate-900 dark:text-white">{nextOrigin.originDepTime}</span>
                                {originWaitMins !== null && originWaitMins >= 0 && (
                                    <span
                                        className="text-emerald-600 dark:text-emerald-400">{UI_TEXT.TIMETABLE.WAIT_MINUTES(originWaitMins)}</span>
                                )}
              </span>
                        )}

                        {nextDest && (
                            <span
                                className="inline-flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                <span
                    className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20">{UI_TEXT.TIMETABLE.DEST_LABEL(route.destination)}</span>
                <span className="font-mono text-slate-900 dark:text-white">{nextDest.destDepTime}</span>
                                {destWaitMins !== null && destWaitMins >= 0 && (
                                    <span
                                        className="text-indigo-600 dark:text-indigo-400">{UI_TEXT.TIMETABLE.WAIT_MINUTES(destWaitMins)}</span>
                                )}
              </span>
                        )}
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                        <div className="relative flex-1 sm:w-48">
                            <Search
                                className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"/>
                            <input
                                type="text"
                                value={tableSearch}
                                onChange={(e) => setTableSearch(e.target.value)}
                                placeholder={UI_TEXT.TIMETABLE.SEARCH_MODAL_PLACEHOLDER}
                                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-black/[0.04] dark:bg-white/[0.06] border border-black/5 dark:border-white/10 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                {/* Timetable Table */}
                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <table className="w-full text-left border-collapse">
                        <thead className="sticky top-0 z-10 bg-slate-100 dark:bg-[#1a1a1a] shadow-xs">
                        <tr className="text-xs font-bold text-slate-500 dark:text-slate-400 border-b border-black/5 dark:border-white/10">
                            <th className="py-2.5 px-3 rounded-l-xl">{UI_TEXT.TIMETABLE.SEQ}</th>
                            <th className="py-2.5 px-3">{UI_TEXT.TIMETABLE.ORIGIN_DEP(route.origin)}</th>
                            <th className="py-2.5 px-3">{UI_TEXT.TIMETABLE.DEST_DEP(route.destination)}</th>
                            <th className="py-2.5 px-3 rounded-r-xl">{UI_TEXT.TIMETABLE.NOTES}</th>
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-black/5 dark:divide-white/5 text-xs sm:text-sm">
                        {filteredTimetable.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="py-8 text-center text-slate-400">
                                    {UI_TEXT.TIMETABLE.NO_ROUTES_FOUND}
                                </td>
                            </tr>
                        ) : (
                            filteredTimetable.map((row) => {
                                const isNextOrigin = nextOrigin !== null && row.seq === nextOrigin.seq;
                                const isNextDest = nextDest !== null && row.seq === nextDest.seq;
                                return (
                                    <tr
                                        key={row.seq}
                                        className={`transition-colors ${
                                            isNextOrigin && isNextDest
                                                ? "bg-gradient-to-r from-teal-500/10 via-purple-500/10 to-indigo-500/10 font-bold"
                                                : isNextOrigin
                                                    ? "bg-teal-500/5 dark:bg-teal-500/10 font-bold"
                                                    : isNextDest
                                                        ? "bg-indigo-500/5 dark:bg-indigo-500/10 font-bold"
                                                        : "hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
                                        }`}
                                    >
                                        <td className="py-2.5 px-3 font-mono text-slate-400 dark:text-slate-500">
                                            {row.seq}
                                        </td>
                                        <td className="py-2.5 px-3 font-mono">
                                            {isNextOrigin ? (
                                                <span
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-teal-500/20 dark:bg-teal-500/30 text-teal-950 dark:text-teal-100 font-extrabold border border-teal-500/40 shadow-xs">
                                                    <span>{row.originDepTime}</span>
                                                    <span
                                                        className="text-[10px] px-1.5 py-0.5 rounded-md bg-teal-600 dark:bg-teal-500 text-white font-sans font-bold">다음</span>
                                                </span>
                                            ) : (
                                                <span
                                                    className="font-bold text-slate-900 dark:text-slate-100">{row.originDepTime}</span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3 font-mono">
                                            {isNextDest ? (
                                                <span
                                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-500/20 dark:bg-indigo-500/30 text-indigo-950 dark:text-indigo-100 font-extrabold border border-indigo-500/40 shadow-xs">
                                                    <span>{row.destDepTime}</span>
                                                    <span
                                                        className="text-[10px] px-1.5 py-0.5 rounded-md bg-indigo-600 dark:bg-indigo-500 text-white font-sans font-bold">다음</span>
                                                </span>
                                            ) : (
                                                <span
                                                    className="font-bold text-slate-900 dark:text-slate-100">{row.destDepTime}</span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">
                                            {row.notes}
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
