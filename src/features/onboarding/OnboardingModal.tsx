"use client";

import React, {useCallback, useState} from "react";
import {usePathname, useRouter} from "next/navigation";
import {
    ArrowLeft,
    ArrowRight,
    Bus,
    CheckCircle2,
    Clock,
    Compass,
    Cookie,
    GraduationCap,
    MapIcon,
    Navigation,
    Sparkles,
} from "lucide-react";

import {useCityContext} from "@entities/city";
import {
    buildPageHref,
    resolveSpecialPageFromSearch,
    SPECIAL_PAGE_IDS,
} from "@shared/config/pages";
import {
    type DefaultStartPage,
    SETTINGS_COOKIE_NAME,
    type YonseiDefaultDirection,
} from "@shared/config/settingsCookie";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {Modal} from "@shared/ui";
import {triggerHaptic} from "@shared/utils/haptics";

export const OnboardingModal: React.FC = () => {
    const router = useRouter();
    const pathname = usePathname();
    const {
        settings,
        updateSettings,
        isOnboardingOpen,
        closeOnboarding,
    } = useAppSettings();
    const {setCity} = useCityContext();

    const [step, setStep] = useState<1 | 2>(1);
    const [selectedMode, setSelectedMode] = useState<DefaultStartPage>(settings.defaultStartPage);
    const [showYonseiFeatures, setShowYonseiFeatures] = useState<boolean>(
        settings.showYonseiFeatures
    );
    const [yonseiDirection, setYonseiDirection] = useState<YonseiDefaultDirection>(
        settings.yonseiDefaultDirection
    );

    // Render-phase state sync when modal opens (avoids setState in useEffect)
    const [prevIsOpen, setPrevIsOpen] = useState(isOnboardingOpen);
    if (isOnboardingOpen !== prevIsOpen) {
        setPrevIsOpen(isOnboardingOpen);
        if (isOnboardingOpen) {
            setStep(1);
            setSelectedMode(settings.defaultStartPage);
            setShowYonseiFeatures(settings.showYonseiFeatures);
            setYonseiDirection(settings.yonseiDefaultDirection);
        }
    }

    const handleSkip = useCallback(() => {
        triggerHaptic("light");
        closeOnboarding();
    }, [closeOnboarding]);

    const handleNextStep = useCallback(() => {
        triggerHaptic("selection");
        setStep(2);
    }, []);

    const handlePrevStep = useCallback(() => {
        triggerHaptic("light");
        setStep(1);
    }, []);

    const handleComplete = useCallback(() => {
        triggerHaptic("success");
        updateSettings({
            defaultStartPage: selectedMode,
            showYonseiFeatures: selectedMode === "yonsei" ? true : showYonseiFeatures,
            yonseiDefaultDirection: yonseiDirection,
            hasCompletedOnboarding: true,
        });
        closeOnboarding();

        const currentSpecialPage =
            typeof window !== "undefined"
                ? resolveSpecialPageFromSearch(window.location.search)
                : null;
        const isOnYonseiPage =
            pathname === "/yonsei" || currentSpecialPage === SPECIAL_PAGE_IDS.YONSEI_MIRAE;

        if (selectedMode === "yonsei") {
            setCity("32020");
            if (currentSpecialPage !== SPECIAL_PAGE_IDS.YONSEI_MIRAE) {
                router.push(buildPageHref(SPECIAL_PAGE_IDS.YONSEI_MIRAE));
            }
        } else if (isOnYonseiPage) {
            router.push("/?cityCode=32020");
        }
    }, [
        selectedMode,
        showYonseiFeatures,
        yonseiDirection,
        updateSettings,
        closeOnboarding,
        setCity,
        pathname,
        router,
    ]);

    const modalIcon = (
        <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-[#003876] to-blue-600 text-white shadow-sm shrink-0">
            {step === 1 ? <Sparkles className="w-5 h-5" /> : <Compass className="w-5 h-5" />}
        </div>
    );

    const headerBadge = (
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider bg-blue-50 dark:bg-blue-500/15 text-[#003876] dark:text-blue-300 border border-blue-200/70 dark:border-blue-400/30">
            STEP {step} / 2
        </span>
    );

    const modalFooter = (
        <>
            {step === 1 ? (
                <>
                    <button
                        type="button"
                        onClick={handleSkip}
                        className="px-3 py-2 rounded-xl text-xs font-bold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
                    >
                        건너뛰기
                    </button>
                    <button
                        type="button"
                        onClick={handleNextStep}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black shadow-sm hover:opacity-90 transition cursor-pointer active:scale-95"
                    >
                        <span>다음: 시작 모드 선택</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                </>
            ) : (
                <>
                    <button
                        type="button"
                        onClick={handlePrevStep}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>이전</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleComplete}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-black shadow-sm hover:opacity-95 transition cursor-pointer active:scale-95 ${
                            selectedMode === "yonsei"
                                ? "bg-[#003876] dark:bg-blue-600"
                                : "bg-slate-900 dark:bg-blue-600"
                        }`}
                    >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>이 설정으로 시작하기</span>
                    </button>
                </>
            )}
        </>
    );

    return (
        <Modal
            isOpen={isOnboardingOpen}
            onClose={closeOnboarding}
            enableHistory={false}
            title={step === 1 ? "wBus에 오신 것을 환영합니다!" : "맞춤 시작 모드 선택"}
            subtitle={
                step === 1
                    ? "실시간 버스 위치부터 원주·연세대 미래캠퍼스 교통 허브까지 한눈에 확인하세요"
                    : "주로 이용하시는 화면을 선택하면 쿠키에 저장되어 다음 접속부터 바로 열립니다"
            }
            icon={modalIcon}
            headerBadge={headerBadge}
            footer={modalFooter}
            maxWidth="lg"
            height="auto"
            modalId="onboarding"
            ariaLabel="wBus 시작하기 온보딩 가이드"
        >
            <div className="overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
                {/* Step Progress Indicator Bar */}
                <div className="flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-[#003876] dark:bg-blue-500 transition-all" />
                    <div
                        className={`h-1.5 flex-1 rounded-full transition-all ${
                            step === 2
                                ? "bg-[#003876] dark:bg-blue-500"
                                : "bg-slate-200 dark:bg-white/10"
                        }`}
                    />
                </div>

                {step === 1 ? (
                    <div className="space-y-3">
                        {/* Feature 1: Nationwide Real-Time Map */}
                        <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 flex items-start gap-3.5">
                            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 shrink-0">
                                <Bus className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 space-y-1">
                                <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                    전국 139개 시·군 실시간 버스 지도 &amp; 도착정보
                                </h3>
                                <p className="text-[11px] sm:text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                                    초 단위 부드러운 버스 이동 애니메이션, 경유지(노선 종류) 필터, 정류장별 실시간 도착 예정 정보와 카카오 로드뷰 연동을 제공합니다.
                                </p>
                            </div>
                        </div>

                        {/* Feature 2: Wonju Detailed Timetables & Notices */}
                        <div className="p-4 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 flex items-start gap-3.5">
                            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 shrink-0">
                                <Clock className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 space-y-1">
                                <h3 className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                    원주시 시내버스 상세 시간표 &amp; 공지사항
                                </h3>
                                <p className="text-[11px] sm:text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                                    기점·종점 출발 카운트다운, 평일/휴일·방학 전체 회차 시간표 검색과 CSV 내보내기, 원주시 교통정보센터 공지사항을 한곳에서 확인합니다.
                                </p>
                            </div>
                        </div>

                        {/* Feature 3: Yonsei Mirae Campus Hub */}
                        <div className="p-4 rounded-2xl bg-[#003876]/[0.05] dark:bg-blue-950/30 border border-[#003876]/15 dark:border-blue-400/25 flex items-start gap-3.5">
                            <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-[#003876] text-white shrink-0">
                                <GraduationCap className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 space-y-1">
                                <h3 className="text-xs sm:text-sm font-black text-[#003876] dark:text-blue-300">
                                    연세대학교 미래캠퍼스 전용 교통 허브
                                </h3>
                                <p className="text-[11px] sm:text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                                    여주역·만종역·원주역·터미널 무료 셔틀버스 시간표와 승강장 위치 미니맵, 그리고 30·34·34-1번 등·하교 맞춤 출발 안내를 지원합니다.
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div>
                            <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                                주로 어떻게 이용하시나요?
                            </p>
                            <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                선택하신 모드가 <code className="font-mono">/</code> 접속 시 기본 시작 화면으로 설정됩니다
                            </p>
                        </div>

                        {/* 2 Mode Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Mode 1: General Real-time Map */}
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic("selection");
                                    setSelectedMode("map");
                                }}
                                className={`relative flex flex-col items-start gap-2.5 p-4 rounded-2xl border text-left transition-all cursor-pointer active:scale-[0.99] ${
                                    selectedMode === "map"
                                        ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-md ring-2 ring-slate-900/20 dark:ring-white/30"
                                        : "bg-slate-50/90 dark:bg-white/[0.03] text-slate-800 dark:text-slate-200 border-black/10 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10"
                                }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <div
                                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                            selectedMode === "map"
                                                ? "bg-white/15 dark:bg-slate-900/10"
                                                : "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300"
                                        }`}
                                    >
                                        <MapIcon className="w-4 h-4" />
                                    </div>
                                    {selectedMode === "map" && (
                                        <CheckCircle2 className="w-4 h-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs sm:text-sm font-black">일반 실시간 버스 지도</p>
                                    <p
                                        className={`text-[11px] mt-1 leading-relaxed ${
                                            selectedMode === "map"
                                                ? "text-white/80 dark:text-slate-600"
                                                : "text-slate-500 dark:text-slate-400"
                                        }`}
                                    >
                                        전국 시·군 실시간 버스 위치, 정류장 도착 예정 및 노선 시간표를 바로 엽니다.
                                    </p>
                                </div>
                            </button>

                            {/* Mode 2: Yonsei Mirae Campus Mode */}
                            <button
                                type="button"
                                onClick={() => {
                                    triggerHaptic("selection");
                                    setSelectedMode("yonsei");
                                    setShowYonseiFeatures(true);
                                }}
                                className={`relative flex flex-col items-start gap-2.5 p-4 rounded-2xl border text-left transition-all cursor-pointer active:scale-[0.99] ${
                                    selectedMode === "yonsei"
                                        ? "bg-[#003876] text-white border-transparent shadow-md ring-2 ring-[#003876]/30"
                                        : "bg-slate-50/90 dark:bg-white/[0.03] text-slate-800 dark:text-slate-200 border-black/10 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10"
                                }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <div
                                        className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                                            selectedMode === "yonsei"
                                                ? "bg-white/15"
                                                : "bg-[#003876]/10 dark:bg-blue-500/20 text-[#003876] dark:text-blue-300"
                                        }`}
                                    >
                                        <GraduationCap className="w-4 h-4" />
                                    </div>
                                    {selectedMode === "yonsei" && (
                                        <CheckCircle2 className="w-4 h-4 text-sky-300 shrink-0" />
                                    )}
                                </div>
                                <div>
                                    <p className="text-xs sm:text-sm font-black">연세대 미래캠퍼스 모드</p>
                                    <p
                                        className={`text-[11px] mt-1 leading-relaxed ${
                                            selectedMode === "yonsei"
                                                ? "text-sky-100/90"
                                                : "text-slate-500 dark:text-slate-400"
                                        }`}
                                    >
                                        무료 셔틀버스·30·34·34-1 등·하교 전용 허브 페이지로 바로 접속합니다.
                                    </p>
                                </div>
                            </button>
                        </div>

                        {/* Contextual Quick Preference based on Selected Mode */}
                        {selectedMode === "map" ? (
                            <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-xs font-black text-slate-900 dark:text-white">
                                        지도 화면에 연세대 바로가기·셔틀 핀 표시
                                    </p>
                                    <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                                        원주 지도 상단바와 노선 목록에서 연세대 허브를 빠르게 열 수 있습니다
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={showYonseiFeatures}
                                    aria-label="지도 화면에 연세대 기능 표시 전환"
                                    onClick={() => {
                                        triggerHaptic("selection");
                                        setShowYonseiFeatures((prev) => !prev);
                                    }}
                                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ${
                                        showYonseiFeatures
                                            ? "bg-[#003876] dark:bg-blue-500"
                                            : "bg-slate-300 dark:bg-white/15"
                                    }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition duration-200 ${
                                            showYonseiFeatures ? "translate-x-5" : "translate-x-0"
                                        }`}
                                    />
                                </button>
                            </div>
                        ) : (
                            <div className="p-3.5 rounded-2xl bg-[#003876]/[0.05] dark:bg-blue-950/30 border border-[#003876]/15 dark:border-blue-400/20 space-y-2.5">
                                <div className="flex items-center gap-1.5">
                                    <Navigation className="w-3.5 h-3.5 text-[#003876] dark:text-blue-300" />
                                    <p className="text-xs font-black text-slate-900 dark:text-white">
                                        연세대 화면 기본 등·하교 기준
                                    </p>
                                </div>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {(
                                        [
                                            {id: "AUTO", label: "시간대 자동"},
                                            {id: "OUTBOUND", label: "하교 우선"},
                                            {id: "INBOUND", label: "등교 우선"},
                                        ] as const
                                    ).map((opt) => (
                                        <button
                                            key={opt.id}
                                            type="button"
                                            onClick={() => {
                                                triggerHaptic("selection");
                                                setYonseiDirection(opt.id);
                                            }}
                                            className={`py-2 px-2.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                                                yonseiDirection === opt.id
                                                    ? "bg-[#003876] text-white border-transparent shadow-xs"
                                                    : "bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10"
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Cookie Persistence Notice */}
                        <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-500/20 text-[11px] font-semibold text-amber-800 dark:text-amber-200">
                            <Cookie className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span>
                                설정은 브라우저 쿠키(<code className="font-mono">{SETTINGS_COOKIE_NAME}</code>)에 저장되며, 하단 메뉴의 <strong>환경설정(⚙️)</strong>에서 언제든 변경하거나 가이드를 다시 볼 수 있습니다.
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};

export default OnboardingModal;
