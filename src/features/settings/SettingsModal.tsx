"use client";

import React, {useCallback, useState, useSyncExternalStore} from "react";
import {useTheme} from "next-themes";
import {CheckCircle2, MapIcon, Settings, SlidersHorizontal, Sparkles, X} from "lucide-react";

import {useCityContext} from "@entities/city";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {applyThemePreference, Modal, type ThemePreference} from "@shared/ui";
import {triggerHaptic} from "@shared/utils/haptics";
import {UI_TEXT} from "@shared/config/locale";

import {DeviceSettingsTab} from "./tabs/DeviceSettingsTab";
import {GeneralSettingsTab} from "./tabs/GeneralSettingsTab";
import {MapSettingsTab} from "./tabs/MapSettingsTab";

const APP_VERSION = "26.13.0";

export interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type SettingsTabId = "general" | "map" | "device";

const SETTINGS_TABS: readonly {
    id: SettingsTabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
}[] = [
    {id: "general", label: UI_TEXT.SETTINGS.TABS.GENERAL, icon: Sparkles},
    {id: "map", label: UI_TEXT.SETTINGS.TABS.MAP, icon: MapIcon},
    {id: "device", label: UI_TEXT.SETTINGS.TABS.DEVICE, icon: SlidersHorizontal},
];

const emptySubscribe = () => () => {
};

export const SettingsModal: React.FC<SettingsModalProps> = ({isOpen, onClose}) => {
    const {
        settings,
        updateSettings,
        resetSettings,
        clearApiCache,
        clearAllAppData,
        openOnboarding,
    } = useAppSettings();
    const {currentCity, setIsAutoDetectEnabled} = useCityContext();
    const {theme, setTheme} = useTheme();
    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

    const [activeTab, setActiveTab] = useState<SettingsTabId>("general");
    const [confirmClearData, setConfirmClearData] = useState(false);
    const [statusNotice, setStatusNotice] = useState<string | null>(null);

    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
    if (isOpen !== prevIsOpen) {
        setPrevIsOpen(isOpen);
        if (isOpen) {
            setConfirmClearData(false);
            setStatusNotice(null);
        }
    }

    const activeTheme: ThemePreference = mounted
        ? ((theme as ThemePreference | undefined) ?? "system")
        : "system";

    const handleTabChange = useCallback((nextTab: SettingsTabId) => {
        triggerHaptic("selection");
        setActiveTab(nextTab);
        setConfirmClearData(false);
    }, []);

    const handleToggleAutoDetect = useCallback(
        (next: boolean) => {
            triggerHaptic("selection");
            updateSettings({autoDetectCity: next});
            setIsAutoDetectEnabled(next);
        },
        [updateSettings, setIsAutoDetectEnabled]
    );

    const handleToggleHaptic = useCallback(
        (next: boolean) => {
            updateSettings({hapticEnabled: next});
            if (next) {
                triggerHaptic("selection");
            }
        },
        [updateSettings]
    );

    const handleThemeChange = useCallback(
        (nextTheme: ThemePreference) => {
            triggerHaptic("selection");
            applyThemePreference(nextTheme, setTheme);
        },
        [setTheme]
    );

    const handleClearApiCache = useCallback(() => {
        triggerHaptic("light");
        clearApiCache();
        setConfirmClearData(false);
        setStatusNotice(UI_TEXT.SETTINGS.NOTICES.CACHE_CLEARED);
    }, [clearApiCache]);

    const handleResetSettings = useCallback(() => {
        triggerHaptic("warning");
        resetSettings();
        setIsAutoDetectEnabled(true);
        applyThemePreference("system", setTheme);
        setConfirmClearData(false);
        setStatusNotice(UI_TEXT.SETTINGS.NOTICES.SETTINGS_RESET);
    }, [resetSettings, setIsAutoDetectEnabled, setTheme]);

    const handleClearAllData = useCallback(() => {
        triggerHaptic("warning");
        clearAllAppData();
        setIsAutoDetectEnabled(true);
        applyThemePreference("system", setTheme);
        setConfirmClearData(false);
        setStatusNotice(UI_TEXT.SETTINGS.NOTICES.ALL_DATA_CLEARED);
    }, [clearAllAppData, setIsAutoDetectEnabled, setTheme]);

    const modalIcon = (
        <div
            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm shrink-0">
            <Settings className="w-5 h-5"/>
        </div>
    );

    const headerBadge = (
        <span
            className="inline-flex items-center px-2 py-0.5 rounded-full bg-slate-200/80 dark:bg-white/10 text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300">
            v{APP_VERSION}
        </span>
    );

    const modalFooter = (
        <button
            type="button"
            onClick={onClose}
            className="ml-auto px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black cursor-pointer hover:opacity-90 transition shrink-0 active:scale-95"
        >
            {UI_TEXT.COMMON.DONE}
        </button>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={UI_TEXT.SETTINGS.MODAL_TITLE}
            subtitle={UI_TEXT.SETTINGS.MODAL_SUBTITLE}
            icon={modalIcon}
            headerBadge={headerBadge}
            footer={modalFooter}
            maxWidth="lg"
            height="default"
            modalId="settings"
            ariaLabel={UI_TEXT.SETTINGS.MODAL_ARIA}
        >
            <div
                className="px-4 sm:px-6 pt-3 pb-2.5 border-b border-black/5 dark:border-white/5 bg-slate-50/40 dark:bg-white/[0.01] shrink-0">
                <div
                    role="tablist"
                    aria-label={UI_TEXT.SETTINGS.TABS_ARIA}
                    className="grid grid-cols-3 gap-1 p-1 rounded-2xl bg-slate-200/70 dark:bg-white/[0.06]"
                >
                    {SETTINGS_TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={isActive}
                                onClick={() => handleTabChange(tab.id)}
                                className={`flex items-center justify-center gap-1.5 py-2 px-1.5 rounded-xl text-[11px] sm:text-xs font-black transition-all cursor-pointer ${
                                    isActive
                                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5 shrink-0"/>
                                <span className="truncate">{tab.label}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            <div
                role="tabpanel"
                className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar"
            >
                {statusNotice && (
                    <div
                        className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 flex items-start justify-between gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                        <div className="flex items-start gap-2 min-w-0">
                            <CheckCircle2
                                className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5"/>
                            <span>{statusNotice}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setStatusNotice(null)}
                            className="p-0.5 rounded-lg text-emerald-700/70 dark:text-emerald-300/70 hover:bg-emerald-500/10 cursor-pointer shrink-0"
                            aria-label={UI_TEXT.SETTINGS.DISMISS_NOTICE_ARIA}
                        >
                            <X className="w-3.5 h-3.5"/>
                        </button>
                    </div>
                )}

                {activeTab === "general" && (
                    <GeneralSettingsTab
                        settings={settings}
                        activeTheme={activeTheme}
                        appVersion={APP_VERSION}
                        confirmClearData={confirmClearData}
                        onThemeChange={handleThemeChange}
                        onUpdateSettings={updateSettings}
                        onSetConfirmClearData={setConfirmClearData}
                        onClose={onClose}
                        onOpenOnboarding={openOnboarding}
                        onClearApiCache={handleClearApiCache}
                        onResetSettings={handleResetSettings}
                        onClearAllData={handleClearAllData}
                    />
                )}

                {activeTab === "map" && (
                    <MapSettingsTab
                        settings={settings}
                        onUpdateSettings={updateSettings}
                    />
                )}

                {activeTab === "device" && (
                    <DeviceSettingsTab
                        settings={settings}
                        currentCityName={currentCity.name}
                        onToggleAutoDetect={handleToggleAutoDetect}
                        onToggleHaptic={handleToggleHaptic}
                        onUpdateSettings={updateSettings}
                    />
                )}
            </div>
        </Modal>
    );
};

export default SettingsModal;
