"use client";

import React, {useCallback, useState, useSyncExternalStore} from "react";
import {useTheme} from "next-themes";
import {
    Calendar,
    CheckCircle2,
    ChevronRight,
    Compass,
    Cookie,
    GraduationCap,
    MapIcon,
    Monitor,
    Moon,
    Radio,
    RotateCcw,
    Settings,
    Sparkles,
    Sun,
    Trash2,
    Vibrate,
} from "lucide-react";

import {useCityContext} from "@entities/city";
import {
    LIVE_POLLING_INTERVAL_OPTIONS,
    type LivePollingIntervalMs,
    SETTINGS_COOKIE_NAME,
} from "@shared/config/settingsCookie";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {Modal} from "@shared/ui";
import {triggerHaptic} from "@shared/utils/haptics";

import {ToggleSwitch} from "./ToggleSwitch";
import {YonseiSettingsModal} from "./YonseiSettingsModal";

export interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const emptySubscribe = () => () => {
};

const POLLING_INTERVAL_LABELS: Record<LivePollingIntervalMs, { label: string; hint: string }> = {
    5000: {label: "5초", hint: "빠른 갱신"},
    10000: {label: "10초", hint: "기본"},
    15000: {label: "15초", hint: "보통"},
    30000: {label: "30초", hint: "데이터 절약"},
};

export const SettingsModal: React.FC<SettingsModalProps> = ({isOpen, onClose}) => {
    const {
        settings,
        updateSettings,
        resetSettings,
        clearAllAppData,
        openOnboarding,
    } = useAppSettings();
    const {setIsAutoDetectEnabled} = useCityContext();
    const {theme, setTheme} = useTheme();
    const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

    const [confirmClearData, setConfirmClearData] = useState(false);
    const [statusNotice, setStatusNotice] = useState<string | null>(null);
    const [isYonseiModalOpen, setIsYonseiModalOpen] = useState(false);

    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
    if (isOpen !== prevIsOpen) {
        setPrevIsOpen(isOpen);
        if (isOpen) {
            setConfirmClearData(false);
            setStatusNotice(null);
            setIsYonseiModalOpen(false);
        }
    }

    const activeTheme = mounted ? (theme ?? "system") : "system";

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
        (nextTheme: "system" | "light" | "dark") => {
            triggerHaptic("selection");
            setTheme(nextTheme);
            if (typeof document !== "undefined") {
                if (nextTheme === "dark") {
                    document.documentElement.classList.add("dark");
                    document.documentElement.style.colorScheme = "dark";
                } else if (nextTheme === "light") {
                    document.documentElement.classList.remove("dark");
                    document.documentElement.style.colorScheme = "light";
                } else {
                    const prefersDark =
                        typeof window !== "undefined" &&
                        window.matchMedia("(prefers-color-scheme: dark)").matches;
                    document.documentElement.classList.toggle("dark", prefersDark);
                    document.documentElement.style.colorScheme = prefersDark ? "dark" : "light";
                }
            }
        },
        [setTheme]
    );

    const handleResetSettings = useCallback(() => {
        triggerHaptic("warning");
        resetSettings();
        setIsAutoDetectEnabled(true);
        setConfirmClearData(false);
        setStatusNotice("쿠키에 저장된 환경설정이 기본값으로 초기화되었습니다.");
    }, [resetSettings, setIsAutoDetectEnabled]);

    const handleClearAllData = useCallback(() => {
        if (!confirmClearData) {
            triggerHaptic("light");
            setConfirmClearData(true);
            return;
        }
        triggerHaptic("warning");
        clearAllAppData();
        setIsAutoDetectEnabled(true);
        setTheme("system");
        setConfirmClearData(false);
        setStatusNotice("설정 쿠키와 즐겨찾기·최근 조회·캐시가 모두 초기화되었습니다.");
    }, [confirmClearData, clearAllAppData, setIsAutoDetectEnabled, setTheme]);

    const modalIcon = (
        <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm shrink-0">
            <Settings className="w-5 h-5" />
        </div>
    );

    const modalFooter = (
        <>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold truncate">
                <Cookie className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span className="truncate">
                    설정값은 브라우저 쿠키(<code className="font-mono">{SETTINGS_COOKIE_NAME}</code>)에 자동 저장됩니다
                </span>
            </div>
            <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black cursor-pointer hover:opacity-90 transition shrink-0"
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
                subtitle="화면 테마, 지도 표시, 실시간 추적 및 기기 옵션을 관리합니다"
                icon={modalIcon}
                footer={modalFooter}
                maxWidth="lg"
                height="auto"
                modalId="settings"
                ariaLabel="wBus 환경설정 모달"
            >
                <div className="overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
                    {/* Status Feedback Banner */}
                    {statusNotice && (
                        <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>{statusNotice}</span>
                        </div>
                    )}

                    {/* Section 1: Appearance & Timetable Criteria */}
                    <section className="space-y-3">
                        <h3 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <Sparkles className="w-4 h-4 text-blue-500" />
                            <span>화면 및 시간표 설정</span>
                        </h3>

                        {/* 1-1. Theme Selection */}
                        <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 space-y-2.5">
                            <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                화면 테마
                            </p>
                            <div className="grid grid-cols-3 gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => handleThemeChange("system")}
                                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                                        activeTheme === "system"
                                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xs"
                                            : "bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10"
                                    }`}
                                >
                                    <Monitor className="w-3.5 h-3.5" />
                                    <span>시스템</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleThemeChange("light")}
                                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                                        activeTheme === "light"
                                            ? "bg-amber-500 text-white border-transparent shadow-xs"
                                            : "bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10"
                                    }`}
                                >
                                    <Sun className="w-3.5 h-3.5" />
                                    <span>라이트</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleThemeChange("dark")}
                                    className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                                        activeTheme === "dark"
                                            ? "bg-blue-600 text-white border-transparent shadow-xs"
                                            : "bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10"
                                    }`}
                                >
                                    <Moon className="w-3.5 h-3.5" />
                                    <span>다크</span>
                                </button>
                            </div>
                        </div>

                        {/* 1-2. Default Day Mode */}
                        <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 space-y-2.5">
                            <div className="flex items-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                    시간표 기본 운행 요일
                                </p>
                            </div>
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
                                                : "bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10"
                                        }`}
                                    >
                                        {mode.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* Section 2: Live Tracking & Map Display */}
                    <section className="space-y-3">
                        <h3 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <MapIcon className="w-4 h-4 text-sky-500" />
                            <span>실시간 추적 및 지도 표시</span>
                        </h3>

                        {/* 2-1. Live Bus Polling Interval */}
                        <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 space-y-2.5">
                            <div className="flex items-start gap-2">
                                <Radio className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                        실시간 버스 위치 갱신 주기
                                    </p>
                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                        짧을수록 위치가 빠르게 반영되고, 길수록 배터리·데이터를 절약합니다
                                    </p>
                                </div>
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
                        </div>

                        {/* 2-2. Smooth Bus Animation */}
                        <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                    버스 마커 부드러운 이동
                                </p>
                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                    노선 경로를 따라 버스가 부드럽게 주행하도록 보간 애니메이션을 적용합니다
                                </p>
                            </div>
                            <ToggleSwitch
                                checked={settings.smoothBusAnimation}
                                onChange={(next) => {
                                    triggerHaptic("selection");
                                    updateSettings({smoothBusAnimation: next});
                                }}
                                ariaLabel="버스 마커 부드러운 이동 전환"
                            />
                        </div>

                        {/* 2-3. Show Nearby Stops */}
                        <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                    지도 주변 정류장 표시
                                </p>
                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                    지도를 확대했을 때 선택한 노선 외 주변 일반 정류장도 함께 표시합니다
                                </p>
                            </div>
                            <ToggleSwitch
                                checked={settings.showNearbyStops}
                                onChange={(next) => {
                                    triggerHaptic("selection");
                                    updateSettings({showNearbyStops: next});
                                }}
                                ariaLabel="지도 주변 정류장 표시 전환"
                            />
                        </div>

                        {/* 2-4. Show Stop Labels */}
                        <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                    지도 정류장 이름 라벨 표시
                                </p>
                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                    확대 시 정류장 핀 옆에 정류장 이름을 표시합니다 (끄면 지도가 더 간결해집니다)
                                </p>
                            </div>
                            <ToggleSwitch
                                checked={settings.showStopLabels}
                                onChange={(next) => {
                                    triggerHaptic("selection");
                                    updateSettings({showStopLabels: next});
                                }}
                                ariaLabel="지도 정류장 이름 라벨 표시 전환"
                            />
                        </div>
                    </section>

                    {/* Section 3: Region & Device Convenience */}
                    <section className="space-y-3">
                        <h3 className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            <Compass className="w-4 h-4 text-emerald-500" />
                            <span>지역 및 기기 편의 설정</span>
                        </h3>

                        <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                    지도 이동 시 지역 자동 감지
                                </p>
                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                    지도를 다른 시·군으로 이동하면 해당 지역 전환 알림을 표시합니다
                                </p>
                            </div>
                            <ToggleSwitch
                                checked={settings.autoDetectCity}
                                onChange={handleToggleAutoDetect}
                                ariaLabel="지도 이동 시 지역 자동 감지 전환"
                            />
                        </div>

                        <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 flex items-center justify-between gap-3">
                            <div className="flex items-start gap-2 min-w-0">
                                <Vibrate className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                                <div className="min-w-0">
                                    <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                        모바일 터치 진동 (햅틱 피드백)
                                    </p>
                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                        지원 기기에서 버튼 조작 시 짧은 진동 피드백을 제공합니다
                                    </p>
                                </div>
                            </div>
                            <ToggleSwitch
                                checked={settings.hapticEnabled}
                                onChange={handleToggleHaptic}
                                ariaLabel="모바일 터치 진동 피드백 전환"
                            />
                        </div>
                    </section>

                    {/* Section 4: Specialized Campus Pill & Data Management */}
                    <section className="space-y-3 pt-2 border-t border-black/5 dark:border-white/5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-500">
                                캠퍼스 · 특화 허브 설정
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic("light");
                                    setIsYonseiModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#003876]/10 hover:bg-[#003876]/15 dark:bg-blue-500/15 dark:hover:bg-blue-500/25 border border-[#003876]/20 dark:border-blue-400/25 text-[#003876] dark:text-blue-300 text-xs font-black transition cursor-pointer active:scale-95"
                            >
                                <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                                <span>연세대 미래캠퍼스 설정</span>
                                <ChevronRight className="w-3.5 h-3.5 opacity-75 shrink-0" />
                            </button>
                        </div>

                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic("light");
                                onClose();
                                openOnboarding();
                            }}
                            className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 text-xs font-black transition cursor-pointer active:scale-[0.99]"
                        >
                            <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                            <span>온보딩 가이드 다시 보기</span>
                        </button>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={handleResetSettings}
                                className="flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/10 dark:hover:bg-white/15 text-slate-800 dark:text-slate-200 text-xs font-black transition cursor-pointer active:scale-95"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>쿠키 설정만 초기화</span>
                            </button>

                            <button
                                type="button"
                                onClick={handleClearAllData}
                                className={`flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-black transition cursor-pointer active:scale-95 ${
                                    confirmClearData
                                        ? "bg-rose-600 hover:bg-rose-700 text-white shadow-sm"
                                        : "bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30"
                                }`}
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>
                                    {confirmClearData
                                        ? "한 번 더 누르면 전체 삭제됩니다"
                                        : "즐겨찾기·캐시·쿠키 전체 초기화"}
                                </span>
                            </button>
                        </div>
                    </section>
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
