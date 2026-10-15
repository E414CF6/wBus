"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore} from "react";
import {createPortal} from "react-dom";
import {Check, Compass, MapPin, Navigation, Search, Sparkles, X} from "lucide-react";
import type {CityInfo} from "@entities/city";
import {DEFAULT_CITY, NATIONWIDE_CITIES, useCityContext} from "@entities/city";

interface CitySelectModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const emptySubscribe = () => () => {};

const PROVINCE_GROUPS: { label: string; match: (city: CityInfo) => boolean }[] = [
    {label: "전체", match: () => true},
    {label: "강원", match: (c) => c.province.includes("강원")},
    {label: "수도권/경기", match: (c) => c.province.includes("경기") || c.province.includes("인천")},
    {label: "광역시/특례", match: (c) => c.isMajor === true},
    {label: "충청/세종", match: (c) => c.province.includes("충청") || c.province.includes("세종") || c.province.includes("대전")},
    {label: "전라/광주", match: (c) => c.province.includes("전라") || c.province.includes("광주")},
    {label: "경상/부산/대구/울산", match: (c) => c.province.includes("경상") || c.province.includes("부산") || c.province.includes("대구") || c.province.includes("울산")},
    {label: "제주", match: (c) => c.province.includes("제주")},
];

export const CitySelectModal: React.FC<CitySelectModalProps> = ({isOpen, onClose}) => {
    const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);
    const {
        currentCity,
        setCity,
        detectCurrentLocation,
        isDetecting,
        isAutoDetectEnabled,
        setIsAutoDetectEnabled,
    } = useCityContext();

    const [searchQuery, setSearchQuery] = useState("");
    const [selectedTab, setSelectedTab] = useState("전체");
    const searchInputRef = useRef<HTMLInputElement>(null);

    // Reset state on open
    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
    if (isOpen !== prevIsOpen) {
        setPrevIsOpen(isOpen);
        if (isOpen) {
            setSearchQuery("");
        }
    }

    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            const timer = setTimeout(() => searchInputRef.current?.focus(), 80);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Keyboard ESC to close
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    // Filter cities
    const filteredCities = useMemo(() => {
        let list = NATIONWIDE_CITIES;
        const q = searchQuery.trim().toLowerCase();

        if (q) {
            list = list.filter(
                (c) =>
                    c.name.toLowerCase().includes(q) ||
                    c.province.toLowerCase().includes(q) ||
                    c.code.includes(q)
            );
        } else {
            const activeGroup = PROVINCE_GROUPS.find((g) => g.label === selectedTab);
            if (activeGroup) {
                list = list.filter(activeGroup.match);
            }
        }

        return list;
    }, [searchQuery, selectedTab]);

    const handleSelectCity = useCallback(
        (city: CityInfo) => {
            setCity(city);
            onClose();
        },
        [setCity, onClose]
    );

    const handleGpsDetect = useCallback(async () => {
        const detected = await detectCurrentLocation();
        if (detected) {
            onClose();
        }
    }, [detectCurrentLocation, onClose]);

    if (!isClient || !isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn select-none"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-label="도시 선택"
        >
            <div
                className="flex flex-col w-full max-w-lg max-h-[88vh] bg-white dark:bg-[#13151b] border border-black/10 dark:border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden transition-all duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 border-b border-black/5 dark:border-white/5 bg-slate-50/70 dark:bg-white/[0.02]">
                    <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-xl bg-blue-500/10 dark:bg-blue-400/15 text-blue-600 dark:text-blue-400">
                            <MapPin className="w-5 h-5 shrink-0" />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                                서비스 지역 선택
                            </h2>
                            <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400">
                                전국 138개 시·군 실시간 버스 지원
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-full hover:bg-black/5 dark:hover:bg-white/5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
                        aria-label="닫기"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Search & GPS bar */}
                <div className="p-3 sm:p-4 space-y-2 border-b border-black/5 dark:border-white/5">
                    <div className="relative flex items-center">
                        <Search className="absolute left-3 w-4 h-4 text-slate-400 pointer-events-none" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="도시 이름 검색 (예: 원주, 춘천, 부산, 수원)"
                            className="w-full pl-9 pr-8 py-2.5 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery("")}
                                className="absolute right-2.5 p-1 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* GPS Auto Detect Button */}
                    <button
                        type="button"
                        onClick={handleGpsDetect}
                        disabled={isDetecting}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 dark:hover:bg-blue-900/50 border border-blue-200/60 dark:border-blue-800/60 rounded-xl text-blue-700 dark:text-blue-300 font-bold text-xs sm:text-sm transition-all duration-200 cursor-pointer disabled:opacity-50"
                    >
                        <Navigation className={`w-3.5 h-3.5 ${isDetecting ? "animate-spin" : ""}`} />
                        <span>{isDetecting ? "내 위치 탐색 중..." : "현재 내 위치 기준으로 도시 자동 검색"}</span>
                    </button>

                    {/* Viewport Auto-Detect Toggle */}
                    <div className="flex items-center justify-between px-3 py-2 bg-slate-100 dark:bg-slate-800/60 rounded-xl border border-black/5 dark:border-white/5">
                        <div className="flex items-center gap-2 min-w-0">
                            <Compass className="w-4 h-4 text-blue-500 shrink-0" />
                            <div className="text-left">
                                <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                                    지도 이동 시 지역 자동 인식
                                </p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400">
                                    화면 중심 지역에 맞춰 노선 목록 자동 갱신
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsAutoDetectEnabled(!isAutoDetectEnabled)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                                isAutoDetectEnabled
                                    ? "bg-blue-600 text-white shadow-sm shadow-blue-500/25"
                                    : "bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                            }`}
                        >
                            {isAutoDetectEnabled ? "켜짐" : "꺼짐"}
                        </button>
                    </div>

                    {/* Province Filter Chips */}
                    {!searchQuery && (
                        <div className="flex gap-1.5 overflow-x-auto py-1 scrollbar-none no-scrollbar text-xs">
                            {PROVINCE_GROUPS.map((group) => (
                                <button
                                    key={group.label}
                                    type="button"
                                    onClick={() => setSelectedTab(group.label)}
                                    className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap transition-all duration-200 cursor-pointer text-[11px] sm:text-xs ${
                                        selectedTab === group.label
                                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                                    }`}
                                >
                                    {group.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Cities Grid List */}
                <div className="flex-1 overflow-y-auto p-3 sm:p-4 divide-y divide-black/5 dark:divide-white/5 scrollbar-thin">
                    {filteredCities.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 dark:text-slate-500 space-y-1">
                            <Compass className="w-8 h-8 mx-auto opacity-40 mb-2" />
                            <p className="text-sm font-semibold">검색 결과가 없습니다.</p>
                            <p className="text-xs">다른 시·군 이름으로 검색해 보세요.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                            {filteredCities.map((city) => {
                                const isSelected = currentCity.code === city.code;
                                const isWonju = city.code === "32020";

                                return (
                                    <button
                                        key={city.code}
                                        type="button"
                                        onClick={() => handleSelectCity(city)}
                                        className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer ${
                                            isSelected
                                                ? "bg-blue-500/10 dark:bg-blue-500/20 border-blue-500/50 shadow-sm"
                                                : "bg-slate-50 dark:bg-slate-800/40 border-black/5 dark:border-white/5 hover:bg-slate-100 dark:hover:bg-slate-800/80 hover:border-black/10 dark:hover:border-white/10"
                                        }`}
                                    >
                                        <div className="min-w-0 pr-1">
                                            <div className="flex items-center gap-1 truncate">
                                                <span
                                                    className={`font-black text-xs sm:text-sm truncate ${
                                                        isSelected
                                                            ? "text-blue-600 dark:text-blue-400"
                                                            : "text-slate-800 dark:text-slate-200"
                                                    }`}
                                                >
                                                    {city.name}
                                                </span>
                                                {isWonju && (
                                                    <span className="px-1 py-0.2 rounded text-[9px] font-black bg-blue-600 text-white shrink-0">
                                                        기본
                                                    </span>
                                                )}
                                                {city.isMajor && !isWonju && (
                                                    <span className="px-1 py-0.2 rounded text-[9px] font-bold bg-amber-500/10 dark:bg-amber-400/20 text-amber-600 dark:text-amber-400 shrink-0">
                                                        주요
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate">
                                                {city.province}
                                            </p>
                                        </div>

                                        {isSelected && (
                                            <div className="p-0.5 rounded-full bg-blue-600 text-white shrink-0">
                                                <Check className="w-3.5 h-3.5" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer with active city status */}
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-900/60 border-t border-black/5 dark:border-white/5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 truncate">
                        <span className="font-semibold">현재 선택:</span>
                        <span className="font-black text-slate-900 dark:text-white">
                            {currentCity.name} ({currentCity.province})
                        </span>
                    </div>
                    <span className="text-[11px] text-slate-400 shrink-0">
                        총 {filteredCities.length}개 지역
                    </span>
                </div>
            </div>
        </div>,
        document.body
    );
};
