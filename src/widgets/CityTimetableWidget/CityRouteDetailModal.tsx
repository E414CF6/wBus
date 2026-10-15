"use client";

import React, {useState, useSyncExternalStore} from "react";
import {createPortal} from "react-dom";
import {ArrowRight, Bus, Clock, MapPin, Navigation, Star, X} from "lucide-react";
import type {RawCityRoute} from "@entities/bus";
import type {BusStop} from "@entities/station/types";
import {useBusStop} from "@entities/station/hooks";
import {getRouteColor} from "@entities/route/routeColor";

const emptySubscribe = () => () => {};

interface CityRouteDetailModalProps {
    route: RawCityRoute | null;
    cityCode: string;
    cityName: string;
    onClose: () => void;
    isBookmarked: boolean;
    onToggleBookmark: (routeNo: string) => void;
    onSelectMapRoute?: (routeName: string) => void;
}

export const CityRouteDetailModal: React.FC<CityRouteDetailModalProps> = ({
    route,
    cityCode,
    cityName,
    onClose,
    isBookmarked,
    onToggleBookmark,
    onSelectMapRoute,
}) => {
    const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const [searchFilter, setSearchFilter] = useState("");

    const routeNo = route ? String(route.routeno) : "";
    const stops = useBusStop(routeNo, cityCode);

    if (!route || !isClient) return null;

    const colorConfig = getRouteColor(routeNo);
    const formatTime = (val?: string | number) => {
        if (!val) return "--:--";
        const str = String(val).padStart(4, "0");
        return `${str.slice(0, 2)}:${str.slice(2, 4)}`;
    };

    const firstTime = formatTime(route.startvehicletime);
    const lastTime = formatTime(route.endvehicletime);

    const filteredStops = stops.filter((s: BusStop) => {
        if (!searchFilter) return true;
        const q = searchFilter.toLowerCase();
        return s.nodenm.toLowerCase().includes(q) || String(s.nodeno || "").includes(q);
    });

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3.5 sm:p-6 bg-slate-950/60 dark:bg-black/80 backdrop-blur-lg animate-fadeIn pointer-events-auto"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="relative w-full max-w-xl max-h-[88vh] bg-white dark:bg-[#12141c] border border-black/10 dark:border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 sm:p-5 border-b border-black/5 dark:border-white/5 bg-slate-50/70 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex items-center justify-center px-3 py-1.5 rounded-xl font-black text-base sm:text-lg text-white shadow-md"
                            style={{backgroundColor: colorConfig.main}}
                        >
                            <span>{routeNo}번</span>
                        </div>
                        <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                                    {route.startnodenm || "기점"} ↔ {route.endnodenm || "종점"}
                                </h3>
                                {route.routetp && (
                                    <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-black/5 dark:border-white/10">
                                        {route.routetp}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {cityName} 시내버스 · 총 {stops.length}개 정류소 경유
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            onClick={() => onToggleBookmark(routeNo)}
                            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                            aria-label="즐겨찾기"
                        >
                            <Star
                                className={`w-5 h-5 ${
                                    isBookmarked
                                        ? "fill-amber-400 text-amber-500"
                                        : "text-slate-400 hover:text-amber-500"
                                }`}
                            />
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                            aria-label="닫기"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Operating Info Bar */}
                <div className="grid grid-cols-2 gap-2 p-3 sm:p-4 bg-slate-50 dark:bg-slate-900/50 border-b border-black/5 dark:border-white/5 text-xs sm:text-sm">
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-black/5 dark:border-white/5">
                        <Clock className="w-4 h-4 text-blue-500 shrink-0" />
                        <div>
                            <span className="text-[10px] sm:text-xs text-slate-400 block font-bold">첫차 시간</span>
                            <span className="font-extrabold text-slate-900 dark:text-white">{firstTime}</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white dark:bg-slate-800/80 border border-black/5 dark:border-white/5">
                        <Clock className="w-4 h-4 text-purple-500 shrink-0" />
                        <div>
                            <span className="text-[10px] sm:text-xs text-slate-400 block font-bold">막차 시간</span>
                            <span className="font-extrabold text-slate-900 dark:text-white">{lastTime}</span>
                        </div>
                    </div>
                </div>

                {/* Stop Search Input */}
                <div className="p-3 sm:p-4 pb-2">
                    <input
                        type="text"
                        value={searchFilter}
                        onChange={(e) => setSearchFilter(e.target.value)}
                        placeholder="정류소 이름 또는 번호 검색"
                        className="w-full px-3.5 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Through Stations List */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 pt-1 space-y-1.5 custom-scrollbar">
                    {filteredStops.length > 0 ? (
                        filteredStops.map((stop: BusStop, idx: number) => (
                            <div
                                key={`${stop.nodeid}-${idx}`}
                                className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-black/5 dark:border-white/5 text-xs sm:text-sm"
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[10px] font-black shrink-0">
                                        {idx + 1}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-slate-900 dark:text-white truncate">
                                            {stop.nodenm}
                                        </p>
                                        {stop.nodeno && (
                                            <p className="text-[10px] text-slate-400 font-medium">
                                                정류소 번호: {stop.nodeno}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                {stop.updowncd !== undefined && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200/60 dark:bg-slate-700/60 text-slate-600 dark:text-slate-300 shrink-0">
                                        {stop.updowncd === 1 ? "종점행" : "기점행"}
                                    </span>
                                )}
                            </div>
                        ))
                    ) : (
                        <div className="py-8 text-center text-xs text-slate-400">
                            {stops.length === 0 ? "경유 정류소 정보를 불러오는 중입니다..." : "일치하는 정류소가 없습니다."}
                        </div>
                    )}
                </div>

                {/* Bottom Footer Actions */}
                <div className="p-3 sm:p-4 border-t border-black/5 dark:border-white/5 bg-slate-50/70 dark:bg-white/[0.02]">
                    <button
                        type="button"
                        onClick={() => {
                            onSelectMapRoute?.(routeNo);
                            onClose();
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs sm:text-sm shadow-lg shadow-blue-500/25 transition-all duration-200 cursor-pointer active:scale-95"
                    >
                        <Bus className="w-4 h-4" />
                        <span>실시간 지도에서 {routeNo}번 버스 추적하기</span>
                        <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
