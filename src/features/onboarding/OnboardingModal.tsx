"use client";

import React, {useCallback, useState, useSyncExternalStore} from "react";
import Link from "next/link";
import {useTheme} from "next-themes";
import {
    ArrowLeft,
    ArrowRight,
    Bus,
    Check,
    Clock,
    Compass,
    ExternalLink,
    GraduationCap,
    MapIcon,
    MapPin,
    Monitor,
    Moon,
    Settings,
    Sparkles,
    Sun,
} from "lucide-react";

import {NATIONWIDE_CITIES, useCityContext} from "@entities/city";
import {ToggleSwitch} from "@features/settings/ToggleSwitch";
import {buildPageHref, SPECIAL_PAGE_IDS} from "@shared/config/pages";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {applyThemePreference, Modal, type ThemePreference} from "@shared/ui";
import {triggerHaptic} from "@shared/utils/haptics";

const TOTAL_STEPS = 3;

const STEP_META = [
    {
        title: "wBus에 오신 것을 환영합니다!",
        subtitle: "실시간 버스 위치부터 시간표·캠퍼스 셔틀까지 한눈에 확인하세요",
    },
    {
        title: "나에게 맞게 빠르게 설정해요",
        subtitle: "자주 쓰는 화면과 테마를 고르면 바로 적용됩니다 (나중에 변경 가능)",
    },
    {
        title: "이제 출발할 준비가 되었어요",
        subtitle: "wBus를 200% 활용하는 간단한 팁을 확인하고 시작해 보세요",
    },
] as const;

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
        <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-[#003876] to-blue-600 text-white shadow-sm shrink-0">
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
                className="px-2.5 py-1 rounded-xl text-[11px] font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
            >
                건너뛰기
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
                        <span>이전</span>
                    </button>
                )}

                <div className="flex items-center gap-1.5" role="group" aria-label="온보딩 단계">
                    {Array.from({length: TOTAL_STEPS}).map((_, idx) => (
                        <button
                            key={idx}
                            type="button"
                            onClick={() => {
                                triggerHaptic("selection");
                                setStep(idx);
                            }}
                            aria-label={`${idx + 1}단계로 이동`}
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
                        <span>다음</span>
                        <ArrowRight className="w-3.5 h-3.5"/>
                    </button>
                ) : (
                    <>
                        <Link
                            href={buildPageHref(SPECIAL_PAGE_IDS.YONSEI_MIRAE)}
                            onClick={() => {
                                triggerHaptic("light");
                                closeOnboarding();
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold text-[#003876] dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition"
                        >
                            <span>연세대 허브</span>
                            <ExternalLink className="w-3.5 h-3.5"/>
                        </Link>
                        <button
                            type="button"
                            onClick={handleComplete}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#003876] dark:bg-blue-600 text-white text-xs font-black shadow-sm hover:opacity-95 transition cursor-pointer active:scale-95"
                        >
                            <Check className="w-3.5 h-3.5"/>
                            <span>wBus 시작하기</span>
                        </button>
                    </>
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
            ariaLabel="wBus 시작하기 온보딩 가이드"
        >
            <div className="overflow-y-auto p-4 sm:p-6 space-y-3 custom-scrollbar">
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
                                    전국 {NATIONWIDE_CITIES.length}개 시·군 실시간 버스 지도 &amp; 도착정보
                                </h3>
                                <p className="text-[11px] sm:text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                                    초 단위 부드러운 버스 이동 애니메이션, 경유지 필터, 정류장별 실시간 도착 예정 정보와 카카오 로드뷰 연동을 제공합니다.
                                </p>
                            </div>
                        </div>

                        <div
                            className="p-4 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 flex items-start gap-3.5">
                            <div
                                className="flex items-center justify-center w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                                <Clock className="w-5 h-5"/>
                            </div>
                            <div className="min-w-0 space-y-1">
                                <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                    원주시 시내버스 상세 시간표 &amp; 공지사항
                                </h3>
                                <p className="text-[11px] sm:text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                                    기점·종점 출발 카운트다운, 평일/휴일·방학 전체 회차 시간표 검색과 CSV 내보내기, 교통정보센터 공지사항을 한곳에서 확인합니다.
                                </p>
                            </div>
                        </div>

                        <div
                            className="p-4 rounded-2xl bg-[#003876]/[0.05] dark:bg-blue-500/10 border border-[#003876]/15 dark:border-blue-400/20 flex items-start gap-3.5">
                            <div
                                className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[#003876] text-white shrink-0">
                                <GraduationCap className="w-5 h-5"/>
                            </div>
                            <div className="min-w-0 space-y-1">
                                <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                    연세대 미래캠퍼스 등·하교 맞춤 허브
                                </h3>
                                <p className="text-[11px] sm:text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                                    교내 무료 셔틀과 30·34·34-1번 시내버스의 다음 출발 시각 및 실시간 위치를 시간대에 맞춰 바로 안내합니다.
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 2: Interactive Personalization */}
                {step === 1 && (
                    <div className="space-y-3.5 animate-fadeIn">
                        {/* Default Start Page */}
                        <div
                            className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 space-y-2.5">
                            <div>
                                <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                                    주로 사용하는 시작 화면
                                </p>
                                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                    앱을 열었을 때 가장 먼저 보여드릴 화면을 선택하세요
                                </p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic("selection");
                                        updateSettings({defaultStartPage: "map"});
                                    }}
                                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer active:scale-[0.98] ${
                                        settings.defaultStartPage === "map"
                                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-sm"
                                            : "bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 border-black/10 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10"
                                    }`}
                                >
                                    <MapIcon className="w-4 h-4 shrink-0"/>
                                    <div className="min-w-0">
                                        <p className="text-xs font-black truncate">실시간 버스 지도</p>
                                        <p
                                            className={`text-[10px] truncate ${
                                                settings.defaultStartPage === "map"
                                                    ? "text-white/75 dark:text-slate-600"
                                                    : "text-slate-400"
                                            }`}
                                        >
                                            전국 시내버스 지도
                                        </p>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        triggerHaptic("selection");
                                        updateSettings({defaultStartPage: "yonsei", showYonseiFeatures: true});
                                    }}
                                    className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all cursor-pointer active:scale-[0.98] ${
                                        settings.defaultStartPage === "yonsei"
                                            ? "bg-[#003876] text-white border-transparent shadow-sm"
                                            : "bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 border-black/10 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10"
                                    }`}
                                >
                                    <GraduationCap className="w-4 h-4 shrink-0"/>
                                    <div className="min-w-0">
                                        <p className="text-xs font-black truncate">연세대 미래캠퍼스</p>
                                        <p
                                            className={`text-[10px] truncate ${
                                                settings.defaultStartPage === "yonsei"
                                                    ? "text-sky-100"
                                                    : "text-slate-400"
                                            }`}
                                        >
                                            셔틀·30·34·34-1 허브
                                        </p>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Theme Selection */}
                        <div
                            className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 space-y-2.5">
                            <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                                화면 테마
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
                                    <span>시스템</span>
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
                                    <span>라이트</span>
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
                                    <span>다크</span>
                                </button>
                            </div>
                        </div>

                        {/* Quick Toggles */}
                        <div
                            className="rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 divide-y divide-black/5 dark:divide-white/[0.06]">
                            <div className="p-3.5 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                                        지도 이동 시 지역 자동 감지
                                    </p>
                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                        다른 시·군으로 지도를 옮기면 지역 전환 알림을 띄웁니다
                                    </p>
                                </div>
                                <ToggleSwitch
                                    checked={settings.autoDetectCity}
                                    onChange={(next) => {
                                        triggerHaptic("selection");
                                        updateSettings({autoDetectCity: next});
                                        setIsAutoDetectEnabled(next);
                                    }}
                                    ariaLabel="지도 이동 시 지역 자동 감지 전환"
                                />
                            </div>

                            <div className="p-3.5 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
                                        큰 글자 모드
                                    </p>
                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                        앱 전체 텍스트 크기를 한 단계 크게 표시합니다
                                    </p>
                                </div>
                                <ToggleSwitch
                                    checked={settings.fontScale === "large"}
                                    onChange={(next) => {
                                        triggerHaptic("selection");
                                        updateSettings({fontScale: next ? "large" : "normal"});
                                    }}
                                    ariaLabel="큰 글자 모드 전환"
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
                                선택된 설정
                            </span>
                            <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                                {settings.defaultStartPage === "yonsei" ? "연세대 허브" : "실시간 지도"} ·{" "}
                                {activeTheme === "system" ? "시스템 테마" : activeTheme === "light" ? "라이트" : "다크"}
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
                                        하단 플로팅 바로 빠른 전환
                                    </p>
                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                                        지역 선택, 노선 검색, 운행 중인 버스 목록을 한 손으로 간편하게 열고 닫을 수 있습니다.
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
                                        정류장 &amp; 기점·종점 핀 활용하기
                                    </p>
                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                                        정류장 마커를 누르면 실시간 도착 예정과 로드뷰를, 기점·종점 핀을 누르면 다음 출발 시각을 바로 확인합니다.
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
                                        세부 옵션은 환경설정에서 언제든 변경
                                    </p>
                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                                        위치 갱신 주기(5초~30초), 차량번호 표시, 모션 줄이기 등 모든 옵션은 하단 ⚙️ 환경설정에서 조절할 수 있습니다.
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
