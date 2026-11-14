"use client";

import React from "react";
import {ArrowDownLeft, ArrowUpRight, Calendar} from "lucide-react";
import {UI_TEXT} from "@shared/config/locale";
import {triggerHaptic} from "@shared/utils/haptics";
import type {CampusDirectionMode} from "../lib/yonseiShuttleUtils";

interface CampusDirectionBarProps {
    directionMode: CampusDirectionMode;
    dayModeBadgeLabel: string;
    onDirectionChange: (mode: CampusDirectionMode) => void;
    onOpenSettings: () => void;
}

export const CampusDirectionBar: React.FC<CampusDirectionBarProps> = ({
    directionMode,
    dayModeBadgeLabel,
    onDirectionChange,
    onOpenSettings,
}) => {
    return (
        <section className="relative overflow-hidden rounded-3xl p-4 sm:p-5 bg-white dark:bg-[#111623] border border-slate-200/85 dark:border-white/10 shadow-xs">
            <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#003876]/[0.07] via-blue-500/[0.03] to-transparent dark:from-[#003876]/30 dark:via-blue-900/15 dark:to-transparent"
            />
            <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-[#003876] text-white">
                            {UI_TEXT.YONSEI.HERO_BADGE}
                        </span>
                        <button
                            type="button"
                            onClick={onOpenSettings}
                            className="sm:hidden inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300"
                        >
                            <Calendar className="w-2.5 h-2.5"/>
                            {dayModeBadgeLabel}
                        </button>
                    </div>
                    <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                        지금 탈 수 있는 버스
                    </h2>
                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                        핵심 출발 시각만 한눈에 보고, 전체 시간표는 눌러서 확인하세요
                    </p>
                </div>

                {/* Segmented Direction Switcher */}
                <div
                    role="tablist"
                    aria-label="이동 방향 선택"
                    className="grid grid-cols-2 gap-1.5 p-1.5 rounded-2xl bg-slate-100/90 dark:bg-white/[0.06] border border-slate-200/60 dark:border-white/[0.06] shrink-0"
                >
                    <button
                        type="button"
                        role="tab"
                        aria-selected={directionMode === "OUTBOUND"}
                        onClick={() => {
                            triggerHaptic("selection");
                            onDirectionChange("OUTBOUND");
                        }}
                        className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            directionMode === "OUTBOUND"
                                ? "bg-[#003876] text-white shadow-sm"
                                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                        }`}
                    >
                        <ArrowUpRight className="w-3.5 h-3.5 shrink-0"/>
                        <div className="text-left leading-tight">
                            <div>하교 · 시내방면</div>
                            <div
                                className={`text-[10px] font-bold ${
                                    directionMode === "OUTBOUND"
                                        ? "text-blue-200"
                                        : "text-slate-400 dark:text-slate-500"
                                }`}
                            >
                                연세대 출발
                            </div>
                        </div>
                    </button>

                    <button
                        type="button"
                        role="tab"
                        aria-selected={directionMode === "INBOUND"}
                        onClick={() => {
                            triggerHaptic("selection");
                            onDirectionChange("INBOUND");
                        }}
                        className={`flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                            directionMode === "INBOUND"
                                ? "bg-indigo-600 text-white shadow-sm"
                                : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                        }`}
                    >
                        <ArrowDownLeft className="w-3.5 h-3.5 shrink-0"/>
                        <div className="text-left leading-tight">
                            <div>등교 · 학교방면</div>
                            <div
                                className={`text-[10px] font-bold ${
                                    directionMode === "INBOUND"
                                        ? "text-indigo-200"
                                        : "text-slate-400 dark:text-slate-500"
                                }`}
                            >
                                장양리·시내 출발
                            </div>
                        </div>
                    </button>
                </div>
            </div>
        </section>
    );
};
