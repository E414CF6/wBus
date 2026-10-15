"use client";

import React, {useCallback, useMemo, useState} from "react";
import {Bus, ChevronDown, Clock, MapPin, Search, Star} from "lucide-react";
import {useCityContext} from "@entities/city";
import {useCityRoutes} from "@entities/route/hooks";
import {getRouteColor} from "@entities/route/routeColor";
import type {RawCityRoute} from "@entities/bus";
import {CityRouteDetailModal} from "./CityRouteDetailModal";
import {Footer} from "@shared/ui/Footer";

interface CityTimetableWidgetProps {
    onSelectMapRoute?: (routeName: string) => void;
}

const BOOKMARKS_KEY = "wbus_city_bus_bookmarks";

export default function CityTimetableWidget({onSelectMapRoute}: CityTimetableWidgetProps) {
    const {currentCity} = useCityContext();
    const {routes, isLoading, error, refresh} = useCityRoutes(currentCity.code);

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedType, setSelectedType] = useState("ALL");
    const [showOnlyBookmarks, setShowOnlyBookmarks] = useState(false);
    const [selectedDetailRoute, setSelectedDetailRoute] = useState<RawCityRoute | null>(null);

    // Bookmarks state
    const [bookmarks, setBookmarks] = useState<string[]>(() => {
        if (typeof window === "undefined") return [];
        try {
            const saved = localStorage.getItem(BOOKMARKS_KEY);
            if (saved) return JSON.parse(saved);
        } catch {
            // Ignore
        }
        return [];
    });

    const toggleBookmark = useCallback((routeNo: string) => {
        setBookmarks((prev) => {
            const exists = prev.includes(routeNo);
            const next = exists ? prev.filter((r) => r !== routeNo) : [...prev, routeNo];
            try {
                localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(next));
            } catch {
                // Ignore
            }
            return next;
        });
    }, []);

    // Extract unique route types for filter chips
    const routeTypes = useMemo(() => {
        const set = new Set<string>();
        routes.forEach((r) => {
            if (r.routetp) set.add(r.routetp);
        });
        return Array.from(set).sort();
    }, [routes]);

    // Format HHMM -> HH:mm
    const formatTime = (val?: string | number) => {
        if (!val) return "--:--";
        const str = String(val).padStart(4, "0");
        return `${str.slice(0, 2)}:${str.slice(2, 4)}`;
    };

    // Filter routes
    const filteredRoutes = useMemo(() => {
        let list = routes;

        if (showOnlyBookmarks) {
            list = list.filter((r) => bookmarks.includes(String(r.routeno)));
        }

        if (selectedType !== "ALL") {
            list = list.filter((r) => r.routetp === selectedType);
        }

        const q = searchQuery.trim().toLowerCase();
        if (q) {
            list = list.filter(
                (r) =>
                    String(r.routeno).toLowerCase().includes(q) ||
                    (r.startnodenm && r.startnodenm.toLowerCase().includes(q)) ||
                    (r.endnodenm && r.endnodenm.toLowerCase().includes(q)) ||
                    (r.routetp && r.routetp.toLowerCase().includes(q))
            );
        }

        return list;
    }, [routes, showOnlyBookmarks, bookmarks, selectedType, searchQuery]);

    return (
        <div className="flex flex-col w-full animate-fadeIn pb-12">
            {/* Embedded Modals */}
            <CityRouteDetailModal
                route={selectedDetailRoute}
                cityCode={currentCity.code}
                cityName={currentCity.name}
                onClose={() => setSelectedDetailRoute(null)}
                isBookmarked={selectedDetailRoute ? bookmarks.includes(String(selectedDetailRoute.routeno)) : false}
                onToggleBookmark={toggleBookmark}
                onSelectMapRoute={onSelectMapRoute}
            />

            {/* Header Glass Card */}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 bg-white/90 dark:bg-[#111218]/90 backdrop-blur-xl border border-black/8 dark:border-white/10 rounded-3xl shadow-sm mb-6">
                <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <div
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/10 dark:bg-blue-400/15 text-blue-700 dark:text-blue-300 border border-blue-500/25 font-black text-xs select-none"
                            title={`현재 지도 뷰포인트: ${currentCity.name}`}
                        >
                            <MapPin className="w-3.5 h-3.5 text-blue-500" />
                            <span>{currentCity.name}</span>
                        </div>
                        <span className="text-xs text-slate-400 font-bold">
                            {currentCity.province}
                        </span>
                    </div>

                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                        {currentCity.name} 버스 운행 노선 및 시간표
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        총 {routes.length}개 노선 지원 · 첫차/막차 운행 시간 및 경유 정류소 실시간 조회
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => onSelectMapRoute?.(routes[0] ? String(routes[0].routeno) : "30")}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs sm:text-sm shadow-md shadow-blue-500/20 transition-all duration-200 cursor-pointer active:scale-95"
                        title="지도로 이동하여 다른 지역을 뷰포인트로 탐색합니다"
                    >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>지도에서 지역 탐색</span>
                    </button>
                </div>
            </header>

            {/* Search & Filter Toolbar */}
            <div className="flex flex-col gap-3 mb-6">
                <div className="flex items-center gap-2">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="노선 번호 또는 정류소(기점/종점) 검색 (예: 1, 100, 해운대, 터미널)"
                            className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#12141c] border border-black/8 dark:border-white/10 rounded-2xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 shadow-xs"
                        />
                    </div>

                    {/* Bookmark Filter Toggle */}
                    <button
                        type="button"
                        onClick={() => setShowOnlyBookmarks(!showOnlyBookmarks)}
                        className={`flex items-center gap-1.5 px-3.5 py-3 rounded-2xl font-extrabold text-xs transition-all duration-200 cursor-pointer shrink-0 border ${
                            showOnlyBookmarks
                                ? "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/20"
                                : "bg-white dark:bg-[#12141c] text-slate-700 dark:text-slate-200 border-black/8 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                        title="즐겨찾기한 노선만 모아보기"
                    >
                        <Star className={`w-4 h-4 ${showOnlyBookmarks ? "fill-white" : "text-amber-500"}`} />
                        <span className="hidden sm:inline">즐겨찾기</span>
                        <span>({bookmarks.length})</span>
                    </button>
                </div>

                {/* Route Type Filter Chips */}
                {routeTypes.length > 0 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
                        <button
                            type="button"
                            onClick={() => setSelectedType("ALL")}
                            className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                                selectedType === "ALL"
                                    ? "bg-blue-600 text-white shadow-xs"
                                    : "bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-black/5 dark:border-white/5 hover:bg-white dark:hover:bg-slate-700"
                            }`}
                        >
                            전체 ({routes.length})
                        </button>
                        {routeTypes.map((type) => {
                            const count = routes.filter((r) => r.routetp === type).length;
                            return (
                                <button
                                    key={type}
                                    type="button"
                                    onClick={() => setSelectedType(type)}
                                    className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all cursor-pointer ${
                                        selectedType === type
                                            ? "bg-blue-600 text-white shadow-xs"
                                            : "bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-black/5 dark:border-white/5 hover:bg-white dark:hover:bg-slate-700"
                                    }`}
                                >
                                    {type} ({count})
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Routes Grid */}
            {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
                    <div className="w-8 h-8 rounded-full border-3 border-blue-500 border-t-transparent animate-spin" />
                    <p className="text-sm font-bold">{currentCity.name} 버스 노선 목록을 불러오는 중...</p>
                </div>
            ) : filteredRoutes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2 border border-dashed border-black/10 dark:border-white/10 rounded-3xl p-6 text-center">
                    <Bus className="w-10 h-10 stroke-1 text-slate-300 dark:text-slate-600" />
                    <p className="text-sm font-extrabold text-slate-600 dark:text-slate-300">
                        {searchQuery ? "검색 조건에 맞는 노선이 없습니다." : "등록된 버스 노선이 없습니다."}
                    </p>
                    <p className="text-xs text-slate-400">
                        {searchQuery ? "검색어를 확인하시거나 필터를 초기화해 보세요." : "잠시 후 다시 시도해 주세요."}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
                    {filteredRoutes.map((route) => {
                        const routeNo = String(route.routeno);
                        const isBookmarked = bookmarks.includes(routeNo);
                        const colorConfig = getRouteColor(routeNo);
                        const first = formatTime(route.startvehicletime);
                        const last = formatTime(route.endvehicletime);

                        return (
                            <div
                                key={route.routeid}
                                className="group relative flex flex-col justify-between p-4 sm:p-5 bg-white dark:bg-[#12141c] border border-black/8 dark:border-white/8 hover:border-black/15 dark:hover:border-white/15 rounded-3xl shadow-xs hover:shadow-md transition-all duration-200"
                            >
                                <div>
                                    {/* Top Row: Badge, Type & Bookmark Star */}
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="flex items-center justify-center px-3 py-1.5 rounded-xl font-black text-sm sm:text-base text-white shadow-xs"
                                                style={{backgroundColor: colorConfig.main}}
                                            >
                                                <span>{routeNo}번</span>
                                            </div>
                                            {route.routetp && (
                                                <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-black/5 dark:border-white/5">
                                                    {route.routetp}
                                                </span>
                                            )}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => toggleBookmark(routeNo)}
                                            className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 transition-colors cursor-pointer"
                                            aria-label="즐겨찾기 토글"
                                        >
                                            <Star
                                                className={`w-4 h-4 ${
                                                    isBookmarked
                                                        ? "fill-amber-400 text-amber-500"
                                                        : "text-slate-300 dark:text-slate-600 hover:text-amber-500"
                                                }`}
                                            />
                                        </button>
                                    </div>

                                    {/* Route Origin & Destination */}
                                    <div className="mb-3">
                                        <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white truncate">
                                            {route.startnodenm || "기점"} ↔ {route.endnodenm || "종점"}
                                        </h3>
                                        <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">
                                            <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                            <span>첫차 {first} · 막차 {last}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Bottom Action Buttons */}
                                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-black/5 dark:border-white/5">
                                    <button
                                        type="button"
                                        onClick={() => onSelectMapRoute?.(routeNo)}
                                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 dark:bg-blue-400/10 dark:hover:bg-blue-400/20 text-blue-600 dark:text-blue-400 font-bold text-xs transition-colors cursor-pointer select-none active:scale-95"
                                    >
                                        <Bus className="w-3.5 h-3.5" />
                                        <span>실시간 지도</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setSelectedDetailRoute(route)}
                                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer select-none active:scale-95"
                                    >
                                        <span>경유 정류소</span>
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <Footer />
        </div>
    );
}
