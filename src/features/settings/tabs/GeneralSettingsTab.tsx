"use client";

import React from "react";
import {Calendar, ChevronRight, GraduationCap, Monitor, Moon, Sparkles, Sun} from "lucide-react";
import type {AppSettings, FontScale} from "@shared/config/settingsCookie";
import type {ThemePreference} from "@shared/ui";
import {triggerHaptic} from "@shared/utils/haptics";
import {SettingsBlock, SettingsGroup, SettingsSectionHeader} from "../SettingsPrimitives";

const YONSEI_DIRECTION_SUMMARY = {
    AUTO: "시간대 자동",
    OUTBOUND: "하교 고정",
    INBOUND: "등교 고정",
} as const;

interface GeneralSettingsTabProps {
    settings: AppSettings;
    activeTheme: ThemePreference;
    onThemeChange: (theme: ThemePreference) => void;
    onUpdateSettings: (patch: Partial<AppSettings>) => void;
    onOpenYonseiModal: () => void;
}

export const GeneralSettingsTab: React.FC<GeneralSettingsTabProps> = ({
    settings,
    activeTheme,
    onThemeChange,
    onUpdateSettings,
    onOpenYonseiModal,
}) => (
    <>
        <section className="space-y-2.5">
            <SettingsSectionHeader
                icon={<Sparkles className="w-3.5 h-3.5 text-blue-500"/>}
                title="화면 스타일"
            />
            <SettingsGroup>
                <SettingsBlock>
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                            화면 테마
                        </p>
                        <span className="text-[11px] font-semibold text-slate-400">
                            {activeTheme === "system"
                                ? "기기 설정 따름"
                                : activeTheme === "light"
                                    ? "밝은 화면"
                                    : "어두운 화면"}
                        </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                        <button
                            type="button"
                            onClick={() => onThemeChange("system")}
                            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                                activeTheme === "system"
                                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xs"
                                    : "bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10"
                            }`}
                        >
                            <Monitor className="w-3.5 h-3.5"/>
                            <span>시스템</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onThemeChange("light")}
                            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                                activeTheme === "light"
                                    ? "bg-amber-500 text-white border-transparent shadow-xs"
                                    : "bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10"
                            }`}
                        >
                            <Sun className="w-3.5 h-3.5"/>
                            <span>라이트</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => onThemeChange("dark")}
                            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                                activeTheme === "dark"
                                    ? "bg-blue-600 text-white border-transparent shadow-xs"
                                    : "bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10"
                            }`}
                        >
                            <Moon className="w-3.5 h-3.5"/>
                            <span>다크</span>
                        </button>
                    </div>
                </SettingsBlock>

                <SettingsBlock>
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                            <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                                화면 글자 크기
                            </p>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-400">
                            {settings.fontScale === "large" ? "크게 (17.5px)" : "보통 (기본)"}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                        {(
                            [
                                {id: "normal", label: "보통 (기본)"},
                                {id: "large", label: "크게"},
                            ] as const satisfies readonly { id: FontScale; label: string }[]
                        ).map((opt) => (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                    triggerHaptic("selection");
                                    onUpdateSettings({fontScale: opt.id});
                                }}
                                className={`py-2 px-2.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                                    settings.fontScale === opt.id
                                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xs"
                                        : "bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10"
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </SettingsBlock>
            </SettingsGroup>
        </section>

        <section className="space-y-2.5">
            <SettingsSectionHeader
                icon={<Calendar className="w-3.5 h-3.5 text-amber-500"/>}
                title="시간표 기본 기준"
            />
            <SettingsGroup>
                <SettingsBlock>
                    <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                        시간표 기본 운행 요일
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                        {(
                            [
                                {id: "AUTO", label: "자동 감지"},
                                {id: "WEEKDAY", label: "평일 기준"},
                                {id: "VACATION", label: "휴일·방학"},
                            ] as const
                        ).map((mode) => (
                            <button
                                key={mode.id}
                                type="button"
                                onClick={() => {
                                    triggerHaptic("selection");
                                    onUpdateSettings({defaultDayMode: mode.id});
                                }}
                                className={`py-2 px-2.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                                    settings.defaultDayMode === mode.id
                                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xs"
                                        : "bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10"
                                }`}
                            >
                                {mode.label}
                            </button>
                        ))}
                    </div>
                </SettingsBlock>
            </SettingsGroup>
        </section>

        <section className="space-y-2.5">
            <SettingsSectionHeader
                icon={<GraduationCap className="w-3.5 h-3.5 text-[#003876] dark:text-blue-400"/>}
                title="캠퍼스 · 특화 허브"
            />
            <button
                type="button"
                onClick={() => {
                    triggerHaptic("light");
                    onOpenYonseiModal();
                }}
                className="w-full p-3.5 rounded-2xl bg-[#003876]/[0.06] hover:bg-[#003876]/10 dark:bg-blue-500/10 dark:hover:bg-blue-500/15 border border-[#003876]/15 dark:border-blue-400/20 flex items-center justify-between gap-3 text-left transition cursor-pointer active:scale-[0.99]"
            >
                <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#003876] text-white shrink-0 shadow-xs">
                        <GraduationCap className="w-4.5 h-4.5"/>
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white truncate">
                            연세대 미래캠퍼스 설정
                        </p>
                        <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate mt-0.5">
                            시작: {settings.defaultStartPage === "yonsei" ? "연세대 허브" : "실시간 지도"} ·
                            방향: {YONSEI_DIRECTION_SUMMARY[settings.yonseiDefaultDirection]}
                        </p>
                    </div>
                </div>
                <ChevronRight className="w-4 h-4 text-[#003876] dark:text-blue-300 shrink-0"/>
            </button>
        </section>
    </>
);
