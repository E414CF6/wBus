"use client";

import React from "react";
import Link from "next/link";
import {
    Calendar,
    ChevronRight,
    Database,
    FileText,
    Info,
    Monitor,
    Moon,
    RotateCcw,
    ShieldCheck,
    Sparkles,
    Sun,
    Trash2,
} from "lucide-react";
import type {AppSettings, FontScale} from "@shared/config/settingsCookie";
import {UI_TEXT} from "@shared/config/locale";
import {markModalNavigating, type ThemePreference} from "@shared/ui";
import {triggerHaptic} from "@shared/utils/haptics";
import {SettingsBlock, SettingsGroup, SettingsSectionHeader} from "../SettingsPrimitives";

interface GeneralSettingsTabProps {
    settings: AppSettings;
    activeTheme: ThemePreference;
    appVersion: string;
    confirmClearData: boolean;
    onThemeChange: (theme: ThemePreference) => void;
    onUpdateSettings: (patch: Partial<AppSettings>) => void;
    onSetConfirmClearData: (confirm: boolean) => void;
    onClose: () => void;
    onOpenOnboarding: () => void;
    onClearApiCache: () => void;
    onResetSettings: () => void;
    onClearAllData: () => void;
}

export const GeneralSettingsTab: React.FC<GeneralSettingsTabProps> = ({
                                                                          settings,
                                                                          activeTheme,
                                                                          appVersion,
                                                                          confirmClearData,
                                                                          onThemeChange,
                                                                          onUpdateSettings,
                                                                          onSetConfirmClearData,
                                                                          onClose,
                                                                          onOpenOnboarding,
                                                                          onClearApiCache,
                                                                          onResetSettings,
                                                                          onClearAllData,
                                                                      }) => (
    <>
        <section className="space-y-2.5">
            <SettingsSectionHeader
                icon={<Sparkles className="w-3.5 h-3.5 text-blue-500"/>}
                title={UI_TEXT.SETTINGS.GENERAL.SECTION_STYLE}
            />
            <SettingsGroup>
                <SettingsBlock>
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                            {UI_TEXT.SETTINGS.GENERAL.THEME_TITLE}
                        </p>
                        <span className="text-[11px] font-semibold text-slate-400">
                            {activeTheme === "system"
                                ? UI_TEXT.SETTINGS.GENERAL.THEME_SYSTEM_DESC
                                : activeTheme === "light"
                                    ? UI_TEXT.SETTINGS.GENERAL.THEME_LIGHT_DESC
                                    : UI_TEXT.SETTINGS.GENERAL.THEME_DARK_DESC}
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
                            <span>{UI_TEXT.SETTINGS.GENERAL.THEME_SYSTEM}</span>
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
                            <span>{UI_TEXT.SETTINGS.GENERAL.THEME_LIGHT}</span>
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
                            <span>{UI_TEXT.SETTINGS.GENERAL.THEME_DARK}</span>
                        </button>
                    </div>
                </SettingsBlock>

                <SettingsBlock>
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                            <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                                {UI_TEXT.SETTINGS.GENERAL.FONT_SCALE_TITLE}
                            </p>
                        </div>
                        <span className="text-[11px] font-semibold text-slate-400">
                            {settings.fontScale === "large"
                                ? UI_TEXT.SETTINGS.GENERAL.FONT_SCALE_LARGE_DESC
                                : UI_TEXT.SETTINGS.GENERAL.FONT_SCALE_NORMAL_DESC}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                        {(
                            [
                                {id: "normal", label: UI_TEXT.SETTINGS.GENERAL.FONT_SCALE_NORMAL_BTN},
                                {id: "large", label: UI_TEXT.SETTINGS.GENERAL.FONT_SCALE_LARGE_BTN},
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
                title={UI_TEXT.SETTINGS.GENERAL.SECTION_SCHEDULE}
            />
            <SettingsGroup>
                <SettingsBlock>
                    <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                        {UI_TEXT.SETTINGS.GENERAL.DAY_MODE_TITLE}
                    </p>
                    <div className="grid grid-cols-3 gap-1.5">
                        {(
                            [
                                {id: "AUTO", label: UI_TEXT.SETTINGS.GENERAL.DAY_MODE_AUTO},
                                {id: "WEEKDAY", label: UI_TEXT.SETTINGS.GENERAL.DAY_MODE_WEEKDAY},
                                {id: "VACATION", label: UI_TEXT.SETTINGS.GENERAL.DAY_MODE_VACATION},
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
                icon={<Sparkles className="w-3.5 h-3.5 text-blue-500"/>}
                title={UI_TEXT.SETTINGS.GENERAL.SECTION_GUIDE_CACHE}
            />
            <div className="space-y-2">
                <button
                    type="button"
                    onClick={() => {
                        triggerHaptic("light");
                        onClose();
                        onOpenOnboarding();
                    }}
                    className="w-full p-3.5 rounded-2xl bg-slate-50/90 hover:bg-slate-100 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] border border-black/5 dark:border-white/10 flex items-center justify-between gap-3 text-left transition cursor-pointer active:scale-[0.99]"
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div
                            className="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 shrink-0">
                            <Sparkles className="w-4 h-4"/>
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                                {UI_TEXT.SETTINGS.GENERAL.REPLAY_ONBOARDING_TITLE}
                            </p>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                {UI_TEXT.SETTINGS.GENERAL.REPLAY_ONBOARDING_DESC}
                            </p>
                        </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0"/>
                </button>

                <button
                    type="button"
                    onClick={onClearApiCache}
                    className="w-full p-3.5 rounded-2xl bg-slate-50/90 hover:bg-slate-100 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] border border-black/5 dark:border-white/10 flex items-center justify-between gap-3 text-left transition cursor-pointer active:scale-[0.99]"
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div
                            className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 shrink-0">
                            <Database className="w-4 h-4"/>
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                                {UI_TEXT.SETTINGS.GENERAL.CLEAR_CACHE_TITLE}
                            </p>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                {UI_TEXT.SETTINGS.GENERAL.CLEAR_CACHE_DESC}
                            </p>
                        </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0"/>
                </button>
            </div>
        </section>

        <section className="space-y-2.5">
            <SettingsSectionHeader
                icon={<RotateCcw className="w-3.5 h-3.5 text-rose-500"/>}
                title={UI_TEXT.SETTINGS.GENERAL.SECTION_RESET}
            />
            <div className="space-y-2">
                <button
                    type="button"
                    onClick={onResetSettings}
                    className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 text-xs font-black transition cursor-pointer active:scale-[0.99]"
                >
                    <RotateCcw className="w-3.5 h-3.5"/>
                    <span>{UI_TEXT.SETTINGS.GENERAL.RESET_SETTINGS_BTN}</span>
                </button>

                {!confirmClearData ? (
                    <button
                        type="button"
                        onClick={() => {
                            triggerHaptic("light");
                            onSetConfirmClearData(true);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-xs font-black transition cursor-pointer active:scale-[0.99]"
                    >
                        <Trash2 className="w-3.5 h-3.5"/>
                        <span>{UI_TEXT.SETTINGS.GENERAL.CLEAR_ALL_BTN}</span>
                    </button>
                ) : (
                    <div
                        className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 space-y-2.5">
                        <p className="text-xs font-bold text-rose-800 dark:text-rose-200 text-center">
                            {UI_TEXT.SETTINGS.GENERAL.CLEAR_ALL_CONFIRM}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => onSetConfirmClearData(false)}
                                className="py-2 px-3 rounded-xl bg-white dark:bg-white/10 text-slate-700 dark:text-slate-200 border border-black/10 dark:border-white/10 text-xs font-black cursor-pointer hover:bg-slate-100 dark:hover:bg-white/15 transition"
                            >
                                {UI_TEXT.COMMON.CANCEL}
                            </button>
                            <button
                                type="button"
                                onClick={onClearAllData}
                                className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-xs cursor-pointer transition"
                            >
                                {UI_TEXT.COMMON.DELETE_ALL}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </section>

        <section className="space-y-2.5">
            <SettingsSectionHeader
                icon={<Info className="w-3.5 h-3.5 text-slate-400"/>}
                title={UI_TEXT.SETTINGS.GENERAL.SECTION_ABOUT}
                right={
                    <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500">
                        {UI_TEXT.SETTINGS.GENERAL.APP_VERSION_FORMAT(appVersion)}
                    </span>
                }
            />
            <div className="grid grid-cols-2 gap-2">
                <Link
                    href="/terms"
                    onClick={() => {
                        markModalNavigating();
                        onClose();
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-black transition active:scale-95"
                >
                    <FileText className="w-3.5 h-3.5 text-slate-500 shrink-0"/>
                    <span>{UI_TEXT.COMMON.TERMS_OF_SERVICE}</span>
                </Link>

                <Link
                    href="/privacy"
                    onClick={() => {
                        markModalNavigating();
                        onClose();
                    }}
                    className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-black transition active:scale-95"
                >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0"/>
                    <span>{UI_TEXT.COMMON.PRIVACY_POLICY}</span>
                </Link>
            </div>
        </section>
    </>
);
