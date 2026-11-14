"use client";

import React, {useId, useRef} from "react";
import Link from "next/link";
import {useTheme} from "next-themes";
import {ArrowDownLeft, ArrowUpRight, Calendar, Check, Monitor, Moon, Settings, Sun, X,} from "lucide-react";

import {UI_TEXT} from "@shared/config/locale";
import {useDialogModal} from "@shared/lib/useDialogModal";
import type {DayMode} from "@shared/types/navigation";
import {triggerHaptic} from "@shared/utils/haptics";
import type {CampusDirectionMode} from "../lib/yonseiShuttleUtils";

export interface SettingsModalProps {
    isOpen: boolean;
    dayMode: DayMode;
    isTodayWeekendOrHoliday: boolean;
    directionMode: CampusDirectionMode;
    onDayModeChange: (mode: DayMode) => void;
    onDirectionModeChange: (mode: CampusDirectionMode) => void;
    onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
                                                                isOpen,
                                                                dayMode,
                                                                isTodayWeekendOrHoliday,
                                                                directionMode,
                                                                onDayModeChange,
                                                                onDirectionModeChange,
                                                                onClose,
                                                            }) => {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    const {theme, setTheme} = useTheme();

    useDialogModal(dialogRef, isOpen);

    const dayModeOptions: { id: DayMode; label: string; desc: string }[] = [
        {
            id: "AUTO",
            label: `자동 (${isTodayWeekendOrHoliday ? "휴일" : "평일"})`,
            desc: UI_TEXT.YONSEI.MODE_AUTO_TOOLTIP,
        },
        {
            id: "WEEKDAY",
            label: UI_TEXT.YONSEI.MODE_WEEKDAY,
            desc: UI_TEXT.YONSEI.MODE_WEEKDAY_TOOLTIP,
        },
        {
            id: "VACATION",
            label: UI_TEXT.YONSEI.MODE_VACATION,
            desc: UI_TEXT.YONSEI.MODE_VACATION_TOOLTIP,
        },
    ];

    const themeOptions = [
        {id: "system", label: "시스템", icon: Monitor},
        {id: "light", label: "라이트", icon: Sun},
        {id: "dark", label: "다크", icon: Moon},
    ] as const;

    return (
        <dialog
            ref={dialogRef}
            {...({closedby: "any"} as Record<string, unknown>)}
            onClose={onClose}
            aria-labelledby={titleId}
            className="m-auto w-full sm:max-w-md max-h-[88dvh] open:flex flex-col rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#111623] text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-white/10 shadow-2xl overflow-hidden p-0 mb-0 sm:mb-auto"
        >
            {/* Header */}
            <div
                className="px-5 pt-4 pb-3.5 border-b border-slate-200/80 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.02] flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2.5">
                    <span
                        className="w-8 h-8 rounded-xl bg-[#003876]/10 dark:bg-blue-500/15 text-[#003876] dark:text-blue-400 flex items-center justify-center">
                        <Settings className="w-4 h-4"/>
                    </span>
                    <div>
                        <h3 id={titleId} className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                            설정
                        </h3>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            운행 기준, 이동 방향, 화면 테마
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={onClose}
                    aria-label={UI_TEXT.ACCESSIBILITY.CLOSE_MODAL}
                    className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-200/70 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-300/80 dark:hover:bg-white/20 transition-colors cursor-pointer"
                >
                    <X className="w-4 h-4"/>
                </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {/* Day Mode */}
                <div className="space-y-2">
                    <div className="flex items-center gap-1.5 text-xs font-black text-slate-700 dark:text-slate-200">
                        <Calendar className="w-3.5 h-3.5 text-[#003876] dark:text-blue-400"/>
                        <span>{UI_TEXT.YONSEI.MODE_OVERRIDE_LABEL}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2">
                        {dayModeOptions.map((opt) => {
                            const selected = dayMode === opt.id;
                            return (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic("selection");
                                        onDayModeChange(opt.id);
                                    }}
                                    className={`flex items-center justify-between gap-3 p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                                        selected
                                            ? "bg-blue-50/80 dark:bg-blue-950/35 border-[#003876] dark:border-blue-400 ring-1 ring-[#003876]/20"
                                            : "bg-slate-50/70 dark:bg-white/[0.03] border-slate-200/80 dark:border-white/10 hover:bg-slate-100/80 dark:hover:bg-white/[0.06]"
                                    }`}
                                >
                                    <div>
                                        <div className="text-xs font-black text-slate-900 dark:text-white">
                                            {opt.label}
                                        </div>
                                        <div
                                            className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                            {opt.desc}
                                        </div>
                                    </div>
                                    {selected && (
                                        <span
                                            className="w-5 h-5 rounded-full bg-[#003876] dark:bg-blue-500 text-white flex items-center justify-center shrink-0">
                                            <Check className="w-3 h-3"/>
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Direction Quick Toggle */}
                <div className="space-y-2">
                    <div className="text-xs font-black text-slate-700 dark:text-slate-200">
                        이동 방향
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic("selection");
                                onDirectionModeChange("OUTBOUND");
                            }}
                            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl border text-xs font-black transition-all cursor-pointer ${
                                directionMode === "OUTBOUND"
                                    ? "bg-[#003876] text-white border-transparent shadow-xs"
                                    : "bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/10"
                            }`}
                        >
                            <ArrowUpRight className="w-3.5 h-3.5"/>
                            <span>하교 (연세대 발)</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic("selection");
                                onDirectionModeChange("INBOUND");
                            }}
                            className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-2xl border text-xs font-black transition-all cursor-pointer ${
                                directionMode === "INBOUND"
                                    ? "bg-indigo-600 text-white border-transparent shadow-xs"
                                    : "bg-slate-50 dark:bg-white/[0.04] text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-white/10"
                            }`}
                        >
                            <ArrowDownLeft className="w-3.5 h-3.5"/>
                            <span>등교 (학교 방면)</span>
                        </button>
                    </div>
                </div>

                {/* Theme */}
                <div className="space-y-2">
                    <div className="text-xs font-black text-slate-700 dark:text-slate-200">
                        화면 테마
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {themeOptions.map((opt) => {
                            const Icon = opt.icon;
                            const selected = (theme ?? "system") === opt.id;
                            return (
                                <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic("light");
                                        setTheme(opt.id);
                                    }}
                                    className={`flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-2xl border text-xs font-extrabold transition-all cursor-pointer ${
                                        selected
                                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xs"
                                            : "bg-slate-50 dark:bg-white/[0.04] text-slate-600 dark:text-slate-300 border-slate-200/80 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/[0.08]"
                                    }`}
                                >
                                    <Icon className="w-4 h-4"/>
                                    <span>{opt.label}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Legal / Links */}
                <div
                    className="pt-3 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-between text-[11px] font-bold text-slate-400 dark:text-slate-500">
                    <div className="flex items-center gap-3">
                        <Link href="/privacy" onClick={onClose}
                              className="hover:text-slate-700 dark:hover:text-slate-200 underline underline-offset-4">
                            개인정보처리방침
                        </Link>
                        <Link href="/terms" onClick={onClose}
                              className="hover:text-slate-700 dark:hover:text-slate-200 underline underline-offset-4">
                            이용약관
                        </Link>
                    </div>
                    <span>wBus</span>
                </div>
            </div>
        </dialog>
    );
};
