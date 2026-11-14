"use client";

import React, {memo} from "react";
import {Bus, GraduationCap, MapPin, Settings} from "lucide-react";

export interface FloatingBottomNavProps {
    activeModal: "city" | "shuttle" | "stops" | "settings" | null;
    onScrollTop: () => void;
    onOpenCityBusModal: () => void;
    onOpenShuttleModal: () => void;
    onOpenStopsModal: () => void;
    onOpenSettingsModal: () => void;
}

export const FloatingBottomNav: React.FC<FloatingBottomNavProps> = memo(
    function FloatingBottomNav({
        activeModal,
        onScrollTop,
        onOpenCityBusModal,
        onOpenShuttleModal,
        onOpenStopsModal,
        onOpenSettingsModal,
    }) {
        return (
            <div className="fixed bottom-4 sm:bottom-6 inset-x-0 z-40 flex justify-center px-3 pointer-events-none pb-[env(safe-area-inset-bottom,0px)]">
                <nav
                    aria-label="빠른 메뉴"
                    className="pointer-events-auto inline-flex items-center gap-1 sm:gap-1.5 p-1.5 rounded-full bg-[#111520]/92 dark:bg-[#0d121d]/92 backdrop-blur-2xl border border-white/12 shadow-[0_12px_40px_-8px_rgba(2,6,23,0.55)] max-w-full overflow-x-auto no-scrollbar"
                >
                    {/* Brand / Scroll Top Pill */}
                    <button
                        type="button"
                        onClick={onScrollTop}
                        aria-label="맨 위로 이동"
                        className="inline-flex items-center gap-1.5 pl-1 pr-2.5 py-1 rounded-full text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
                    >
                        <span className="w-7 h-7 rounded-full bg-white text-[#0f172a] flex items-center justify-center shadow-xs">
                            <Bus className="w-3.5 h-3.5 stroke-[2.5]"/>
                        </span>
                        <span className="text-xs font-black tracking-tight">wBus</span>
                    </button>

                    <span aria-hidden="true" className="h-4 w-px bg-white/15 shrink-0"/>

                    {/* City Bus Timetable Modal Trigger */}
                    <button
                        type="button"
                        onClick={onOpenCityBusModal}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                            activeModal === "city"
                                ? "bg-white text-[#0f172a] shadow-xs"
                                : "bg-[#003876]/80 text-blue-200 hover:bg-[#003876] hover:text-white border border-blue-400/20"
                        }`}
                    >
                        <Bus className="w-3.5 h-3.5 shrink-0"/>
                        <span>시내버스</span>
                    </button>

                    {/* Shuttle Timetable Modal Trigger */}
                    <button
                        type="button"
                        onClick={onOpenShuttleModal}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                            activeModal === "shuttle"
                                ? "bg-white text-[#0f172a] shadow-xs"
                                : "text-slate-200 hover:bg-white/10 hover:text-white"
                        }`}
                    >
                        <GraduationCap className="w-3.5 h-3.5 shrink-0"/>
                        <span>셔틀</span>
                    </button>

                    {/* Boarding Stops Modal Trigger */}
                    <button
                        type="button"
                        onClick={onOpenStopsModal}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-extrabold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                            activeModal === "stops"
                                ? "bg-white text-[#0f172a] shadow-xs"
                                : "text-slate-200 hover:bg-white/10 hover:text-white"
                        }`}
                    >
                        <MapPin className="w-3.5 h-3.5 shrink-0"/>
                        <span>탑승장소</span>
                    </button>

                    <span aria-hidden="true" className="h-4 w-px bg-white/15 shrink-0"/>

                    {/* Settings Modal Trigger */}
                    <button
                        type="button"
                        onClick={onOpenSettingsModal}
                        aria-label="설정 열기"
                        className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors cursor-pointer shrink-0 ${
                            activeModal === "settings"
                                ? "bg-white text-[#0f172a] shadow-xs"
                                : "text-slate-300 hover:bg-white/10 hover:text-white"
                        }`}
                    >
                        <Settings className="w-4 h-4"/>
                    </button>
                </nav>
            </div>
        );
    }
);
