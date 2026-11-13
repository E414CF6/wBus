"use client";

import React, {useCallback} from "react";
import Link from "next/link";
import {Bus, Clock, ExternalLink, Sparkles} from "lucide-react";

import {buildPageHref, SPECIAL_PAGE_IDS} from "@shared/config/pages";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {Modal} from "@shared/ui";
import {triggerHaptic} from "@shared/utils/haptics";

export const OnboardingModal: React.FC = () => {
    const {isOnboardingOpen, closeOnboarding} = useAppSettings();

    const handleComplete = useCallback(() => {
        triggerHaptic("success");
        closeOnboarding();
    }, [closeOnboarding]);

    const modalIcon = (
        <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-br from-[#003876] to-blue-600 text-white shadow-sm shrink-0">
            <Sparkles className="w-5 h-5"/>
        </div>
    );

    const modalFooter = (
        <>
            <Link
                href={buildPageHref(SPECIAL_PAGE_IDS.YONSEI_MIRAE)}
                onClick={() => {
                    triggerHaptic("light");
                    closeOnboarding();
                }}
                className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-xs font-bold text-[#003876] dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition"
            >
                <span>연세대 미래캠퍼스</span>
                <ExternalLink className="w-3.5 h-3.5"/>
            </Link>
            <button
                type="button"
                onClick={handleComplete}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black shadow-sm hover:opacity-90 transition cursor-pointer active:scale-95"
            >
                <span>완료</span>
            </button>
        </>
    );

    return (
        <Modal
            isOpen={isOnboardingOpen}
            onClose={closeOnboarding}
            enableHistory={false}
            title="wBus에 오신 것을 환영합니다!"
            subtitle="실시간 버스 위치부터 원주시 시내버스 시간표·공지사항까지 한눈에 확인하세요"
            icon={modalIcon}
            footer={modalFooter}
            maxWidth="lg"
            height="auto"
            modalId="onboarding"
            ariaLabel="wBus 시작하기 온보딩 가이드"
        >
            <div className="overflow-y-auto p-4 sm:p-6 space-y-3 custom-scrollbar">
                {/* Feature 1: Nationwide Real-Time Map */}
                <div
                    className="p-4 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 flex items-start gap-3.5">
                    <div
                        className="flex items-center justify-center w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 shrink-0">
                        <Bus className="w-5 h-5"/>
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
                            기점·종점 출발 카운트다운, 평일/휴일·방학 전체 회차 시간표 검색과 CSV 내보내기, 원주시 교통정보센터 공지사항을 한곳에서 확인합니다.
                        </p>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default OnboardingModal;
