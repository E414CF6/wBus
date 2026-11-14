"use client";

import React, {useCallback, useState, useSyncExternalStore} from "react";
import {useTheme} from "next-themes";
import {CheckCircle2, Cookie, Database, MapIcon, Settings, SlidersHorizontal, Sparkles, X} from "lucide-react";

import {useCityContext} from "@entities/city";
import {SETTINGS_COOKIE_NAME} from "@shared/config/settingsCookie";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {applyThemePreference, Modal, type ThemePreference} from "@shared/ui";
import {triggerHaptic} from "@shared/utils/haptics";

import {YonseiSettingsModal} from "./YonseiSettingsModal";
import {DataSettingsTab} from "./tabs/DataSettingsTab";
import {DeviceSettingsTab} from "./tabs/DeviceSettingsTab";
import {GeneralSettingsTab} from "./tabs/GeneralSettingsTab";
import {MapSettingsTab} from "./tabs/MapSettingsTab";

const APP_VERSION = "26.13.0";

export interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type SettingsTabId = "general" | "map" | "device" | "data";

const SETTINGS_TABS: readonly {
    id: SettingsTabId;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
}[] = [
    {id: "general", label: "일반", icon: Sparkles},
    {id: "map", label: "지도·추적", icon: MapIcon},
    {id: "device", label: "지역·편의", icon: SlidersHorizontal},
    {id: "data", label: "데이터·정보", icon: Database},
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
    const [isYonseiModalOpen, setIsYonseiModalOpen] = useState(false);

    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
    if (isOpen !== prevIsOpen) {
        setPrevIsOpen(isOpen);
        if (isOpen) {
            setConfirmClearData(false);
            setStatusNotice(null);
        }
        setIsYonseiModalOpen(false);
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
        setStatusNotice("노선·시간표·공지사항 임시 캐시가 삭제되었습니다. 즐겨찾기와 설정은 유지됩니다.");
    }, [clearApiCache]);

    const handleResetSettings = useCallback(() => {
        triggerHaptic("warning");
        resetSettings();
        setIsAutoDetectEnabled(true);
        applyThemePreference("system", setTheme);
        setConfirmClearData(false);
        setStatusNotice("쿠키에 저장된 환경설정이 기본값으로 초기화되었습니다.");
    }, [resetSettings, setIsAutoDetectEnabled, setTheme]);

    const handleClearAllData = useCallback(() => {
        triggerHaptic("warning");
        clearAllAppData();
        setIsAutoDetectEnabled(true);
        applyThemePreference("system", setTheme);
        setConfirmClearData(false);
        setStatusNotice("설정 쿠키와 즐겨찾기·최근 조회·캐시가 모두 초기화되었습니다.");
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
        <>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold truncate">
                <Cookie className="w-3.5 h-3.5 text-amber-500 shrink-0"/>
                <span className="truncate">
                    <code className="font-mono">{SETTINGS_COOKIE_NAME}</code> 쿠키에 자동 저장
                </span>
            </div>
            <button
                type="button"
                onClick={onClose}
                className="px-4 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black cursor-pointer hover:opacity-90 transition shrink-0 active:scale-95"
            >
                완료
            </button>
        </>
    );

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={onClose}
                title="환경설정"
                subtitle="화면, 지도, 실시간 추적 및 앱 데이터를 관리합니다"
                icon={modalIcon}
                headerBadge={headerBadge}
                footer={modalFooter}
                maxWidth="lg"
                height="default"
                modalId="settings"
                suspended={isYonseiModalOpen}
                ariaLabel="wBus 환경설정 모달"
            >
                <div
                    className="px-4 sm:px-6 pt-3 pb-2.5 border-b border-black/5 dark:border-white/5 bg-slate-50/40 dark:bg-white/[0.01] shrink-0">
                    <div
                        role="tablist"
                        aria-label="환경설정 카테고리"
                        className="grid grid-cols-4 gap-1 p-1 rounded-2xl bg-slate-200/70 dark:bg-white/[0.06]"
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
                                aria-label="알림 닫기"
                            >
                                <X className="w-3.5 h-3.5"/>
                            </button>
                        </div>
                    )}

                    {activeTab === "general" && (
                        <GeneralSettingsTab
                            settings={settings}
                            activeTheme={activeTheme}
                            onThemeChange={handleThemeChange}
                            onUpdateSettings={updateSettings}
                            onOpenYonseiModal={() => setIsYonseiModalOpen(true)}
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

                    {activeTab === "data" && (
                        <DataSettingsTab
                            appVersion={APP_VERSION}
                            confirmClearData={confirmClearData}
                            onSetConfirmClearData={setConfirmClearData}
                            onClose={onClose}
                            onOpenOnboarding={openOnboarding}
                            onClearApiCache={handleClearApiCache}
                            onResetSettings={handleResetSettings}
                            onClearAllData={handleClearAllData}
                        />
                    )}
                </div>
            </Modal>

            <YonseiSettingsModal
                isOpen={isYonseiModalOpen}
                onClose={() => setIsYonseiModalOpen(false)}
                onCloseParent={onClose}
            />
        </>
    );
};

export default SettingsModal;
