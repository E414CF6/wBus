"use client";

import React, {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {Check, Compass, MapPin, Navigation, Search, Sparkles, X} from "lucide-react";
import {NATIONWIDE_CITIES, useCityContext} from "@entities/city";
import type {CityInfo} from "@entities/city/types";
import {Modal} from "@shared/ui";

interface CitySelectModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const PROVINCE_GROUPS: { label: string; match: (city: CityInfo) => boolean }[] = [
    {label: "전체", match: () => true},
    {label: "강원", match: (c) => c.province.includes("강원")},
    {label: "수도권", match: (c) => c.province.includes("경기") || c.province.includes("인천")},
    {label: "광역시·세종", match: (c) => c.isMajor === true && c.code.length === 2 && c.code !== "39"},
    {label: "충청", match: (c) => c.province.includes("충청") || c.province.includes("대전") || c.province.includes("세종")},
    {label: "경상", match: (c) => c.province.includes("경상") || c.province.includes("부산") || c.province.includes("대구") || c.province.includes("울산")},
    {label: "전라", match: (c) => c.province.includes("전라") || c.province.includes("광주")},
    {label: "제주", match: (c) => c.province.includes("제주")},
];

export const CitySelectModal: React.FC<CitySelectModalProps> = ({isOpen, onClose}) => {
    const {
        currentCity,
        detectedCity,
        confirmDetectedCity,
        setCity,
        detectCurrentLocation,
        isDetecting,
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

        // Put Wonju at top when in 전체 or 강원
        return [...list].sort((a, b) => {
            if (a.code === "32020") return -1;
            if (b.code === "32020") return 1;
            if (a.code === currentCity.code) return -1;
            if (b.code === currentCity.code) return 1;
            return 0;
        });
    }, [searchQuery, selectedTab, currentCity.code]);

    const handleSelectCity = useCallback(
        (city: CityInfo) => {
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
        <>
            <div className="flex items-center gap-1.5 truncate">
                <MapPin className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0"/>
                <span className="truncate">
                    선택된 지역:{" "}
                    <strong className="text-slate-900 dark:text-white font-extrabold">
                        {currentCity.name}
                    </strong>
                </span>
            </div>
            <span className="font-semibold shrink-0">총 {filteredCities.length}개 지역</span>
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="서비스 지역 선택"
            subtitle="전국 138개 시·군 실시간 버스 노선 및 도착 정보 지원"
            icon={modalIcon}
            headerBadge={headerBadge}
            footer={modalFooter}
            maxWidth="2xl"
            height="default"
            enableHistory={false}
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
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="도시·지역 이름 검색 (예: 원주, 춘천, 수원, 부산)"
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

                {/* Province Filter Chips */}
                {!searchQuery && (
                    <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar-hidden pt-0.5">
                        {PROVINCE_GROUPS.map((group) => {
                            const isActive = selectedTab === group.label;
                            return (
                                <button
                                    key={group.label}
                                    type="button"
                                    onClick={() => setSelectedTab(group.label)}
                                    className={`px-3 py-1.5 rounded-full font-extrabold whitespace-nowrap transition-all duration-200 cursor-pointer text-xs active:scale-95 ${
                                        isActive
                                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm scale-[1.02]"
                                            : "bg-black/[0.03] dark:bg-white/[0.05] hover:bg-black/[0.07] dark:hover:bg-white/[0.08] text-slate-600 dark:text-slate-300 border border-black/5 dark:border-white/5"
                                    }`}
                                >
                                    {group.label}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Cities Grid List */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-6 pt-3 custom-scrollbar">
                {filteredCities.length === 0 ? (
                    <div className="py-14 text-center text-slate-400 dark:text-slate-500 space-y-1">
                        <Compass className="w-9 h-9 mx-auto opacity-40 mb-2"/>
                        <p className="text-sm font-black text-slate-700 dark:text-slate-200">검색된 지역이 없습니다</p>
                        <p className="text-xs">다른 시·군 이름으로 검색해 보세요.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                        {filteredCities.map((city) => {
                            const isSelected = currentCity.code === city.code;
                            const isDetected = detectedCity?.code === city.code && !isSelected;
                            const isWonju = city.code === "32020";

                            return (
                                <button
                                    key={city.code}
                                    type="button"
                                    onClick={() => handleSelectCity(city)}
                                    className={`flex items-center justify-between p-3 rounded-2xl border text-left transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                                        isSelected
                                            ? "bg-blue-50 dark:bg-blue-950/40 border-blue-500 dark:border-blue-400 ring-2 ring-blue-500/20 shadow-xs"
                                            : isDetected
                                                ? "bg-amber-500/10 dark:bg-amber-500/15 border-amber-500/40"
                                                : "bg-black/[0.02] dark:bg-white/[0.03] border-black/5 dark:border-white/5 hover:border-blue-500/40 hover:bg-blue-500/[0.04] dark:hover:border-blue-400/40 dark:hover:bg-blue-400/[0.08]"
                                    }`}
                                >
                                    <div className="min-w-0 pr-1">
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
                                            {isWonju && (
                                                <span
                                                    className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-[#003876] text-white shrink-0">
                                                    연세대·시간표
                                                </span>
                                            )}
                                            {isDetected && (
                                                <span
                                                    className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-amber-500 text-white shrink-0">
                                                    화면위치
                                                </span>
                                            )}
                                            {city.isMajor && !isWonju && !isDetected && (
                                                <span
                                                    className="px-1.5 py-0.2 rounded-full text-[9px] font-bold bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 shrink-0">
                                                    주요
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 truncate mt-0.5">
                                            {city.province}
                                        </p>
                                    </div>

                                    {isSelected && (
                                        <div className="p-1 rounded-full bg-blue-600 text-white shrink-0 shadow-xs">
                                            <Check className="w-3 h-3 stroke-[3]"/>
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </Modal>
    );
};
