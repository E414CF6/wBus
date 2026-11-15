"use client";

import React, {memo} from "react";
import Link from "next/link";
import {Bus, GraduationCap, Map as MapIcon, MapPin, Settings} from "lucide-react";

export interface FloatingBottomNavProps {
    activeModal: "city" | "shuttle" | "stops" | "settings" | null;
    cityCode?: string;
    hasLinkedRoutes: boolean;
    hasShuttle: boolean;
    hasBoardingStops: boolean;
    onScrollTop: () => void;
    onOpenCityBusModal: () => void;
    onOpenShuttleModal: () => void;
    onOpenStopsModal: () => void;
    onOpenSettingsModal: () => void;
}

export const FloatingBottomNav: React.FC<FloatingBottomNavProps> = memo(
    function FloatingBottomNav({
                                   activeModal,
                                   cityCode,
                                   hasLinkedRoutes,
                                   hasShuttle,
                                   hasBoardingStops,
                                   onScrollTop,
                                   onOpenCityBusModal,
                                   onOpenShuttleModal,
                                   onOpenStopsModal,
                                   onOpenSettingsModal,
                               }) {
        const activeButtonClass =
            "bg-[#003876] text-white dark:bg-white dark:text-[#0f172a] shadow-xs";
        const idleButtonClass =
            "text-slate-700 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-white/10 dark:hover:text-white";
        const mapHref = cityCode ? `/?cityCode=${encodeURIComponent(cityCode)}` : "/";

        return (
            <div
                className="md:hidden sticky bottom-0 z-30 w-full bg-white/95 dark:bg-[#0d121d]/95 backdrop-blur-2xl border-t border-slate-200/85 dark:border-white/10 px-2.5 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom,0px))] shadow-[0_-6px_24px_-8px_rgba(15,23,42,0.12)] dark:shadow-[0_-6px_24px_-8px_rgba(2,6,23,0.45)]">
                <nav
                    aria-label="모바일 빠른 메뉴"
                    className="mx-auto flex items-center justify-between gap-1 max-w-md overflow-x-auto no-scrollbar"
                >
                    {/* Brand / Scroll Top Pill */}
                    <button
                        type="button"
                        onClick={onScrollTop}
                        aria-label="맨 위로 이동"
                        className="inline-flex items-center gap-1 p-1 rounded-full text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                    >
                        <span
                            className="w-7 h-7 rounded-full bg-[#003876] text-white dark:bg-white dark:text-[#0f172a] flex items-center justify-center shadow-xs">
                            <Bus className="w-3.5 h-3.5 stroke-[2.5]"/>
                        </span>
                    </button>

                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                        {/* Live Map Navigation */}
                        <Link
                            href={mapHref}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-extrabold transition-colors whitespace-nowrap shrink-0 bg-emerald-50/95 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25 dark:border-emerald-400/25"
                        >
                            <MapIcon className="w-3.5 h-3.5 shrink-0"/>
                            <span>실시간 지도</span>
                        </Link>

                        {/* City Bus Timetable Modal Trigger */}
                        {hasLinkedRoutes && (
                            <button
                                type="button"
                                onClick={onOpenCityBusModal}
                                aria-pressed={activeModal === "city"}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                    activeModal === "city" ? activeButtonClass : idleButtonClass
                                }`}
                            >
                                <Bus className="w-3.5 h-3.5 shrink-0"/>
                                <span>시내버스</span>
                            </button>
                        )}

                        {/* Shuttle Timetable Modal Trigger */}
                        {hasShuttle && (
                            <button
                                type="button"
                                onClick={onOpenShuttleModal}
                                aria-pressed={activeModal === "shuttle"}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                    activeModal === "shuttle" ? activeButtonClass : idleButtonClass
                                }`}
                            >
                                <GraduationCap className="w-3.5 h-3.5 shrink-0"/>
                                <span>셔틀</span>
                            </button>
                        )}

                        {/* Boarding Stops Modal Trigger */}
                        {hasBoardingStops && (
                            <button
                                type="button"
                                onClick={onOpenStopsModal}
                                aria-pressed={activeModal === "stops"}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                                    activeModal === "stops" ? activeButtonClass : idleButtonClass
                                }`}
                            >
                                <MapPin className="w-3.5 h-3.5 shrink-0"/>
                                <span>탑승장소</span>
                            </button>
                        )}
                    </div>

                    {/* Settings Modal Trigger */}
                    <button
                        type="button"
                        onClick={onOpenSettingsModal}
                        aria-label="설정 열기"
                        aria-pressed={activeModal === "settings"}
                        className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors cursor-pointer shrink-0 ${
                            activeModal === "settings"
                                ? activeButtonClass
                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
                        }`}
                    >
                        <Settings className="w-4 h-4"/>
                    </button>
                </nav>
            </div>
        );
    }
);
