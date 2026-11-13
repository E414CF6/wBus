"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import Link from "next/link";
import {Check, Compass, MapPin, Navigation, Search, Sparkles, Star, X} from "lucide-react";
import {
    NATIONWIDE_CITIES,
    resolveCityRegion,
    sortCitiesByMajor,
    useCityContext,
    useFavoriteCities,
} from "@entities/city";
import type {CityInfo} from "@entities/city/types";
import {matchesHangul} from "@shared/utils/hangul";
import {triggerHaptic} from "@shared/utils/haptics";
import {Modal} from "@shared/ui";

type CityTabId = "ALL" | "FAVORITES" | "CAPITAL" | "GANGWON" | "CHUNGCHEONG" | "JEOLLA" | "GYEONGSANG" | "JEJU";

interface CityTabConfig {
    id: CityTabId;
    label: string;
}

const CITY_TABS: readonly CityTabConfig[] = [
    {id: "ALL", label: "전체"},
    {id: "FAVORITES", label: "즐겨찾기"},
    {id: "CAPITAL", label: "수도권"},
    {id: "GANGWON", label: "강원"},
    {id: "CHUNGCHEONG", label: "충청"},
    {id: "JEOLLA", label: "전라"},
    {id: "GYEONGSANG", label: "경상"},
    {id: "JEJU", label: "제주"},
] as const;

interface CitySelectModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CitySelectModal: React.FC<CitySelectModalProps> = ({isOpen, onClose}) => {
    const {
        currentCity,
        detectedCity,
        confirmDetectedCity,
        setCity,
        detectCurrentLocation,
        isDetecting,
    } = useCityContext();

    const {favoriteCityCodes, isFavoriteCity, toggleFavoriteCity} = useFavoriteCities();

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTab, setSelectedTab] = useState<CityTabId>("ALL");
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Reset state on open
    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
    if (isOpen !== prevIsOpen) {
        setPrevIsOpen(isOpen);
        if (isOpen) {
            setSearchQuery("");
            setSelectedTab("ALL");
        }
    }

    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            const timer = setTimeout(() => searchInputRef.current?.focus(), 80);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Counts per region tab
    const regionCounts = useMemo(() => {
        const counts: Record<CityTabId, number> = {
            ALL: NATIONWIDE_CITIES.length,
            FAVORITES: favoriteCityCodes.length,
            CAPITAL: 0,
            GANGWON: 0,
            CHUNGCHEONG: 0,
            JEOLLA: 0,
            GYEONGSANG: 0,
            JEJU: 0,
        };
        for (const city of NATIONWIDE_CITIES) {
            const reg = resolveCityRegion(city);
            counts[reg] = (counts[reg] || 0) + 1;
        }
        return counts;
    }, [favoriteCityCodes.length]);

    // Filter cities by search query (including Choseong like "ㅇㅈ") and region tab
    const filteredCities = useMemo(() => {
        let list = NATIONWIDE_CITIES;
        const q = searchQuery.trim();

        if (q) {
            list = list.filter(
                (c) =>
                    matchesHangul(c.name, q) ||
                    matchesHangul(c.province, q) ||
                    c.code.includes(q)
            );
        } else if (selectedTab === "FAVORITES") {
            list = list.filter((c) => favoriteCityCodes.includes(c.code));
        } else if (selectedTab !== "ALL") {
            list = list.filter((c) => resolveCityRegion(c) === selectedTab);
        }

        return sortCitiesByMajor(list);
    }, [searchQuery, selectedTab, favoriteCityCodes]);

    // Visible windowing state for large city lists (reset during render when filter changes)
    const [prevFilter, setPrevFilter] = useState({searchQuery, selectedTab});
    const [visibleCityCount, setVisibleCityCount] = useState(48);

    if (prevFilter.searchQuery !== searchQuery || prevFilter.selectedTab !== selectedTab) {
        setPrevFilter({searchQuery, selectedTab});
        setVisibleCityCount(48);
    }

    const handleScroll = useCallback(
        (e: React.UIEvent<HTMLDivElement>) => {
            const el = e.currentTarget;
            if (el.scrollHeight - el.scrollTop - el.clientHeight < 300) {
                setVisibleCityCount((prev) =>
                    prev < filteredCities.length ? Math.min(prev + 48, filteredCities.length) : prev
                );
            }
        },
        [filteredCities.length]
    );

    const visibleCities = useMemo(() => {
        return filteredCities.slice(0, visibleCityCount);
    }, [filteredCities, visibleCityCount]);

    const handleSelectCity = useCallback(
        (city: CityInfo) => {
            triggerHaptic("selection");
            setCity(city);
            onClose();
        },
        [setCity, onClose]
    );

    const handleConfirmDetected = useCallback(() => {
        confirmDetectedCity();
        onClose();
    }, [confirmDetectedCity, onClose]);

    const handleGpsDetect = useCallback(async () => {
        const detected = await detectCurrentLocation();
        if (detected) {
            onClose();
        }
    }, [detectCurrentLocation, onClose]);

    const modalIcon = (
        <div
            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-blue-600 text-white shadow-md shadow-blue-500/25 shrink-0">
            <MapPin className="w-5 h-5"/>
        </div>
    );

    const headerBadge = (
        <span
            className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-blue-500/10 dark:bg-blue-400/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            현재: {currentCity.name.split("/")[0]}
        </span>
    );

    const modalFooter = (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-1.5 w-full text-xs">
            <div className="flex items-center gap-1.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0"/>
                <span className="truncate">
                    선택된 지역:{" "}
                    <strong className="text-slate-900 dark:text-white font-extrabold">
                        {currentCity.name}
                    </strong>
                </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                <span className="font-semibold">
                    총 {filteredCities.length}개 지역
                    {selectedTab === "FAVORITES" && !searchQuery ? " (즐겨찾기)" : ""}
                </span>
                <span>•</span>
                <Link href="/terms" className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                    이용약관
                </Link>
                <span>•</span>
                <Link href="/privacy"
                      className="hover:text-slate-700 dark:hover:text-slate-200 transition-colors font-bold">
                    개인정보처리방침
                </Link>
            </div>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="서비스 지역 선택"
            subtitle={`전국 ${NATIONWIDE_CITIES.length}개 시·군 실시간 버스 노선 및 도착 정보 지원`}
            icon={modalIcon}
            headerBadge={headerBadge}
            footer={modalFooter}
            maxWidth="2xl"
            height="default"
            modalId="city"
            ariaLabel="서비스 지역 선택"
        >
            {/* Detected Viewport City Banner (if user panned to another city) */}
            {detectedCity && detectedCity.code !== currentCity.code && (
                <div
                    className="mx-4 sm:mx-6 mt-3 p-3 rounded-2xl bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-blue-600/10 dark:from-blue-500/20 dark:via-indigo-500/20 dark:to-blue-500/20 border border-blue-500/30 flex items-center justify-between gap-3 shrink-0 animate-fadeIn">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div
                            className="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-600 text-white shrink-0 shadow-xs">
                            <Sparkles className="w-4 h-4"/>
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white truncate">
                                지도 화면 위치: <span className="text-blue-600 dark:text-blue-400">{detectedCity.name}</span>
                            </p>
                            <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate">
                                현재 보고 계신 지도 위치의 버스 노선으로 전환할까요?
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleConfirmDetected}
                        className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold whitespace-nowrap shadow-sm shadow-blue-600/25 transition-all cursor-pointer active:scale-95 shrink-0"
                    >
                        이 지역으로 변경
                    </button>
                </div>
            )}

            {/* Search & Quick Action Bar */}
            <div className="px-4 sm:px-6 pt-3 pb-2.5 space-y-2.5 border-b border-black/5 dark:border-white/5 shrink-0">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1 flex items-center">
                        <Search className="w-4.5 h-4.5 absolute left-3.5 text-slate-400 pointer-events-none"/>
                        <input
                            ref={searchInputRef}
                            id="city-search-input"
                            name="city-search"
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="도시·지역 이름 검색 (예: 서울, 부산, 수원, 원주)"
                            aria-label="도시·지역 이름 검색"
                            className="w-full pl-10 pr-10 py-2.5 sm:py-3 bg-black/[0.03] dark:bg-white/[0.05] border border-black/8 dark:border-white/10 rounded-2xl text-xs sm:text-sm font-bold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-inner"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-3 p-1 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                                aria-label="검색어 지우기"
                            >
                                <X className="w-4 h-4"/>
                            </button>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={handleGpsDetect}
                        disabled={isDetecting}
                        title="GPS로 내 주변 지역 찾기"
                        className="flex items-center gap-1.5 px-3 sm:px-4 py-2.5 sm:py-3 bg-blue-500/10 dark:bg-blue-500/15 hover:bg-blue-500/20 dark:hover:bg-blue-500/25 border border-blue-500/25 rounded-2xl text-blue-700 dark:text-blue-300 font-extrabold text-xs transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-50 shrink-0"
                    >
                        <Navigation className={`w-3.5 h-3.5 ${isDetecting ? "animate-spin" : ""}`}/>
                        <span className="hidden sm:inline">{isDetecting ? "탐색 중..." : "내 위치 (GPS)"}</span>
                    </button>
                </div>

                {/* Filter Tabs: 전체 / 즐겨찾기 / 6대 권역 */}
                {!searchQuery && (
                    <div
                        className="flex items-center gap-1.5 pt-0.5 overflow-x-auto custom-scrollbar-hidden select-none">
                        {CITY_TABS.map((tab) => {
                            const isSelected = selectedTab === tab.id;
                            const count = regionCounts[tab.id] ?? 0;
                            const isFav = tab.id === "FAVORITES";

                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic("selection");
                                        setSelectedTab(tab.id);
                                    }}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-extrabold whitespace-nowrap transition-all duration-200 cursor-pointer text-xs active:scale-95 shrink-0 ${
                                        isSelected
                                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm scale-[1.02]"
                                            : "bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.07] dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-300 border border-black/5 dark:border-white/5"
                                    }`}
                                >
                                    {isFav && (
                                        <Star
                                            className={`w-3.5 h-3.5 ${
                                                isSelected
                                                    ? "text-amber-400 fill-amber-400"
                                                    : count > 0
                                                        ? "text-amber-500 fill-amber-500"
                                                        : "text-slate-400"
                                            }`}
                                        />
                                    )}
                                    <span>{tab.label}</span>
                                    <span
                                        className={`text-[10px] font-mono font-bold ${
                                            isSelected
                                                ? "opacity-90"
                                                : "text-slate-400 dark:text-slate-500"
                                        }`}
                                    >
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Cities Grid List */}
            <div
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 sm:p-6 pt-3 custom-scrollbar"
            >
                {filteredCities.length === 0 ? (
                    selectedTab === "FAVORITES" && !searchQuery ? (
                        <div className="py-14 text-center text-slate-400 dark:text-slate-500 space-y-2">
                            <Star className="w-9 h-9 mx-auto opacity-30 text-amber-400 fill-amber-400/20 mb-2"/>
                            <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                                즐겨찾는 지역이 없습니다
                            </p>
                            <p className="text-xs">
                                자주 이용하는 지역 카드의 별표(★)를 눌러 등록해 보세요.
                            </p>
                        </div>
                    ) : (
                        <div className="py-14 text-center text-slate-400 dark:text-slate-500 space-y-1">
                            <Compass className="w-9 h-9 mx-auto opacity-40 mb-2"/>
                            <p className="text-sm font-black text-slate-700 dark:text-slate-200">
                                {searchQuery ? `"${searchQuery}" 검색 결과가 없습니다` : "해당 권역에 등록된 지역이 없습니다"}
                            </p>
                            <p className="text-xs">
                                {searchQuery ? "초성(예: ㅇㅈ, ㅅㅇ) 또는 다른 시·군 이름으로 검색해 보세요." : "다른 권역 탭을 선택해 보세요."}
                            </p>
                        </div>
                    )
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                        {visibleCities.map((city) => {
                            const isSelected = currentCity.code === city.code;
                            const isDetected = detectedCity?.code === city.code && !isSelected;
                            const isFav = isFavoriteCity(city.code);

                            return (
                                <div
                                    key={city.code}
                                    className={`cv-auto-city flex items-center justify-between rounded-2xl border text-left transition-all duration-200 select-none ${
                                        isSelected
                                            ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/20 shadow-xs"
                                            : isDetected
                                                ? "bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/40"
                                                : "bg-black/[0.02] dark:bg-white/[0.03] border-black/5 dark:border-white/5 hover:border-blue-500/40 hover:bg-blue-500/[0.04] dark:hover:border-blue-400/40 dark:hover:bg-blue-400/[0.08]"
                                    }`}
                                >
                                    <button
                                        type="button"
                                        onClick={() => handleSelectCity(city)}
                                        className="flex-1 min-w-0 p-3 pr-1 text-left cursor-pointer active:scale-[0.98] rounded-l-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                                    >
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span
                                                className={`font-black text-xs sm:text-sm truncate ${
                                                    isSelected
                                                        ? "text-blue-600 dark:text-blue-400"
                                                        : "text-slate-900 dark:text-white"
                                                }`}
                                            >
                                                {city.name}
                                            </span>
                                            {isDetected && (
                                                <span
                                                    className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-500 text-white shrink-0">
                                                    화면위치
                                                </span>
                                            )}
                                            {city.isMajor && !isDetected && (
                                                <span
                                                    className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 shrink-0">
                                                    주요
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                            {city.province}
                                        </p>
                                    </button>

                                    {/* Action Buttons: Favorite Star & Active Selection Check */}
                                    <div className="flex items-center gap-1 shrink-0 pr-3 pl-1">
                                        <button
                                            type="button"
                                            onClick={() => toggleFavoriteCity(city.code)}
                                            title={isFav ? "즐겨찾기 해제" : "즐겨찾기 등록"}
                                            aria-label={isFav ? `${city.name} 즐겨찾기 해제` : `${city.name} 즐겨찾기 등록`}
                                            className="p-1.5 -mr-1 rounded-xl text-slate-400 hover:text-amber-500 hover:bg-black/5 dark:hover:bg-white/10 transition-all cursor-pointer active:scale-125"
                                        >
                                            <Star
                                                className={`w-3.5 h-3.5 transition-colors ${
                                                    isFav
                                                        ? "text-amber-400 fill-amber-400"
                                                        : "text-slate-300 dark:text-slate-600 hover:text-amber-400"
                                                }`}
                                            />
                                        </button>
                                        {isSelected && (
                                            <div className="p-1 rounded-full bg-blue-600 text-white shrink-0 shadow-xs">
                                                <Check className="w-3 h-3 stroke-[3]"/>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        {visibleCities.length < filteredCities.length && (
                            <div
                                className="col-span-full py-2.5 text-center text-xs font-semibold text-slate-400 dark:text-slate-500">
                                스크롤하여 더 많은 지역 불러오기 ({visibleCities.length} / {filteredCities.length})
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};
