"use client";

import React, {useCallback, useState, useSyncExternalStore} from "react";
import {useTheme} from "next-themes";
import {
    ArrowLeft,
    ArrowRight,
    Bus,
    Check,
    Compass,
    MapPin,
    Monitor,
    Moon,
    Route,
    Settings,
    Sparkles,
    Sun,
} from "lucide-react";

import {NATIONWIDE_CITIES, useCityContext} from "@entities/city";
import {ToggleSwitch} from "@features/settings/ToggleSwitch";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {applyThemePreference, Modal, type ThemePreference} from "@shared/ui";
import {triggerHaptic} from "@shared/utils/haptics";
import {UI_TEXT} from "@shared/config/locale";

const TOTAL_STEPS = UI_TEXT.ONBOARDING.STEPS.length;
const STEP_META = UI_TEXT.ONBOARDING.STEPS;

const emptySubscribe = () => () => {
};

export const OnboardingModal: React.FC = () => {
    const {isOnboardingOpen, closeOnboarding, settings, updateSettings} = useAppSettings();
    const {setIsAutoDetectEnabled} = useCityContext();
    const {theme, setTheme} = useTheme();
    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

    const [step, setStep] = useState(0);
    const [prevIsOpen, setPrevIsOpen] = useState(isOnboardingOpen);
    if (isOnboardingOpen !== prevIsOpen) {
        setPrevIsOpen(isOnboardingOpen);
        if (isOnboardingOpen) {
            setStep(0);
        }
    }

    const activeTheme: ThemePreference = mounted
        ? ((theme as ThemePreference | undefined) ?? "system")
        : "system";

    const handleComplete = useCallback(() => {
        triggerHaptic("success");
        closeOnboarding();
    }, [closeOnboarding]);

    const handleSkip = useCallback(() => {
        triggerHaptic("light");
        closeOnboarding();
    }, [closeOnboarding]);

    const handleNext = useCallback(() => {
        triggerHaptic("selection");
        setStep((prev) => Math.min(TOTAL_STEPS - 1, prev + 1));
    }, []);

    const handlePrev = useCallback(() => {
        triggerHaptic("selection");
        setStep((prev) => Math.max(0, prev - 1));
    }, []);

    const handleThemeSelect = useCallback(
        (nextTheme: ThemePreference) => {
            triggerHaptic("selection");
            applyThemePreference(nextTheme, setTheme);
        },
        [setTheme]
    );

    const currentMeta = STEP_META[step];

    const modalIcon = (
        <div
            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-[#003876] to-blue-600 text-white shadow-sm shrink-0">
            <Sparkles className="w-5 h-5"/>
        </div>
    );

    const headerBadge = (
        <span
            className="inline-flex items-center px-2 py-0.5 rounded-full bg-blue-500/10 text-[10px] font-black text-blue-700 dark:text-blue-300">
            {step + 1} / {TOTAL_STEPS}
        </span>
    );

    const headerActions =
        step < TOTAL_STEPS - 1 ? (
            <button
                type="button"
                onClick={handleSkip}
                className="px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
            >
                {UI_TEXT.ONBOARDING.SKIP}
            </button>
        ) : null;

    const modalFooter = (
        <>
            <div className="flex items-center gap-2.5">
                {step > 0 && (
                    <button
                        type="button"
                        onClick={handlePrev}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/10 dark:hover:bg-white/15 text-slate-700 dark:text-slate-200 text-xs font-black transition cursor-pointer active:scale-95"
                    >
                        <ArrowLeft className="w-3.5 h-3.5"/>
                        <span>{UI_TEXT.ONBOARDING.PREV}</span>
                    </button>
                )}

                <div className="flex items-center gap-1.5" role="group"
                     aria-label={UI_TEXT.ONBOARDING.STEPS_GROUP_ARIA}>
                    {Array.from({length: TOTAL_STEPS}).map((_, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => {
                                triggerHaptic("selection");
                                setStep(idx);
                            }}
                            aria-label={UI_TEXT.ONBOARDING.STEP_ARIA(idx + 1)}
                            aria-current={step === idx ? "step" : undefined}
                            className={`h-2 rounded-full transition-all cursor-pointer ${
                                step === idx
                                    ? "w-5 bg-[#003876] dark:bg-blue-400"
                                    : "w-2 bg-slate-300 dark:bg-white/20 hover:bg-slate-400 dark:hover:bg-white/35"
                            }`}
                        />
                    ))}
                </div>
            </div>

            <div className="flex items-center gap-2">
                {step < TOTAL_STEPS - 1 ? (
                    <button
                        type="button"
                        onClick={handleNext}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black shadow-sm hover:opacity-90 transition cursor-pointer active:scale-95"
                    >
                        <span>{UI_TEXT.ONBOARDING.NEXT}</span>
                        <ArrowRight className="w-3.5 h-3.5"/>
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={handleComplete}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#003876] dark:bg-blue-600 text-white text-xs font-black shadow-sm hover:opacity-95 transition cursor-pointer active:scale-95"
                    >
                        <Check className="w-3.5 h-3.5"/>
                        <span>{UI_TEXT.ONBOARDING.START_BUTTON}</span>
                    </button>
                )}
            </div>
        </>
    );

    return (
        <Modal
            isOpen={isOnboardingOpen}
            onClose={closeOnboarding}
            enableHistory={false}
            title={currentMeta.title}
            subtitle={currentMeta.subtitle}
            icon={modalIcon}
            headerBadge={headerBadge}
            headerActions={headerActions}
            footer={modalFooter}
            maxWidth="lg"
            height="auto"
            modalId="onboarding"
            footerClassName="flex-wrap gap-2"
            ariaLabel={UI_TEXT.ONBOARDING.MODAL_ARIA}
        >
            <div className="overflow-y-auto overscroll-contain p-4 sm:p-6 space-y-3 custom-scrollbar">
                {/* STEP 1: Core Features */}
                {step === 0 && (
                    <div className="space-y-3 animate-fadeIn">
                        <div
                            className="p-4 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 flex items-start gap-3.5">
                            <div
                                className="flex items-center justify-center w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 shrink-0">
                                <Bus className="w-5 h-5"/>
                            </div>
                            <div className="min-w-0 space-y-1">
                                <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                    {UI_TEXT.ONBOARDING.FEATURE_REALTIME_TITLE(NATIONWIDE_CITIES.length)}
                                </h3>
                                <p className="text-[11px] sm:text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                                    {UI_TEXT.ONBOARDING.FEATURE_REALTIME_DESC}
                                </p>
                            </div>
                        </div>

                        <div
                            className="p-4 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 flex items-start gap-3.5">
                            <div
                                className="flex items-center justify-center w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                                <Route className="w-5 h-5"/>
                            </div>
                            <div className="min-w-0 space-y-1">
                                <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                    {UI_TEXT.ONBOARDING.FEATURE_ROUTES_TITLE}
                                </h3>
                                <p className="text-[11px] sm:text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                                    {UI_TEXT.ONBOARDING.FEATURE_ROUTES_DESC}
                                </p>
                            </div>
                        </div>

                        <div
                            className="p-4 rounded-2xl bg-emerald-50/70 dark:bg-emerald-950/25 border border-emerald-500/20 flex items-start gap-3.5">
                            <div
                                className="flex items-center justify-center w-10 h-10 rounded-2xl bg-emerald-600 text-white shrink-0">
                                <MapPin className="w-5 h-5"/>
                            </div>
                            <div className="min-w-0 space-y-1">
                                <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                    {UI_TEXT.ONBOARDING.FEATURE_WIKI_TITLE}
                                </h3>
                                <p className="text-[11px] sm:text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                                    {UI_TEXT.ONBOARDING.FEATURE_WIKI_DESC}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 2: Interactive Personalization */}
                {step === 1 && (
                    <div className="space-y-3.5 animate-fadeIn">
                        {/* Theme Selection */}
                        <div
                            className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 space-y-2.5">
                            <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                                {UI_TEXT.ONBOARDING.THEME_LABEL}
                            </p>
                            <div className="grid grid-cols-3 gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => handleThemeSelect("system")}
                                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                                        activeTheme === "system"
                                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xs"
                                            : "bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10"
                                    }`}
                                >
                                    <Monitor className="w-3.5 h-3.5"/>
                                    <span>{UI_TEXT.ONBOARDING.THEME_SYSTEM}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleThemeSelect("light")}
                                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                                        activeTheme === "light"
                                            ? "bg-amber-500 text-white border-transparent shadow-xs"
                                            : "bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10"
                                    }`}
                                >
                                    <Sun className="w-3.5 h-3.5"/>
                                    <span>{UI_TEXT.ONBOARDING.THEME_LIGHT}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleThemeSelect("dark")}
                                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                                        activeTheme === "dark"
                                            ? "bg-blue-600 text-white border-transparent shadow-xs"
                                            : "bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10"
                                    }`}
                                >
                                    <Moon className="w-3.5 h-3.5"/>
                                    <span>{UI_TEXT.ONBOARDING.THEME_DARK}</span>
                                </button>
                            </div>
                        </div>

                        {/* Quick Toggles */}
                        <div
                            className="rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 divide-y divide-black/5 dark:divide-white/[0.06]">
                            <div className="p-3.5 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                                        {UI_TEXT.ONBOARDING.AUTO_DETECT_TITLE}
                                    </p>
                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                        {UI_TEXT.ONBOARDING.AUTO_DETECT_DESC}
                                    </p>
                                </div>
                                <ToggleSwitch
                                    checked={settings.autoDetectCity}
                                    onChange={(next) => {
                                        triggerHaptic("selection");
                                        updateSettings({autoDetectCity: next});
                                        setIsAutoDetectEnabled(next);
                                    }}
                                    ariaLabel={UI_TEXT.ONBOARDING.AUTO_DETECT_ARIA}
                                />
                            </div>

                            <div className="p-3.5 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                                        {UI_TEXT.ONBOARDING.LARGE_FONT_TITLE}
                                    </p>
                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                        {UI_TEXT.ONBOARDING.LARGE_FONT_DESC}
                                    </p>
                                </div>
                                <ToggleSwitch
                                    checked={settings.fontScale === "large"}
                                    onChange={(next) => {
                                        triggerHaptic("selection");
                                        updateSettings({fontScale: next ? "large" : "normal"});
                                    }}
                                    ariaLabel={UI_TEXT.ONBOARDING.LARGE_FONT_ARIA}
                                />
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 3: Quick Usage Tips & Summary */}
                {step === 2 && (
                    <div className="space-y-3 animate-fadeIn">
                        <div
                            className="p-3.5 rounded-2xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-500/25 flex items-center justify-between gap-2">
                            <span className="text-xs font-black text-emerald-900 dark:text-emerald-200">
                                {UI_TEXT.ONBOARDING.SELECTED_SETTINGS_LABEL}
                            </span>
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                {activeTheme === "system"
                                    ? UI_TEXT.ONBOARDING.SUMMARY_THEME_SYSTEM
                                    : activeTheme === "light"
                                        ? UI_TEXT.ONBOARDING.SUMMARY_THEME_LIGHT
                                        : UI_TEXT.ONBOARDING.SUMMARY_THEME_DARK} ·{" "}
                                {settings.autoDetectCity
                                    ? UI_TEXT.ONBOARDING.SUMMARY_REGION_AUTO
                                    : UI_TEXT.ONBOARDING.SUMMARY_REGION_MANUAL}
                                {settings.fontScale === "large"
                                    ? ` · ${UI_TEXT.ONBOARDING.SUMMARY_LARGE_FONT}`
                                    : ""}
                            </span>
                        </div>

                        <div
                            className="rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 divide-y divide-black/5 dark:divide-white/[0.06]">
                            <div className="p-3.5 flex items-start gap-3">
                                <div
                                    className="flex items-center justify-center w-8 h-8 rounded-xl bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-300 shrink-0">
                                    <Compass className="w-4 h-4"/>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                                        {UI_TEXT.ONBOARDING.TIP_NAV_TITLE}
                                    </p>
                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                                        {UI_TEXT.ONBOARDING.TIP_NAV_DESC}
                                    </p>
                                </div>
                            </div>

                            <div className="p-3.5 flex items-start gap-3">
                                <div
                                    className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 shrink-0">
                                    <MapPin className="w-4 h-4"/>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                                        {UI_TEXT.ONBOARDING.TIP_PINS_TITLE}
                                    </p>
                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                                        {UI_TEXT.ONBOARDING.TIP_PINS_DESC}
                                    </p>
                                </div>
                            </div>

                            <div className="p-3.5 flex items-start gap-3">
                                <div
                                    className="flex items-center justify-center w-8 h-8 rounded-xl bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-200 shrink-0">
                                    <Settings className="w-4 h-4"/>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                                        {UI_TEXT.ONBOARDING.TIP_SETTINGS_TITLE}
                                    </p>
                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                                        {UI_TEXT.ONBOARDING.TIP_SETTINGS_DESC}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default OnboardingModal;
