"use client";

import React, {useCallback, useState, useSyncExternalStore} from "react";
import Link from "next/link";
import {useTheme} from "next-themes";
import {
    Calendar,
    CheckCircle2,
    ChevronRight,
    Compass,
    Cookie,
    Database,
    FileText,
    GraduationCap,
    Info,
    MapIcon,
    Monitor,
    Moon,
    Radio,
    RotateCcw,
    Settings,
    ShieldCheck,
    SlidersHorizontal,
    Sparkles,
    Sun,
    Trash2,
    Vibrate,
    X,
} from "lucide-react";

import {useCityContext} from "@entities/city";
import {
    type FontScale,
    LIVE_POLLING_INTERVAL_OPTIONS,
    type LivePollingIntervalMs,
    SETTINGS_COOKIE_NAME,
} from "@shared/config/settingsCookie";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {applyThemePreference, markModalNavigating, Modal, type ThemePreference} from "@shared/ui";
import {triggerHaptic} from "@shared/utils/haptics";

import {SettingsBlock, SettingsGroup, SettingsSectionHeader, SettingsToggleRow,} from "./SettingsPrimitives";
import {YonseiSettingsModal} from "./YonseiSettingsModal";

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

const POLLING_INTERVAL_LABELS: Record<LivePollingIntervalMs, { label: string; hint: string }> = {
    5000: {label: "5초", hint: "빠른 갱신"},
    10000: {label: "10초", hint: "기본"},
    15000: {label: "15초", hint: "보통"},
    30000: {label: "30초", hint: "절약"},
};

const YONSEI_DIRECTION_SUMMARY = {
    AUTO: "시간대 자동",
    OUTBOUND: "하교 고정",
    INBOUND: "등교 고정",
} as const;

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
                {/* Segmented Tab Bar */}
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

                {/* Scrollable Tab Content */}
                <div
                    role="tabpanel"
                    className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar"
                >
                    {/* Status Feedback Banner */}
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

                    {/* TAB 1: General (Appearance, Font Scale, Timetable Day Mode, Campus Hub) */}
                    {activeTab === "general" && (
                        <>
                            <section className="space-y-2.5">
                                <SettingsSectionHeader
                                    icon={<Sparkles className="w-3.5 h-3.5 text-blue-500"/>}
                                    title="화면 스타일"
                                />
                                <SettingsGroup>
                                    {/* Theme Selection */}
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
                                                onClick={() => handleThemeChange("system")}
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
                                                onClick={() => handleThemeChange("light")}
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
                                                onClick={() => handleThemeChange("dark")}
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

                                    {/* Font Scale */}
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
                                                        updateSettings({fontScale: opt.id});
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
                                                        updateSettings({defaultDayMode: mode.id});
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

                            {/* Featured Yonsei Campus Hub Card */}
                            <section className="space-y-2.5">
                                <SettingsSectionHeader
                                    icon={<GraduationCap className="w-3.5 h-3.5 text-[#003876] dark:text-blue-400"/>}
                                    title="캠퍼스 · 특화 허브"
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic("light");
                                        setIsYonseiModalOpen(true);
                                    }}
                                    className="w-full p-3.5 rounded-2xl bg-[#003876]/[0.06] hover:bg-[#003876]/10 dark:bg-blue-500/10 dark:hover:bg-blue-500/15 border border-[#003876]/15 dark:border-blue-400/20 flex items-center justify-between gap-3 text-left transition cursor-pointer active:scale-[0.99]"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div
                                            className="flex items-center justify-center w-9 h-9 rounded-xl bg-[#003876] text-white shrink-0 shadow-xs">
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
                    )}

                    {/* TAB 2: Map & Live Tracking */}
                    {activeTab === "map" && (
                        <>
                            <section className="space-y-2.5">
                                <SettingsSectionHeader
                                    icon={<Radio className="w-3.5 h-3.5 text-emerald-500"/>}
                                    title="실시간 위치 추적"
                                />
                                <SettingsGroup>
                                    <SettingsBlock>
                                        <div>
                                            <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                                                실시간 버스 위치 갱신 주기
                                            </p>
                                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                                짧을수록 위치가 빠르게 반영되고, 길수록 배터리·데이터를 절약합니다
                                            </p>
                                        </div>
                                        <div className="grid grid-cols-4 gap-1.5">
                                            {LIVE_POLLING_INTERVAL_OPTIONS.map((ms) => {
                                                const meta = POLLING_INTERVAL_LABELS[ms];
                                                const active = settings.livePollingIntervalMs === ms;
                                                return (
                                                    <button
                                                        key={ms}
                                                        type="button"
                                                        onClick={() => {
                                                            triggerHaptic("selection");
                                                            updateSettings({livePollingIntervalMs: ms});
                                                        }}
                                                        className={`flex flex-col items-center justify-center py-2 px-1.5 rounded-xl border transition cursor-pointer ${
                                                            active
                                                                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xs"
                                                                : "bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10"
                                                        }`}
                                                    >
                                                        <span className="text-xs font-black">{meta.label}</span>
                                                        <span
                                                            className={`text-[10px] font-semibold mt-0.5 ${
                                                                active ? "text-white/75 dark:text-slate-600" : "text-slate-400"
                                                            }`}
                                                        >
                                                            {meta.hint}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </SettingsBlock>

                                    <SettingsToggleRow
                                        title="버스 마커 부드러운 이동"
                                        description="노선 경로를 따라 버스가 부드럽게 주행하도록 보간 애니메이션을 적용합니다"
                                        checked={settings.smoothBusAnimation}
                                        onChange={(next) => {
                                            triggerHaptic("selection");
                                            updateSettings({smoothBusAnimation: next});
                                        }}
                                        ariaLabel="버스 마커 부드러운 이동 전환"
                                    />

                                    <SettingsToggleRow
                                        title="버스 마커 차량번호 표시"
                                        description="지도 위 버스 아이콘 아래에 차량번호 뒷 4자리를 함께 표시합니다"
                                        checked={settings.showBusPlateNumber}
                                        onChange={(next) => {
                                            triggerHaptic("selection");
                                            updateSettings({showBusPlateNumber: next});
                                        }}
                                        ariaLabel="버스 마커 차량번호 표시 전환"
                                    />
                                </SettingsGroup>
                            </section>

                            <section className="space-y-2.5">
                                <SettingsSectionHeader
                                    icon={<MapIcon className="w-3.5 h-3.5 text-sky-500"/>}
                                    title="지도 레이어 및 조작"
                                />
                                <SettingsGroup>
                                    <SettingsToggleRow
                                        title="지도 주변 정류장 표시"
                                        description="지도를 확대했을 때 선택한 노선 외 주변 일반 정류장도 함께 표시합니다"
                                        checked={settings.showNearbyStops}
                                        onChange={(next) => {
                                            triggerHaptic("selection");
                                            updateSettings({showNearbyStops: next});
                                        }}
                                        ariaLabel="지도 주변 정류장 표시 전환"
                                    />

                                    <SettingsToggleRow
                                        title="지도 정류장 이름 라벨 표시"
                                        description="확대 시 정류장 핀 옆에 정류장 이름을 표시합니다 (끄면 지도가 더 간결해집니다)"
                                        checked={settings.showStopLabels}
                                        onChange={(next) => {
                                            triggerHaptic("selection");
                                            updateSettings({showStopLabels: next});
                                        }}
                                        ariaLabel="지도 정류장 이름 라벨 표시 전환"
                                    />

                                    <SettingsToggleRow
                                        title="노선 변경 시 지도 자동 맞춤"
                                        description="새 노선을 선택할 때 전체 노선 경로가 한눈에 들어오도록 지도를 이동합니다"
                                        checked={settings.autoFitRouteBounds}
                                        onChange={(next) => {
                                            triggerHaptic("selection");
                                            updateSettings({autoFitRouteBounds: next});
                                        }}
                                        ariaLabel="노선 변경 시 지도 자동 맞춤 전환"
                                    />

                                    <SettingsToggleRow
                                        title="기점·종점 시간표 핀 표시"
                                        description="지도 위 기점·종점·회차 정류장의 다음 출발 시각 핀을 표시합니다"
                                        checked={settings.showTimetablePins}
                                        onChange={(next) => {
                                            triggerHaptic("selection");
                                            updateSettings({showTimetablePins: next});
                                        }}
                                        ariaLabel="기점·종점 시간표 핀 표시 전환"
                                    />

                                    <SettingsToggleRow
                                        title="지도 줌·나침반 버튼 표시"
                                        description="지도 우측 상단의 확대/축소 및 나침반 컨트롤 버튼을 표시합니다"
                                        checked={settings.showMapControls}
                                        onChange={(next) => {
                                            triggerHaptic("selection");
                                            updateSettings({showMapControls: next});
                                        }}
                                        ariaLabel="지도 줌 나침반 버튼 표시 전환"
                                    />
                                </SettingsGroup>
                            </section>
                        </>
                    )}

                    {/* TAB 3: Region, Accessibility & Device */}
                    {activeTab === "device" && (
                        <>
                            <section className="space-y-2.5">
                                <SettingsSectionHeader
                                    icon={<Compass className="w-3.5 h-3.5 text-emerald-500"/>}
                                    title="지역 및 지도 기억"
                                    right={
                                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                                            현재: {currentCity.name}
                                        </span>
                                    }
                                />
                                <SettingsGroup>
                                    <SettingsToggleRow
                                        title="지도 이동 시 지역 자동 감지"
                                        description="지도를 다른 시·군으로 이동하면 해당 지역 전환 알림을 표시합니다"
                                        checked={settings.autoDetectCity}
                                        onChange={handleToggleAutoDetect}
                                        ariaLabel="지도 이동 시 지역 자동 감지 전환"
                                    />

                                    <SettingsToggleRow
                                        title="마지막 지도 위치 기억"
                                        description="앱을 다시 열 때 마지막으로 보던 지도 위치와 확대 수준을 복원합니다"
                                        checked={settings.rememberMapView}
                                        onChange={(next) => {
                                            triggerHaptic("selection");
                                            updateSettings({rememberMapView: next});
                                        }}
                                        ariaLabel="마지막 지도 위치 기억 전환"
                                    />
                                </SettingsGroup>
                            </section>

                            <section className="space-y-2.5">
                                <SettingsSectionHeader
                                    icon={<Vibrate className="w-3.5 h-3.5 text-indigo-500"/>}
                                    title="접근성 및 기기 반응"
                                />
                                <SettingsGroup>
                                    <SettingsToggleRow
                                        title="화면 전환·모션 줄이기"
                                        description="모달 전환과 지도 이동 애니메이션을 최소화해 배터리·눈 피로를 줄입니다"
                                        checked={settings.reduceMotion}
                                        onChange={(next) => {
                                            triggerHaptic("selection");
                                            updateSettings({reduceMotion: next});
                                        }}
                                        ariaLabel="화면 전환 모션 줄이기 전환"
                                    />

                                    <SettingsToggleRow
                                        title="모바일 터치 진동 (햅틱 피드백)"
                                        description="지원 기기에서 버튼 조작 시 짧은 진동 피드백을 제공합니다"
                                        checked={settings.hapticEnabled}
                                        onChange={handleToggleHaptic}
                                        ariaLabel="모바일 터치 진동 피드백 전환"
                                    />
                                </SettingsGroup>
                            </section>
                        </>
                    )}

                    {/* TAB 4: Data, Onboarding & App Info */}
                    {activeTab === "data" && (
                        <>
                            <section className="space-y-2.5">
                                <SettingsSectionHeader
                                    icon={<Sparkles className="w-3.5 h-3.5 text-blue-500"/>}
                                    title="가이드 및 캐시"
                                />
                                <div className="space-y-2">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            triggerHaptic("light");
                                            onClose();
                                            openOnboarding();
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
                                                    온보딩 가이드 다시 보기
                                                </p>
                                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                                    wBus 주요 기능 안내 및 초기 맞춤 설정을 다시 진행합니다
                                                </p>
                                            </div>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0"/>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleClearApiCache}
                                        className="w-full p-3.5 rounded-2xl bg-slate-50/90 hover:bg-slate-100 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] border border-black/5 dark:border-white/10 flex items-center justify-between gap-3 text-left transition cursor-pointer active:scale-[0.99]"
                                    >
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div
                                                className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 shrink-0">
                                                <Database className="w-4 h-4"/>
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                                                    임시 캐시만 비우기
                                                </p>
                                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                                    노선·시간표·공지 캐시만 삭제하며 즐겨찾기·설정은 유지됩니다
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
                                    title="설정 및 데이터 초기화"
                                />
                                <div className="space-y-2">
                                    <button
                                        type="button"
                                        onClick={handleResetSettings}
                                        className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 text-xs font-black transition cursor-pointer active:scale-[0.99]"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5"/>
                                        <span>쿠키 환경설정만 기본값으로 초기화</span>
                                    </button>

                                    {!confirmClearData ? (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                triggerHaptic("light");
                                                setConfirmClearData(true);
                                            }}
                                            className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-xs font-black transition cursor-pointer active:scale-[0.99]"
                                        >
                                            <Trash2 className="w-3.5 h-3.5"/>
                                            <span>즐겨찾기·캐시·쿠키 전체 초기화</span>
                                        </button>
                                    ) : (
                                        <div
                                            className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 space-y-2.5">
                                            <p className="text-xs font-bold text-rose-800 dark:text-rose-200 text-center">
                                                저장된 즐겨찾기, 최근 조회, 캐시, 설정이 모두 삭제됩니다. 계속할까요?
                                            </p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setConfirmClearData(false)}
                                                    className="py-2 px-3 rounded-xl bg-white dark:bg-white/10 text-slate-700 dark:text-slate-200 border border-black/10 dark:border-white/10 text-xs font-black cursor-pointer hover:bg-slate-100 dark:hover:bg-white/15 transition"
                                                >
                                                    취소
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleClearAllData}
                                                    className="py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-black shadow-xs cursor-pointer transition"
                                                >
                                                    전체 삭제
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </section>

                            <section className="space-y-2.5">
                                <SettingsSectionHeader
                                    icon={<Info className="w-3.5 h-3.5 text-slate-400"/>}
                                    title="앱 정보 및 법적 안내"
                                    right={
                                        <span
                                            className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500">
                                            wBus v{APP_VERSION}
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
                                        <span>이용약관</span>
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
                                        <span>개인정보처리방침</span>
                                    </Link>
                                </div>
                            </section>
                        </>
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
