"use client";

import React from "react";
import Link from "next/link";
import {ExternalLink, GraduationCap, MapIcon} from "lucide-react";

import {buildPageHref, SPECIAL_PAGE_IDS} from "@shared/config/pages";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {Modal} from "@shared/ui";
import {triggerHaptic} from "@shared/utils/haptics";

import {ToggleSwitch} from "./ToggleSwitch";

export interface YonseiSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCloseParent?: () => void;
}

/**
 * Dedicated sub-modal for Yonsei University Mirae Campus specific options,
 * accessed via a compact pill button from the generic SettingsModal.
 */
export const YonseiSettingsModal: React.FC<YonseiSettingsModalProps> = ({
    isOpen,
    onClose,
    onCloseParent,
}) => {
    const {settings, updateSettings} = useAppSettings();

    const modalIcon = (
        <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#003876] text-white shadow-sm shrink-0">
            <GraduationCap className="w-5 h-5" />
        </div>
    );

    const modalFooter = (
        <>
            <Link
                href={buildPageHref(SPECIAL_PAGE_IDS.YONSEI_MIRAE)}
                onClick={() => {
                    onClose();
                    onCloseParent?.();
                }}
                className="inline-flex items-center gap-1.5 text-xs font-black text-[#003876] dark:text-blue-300 hover:underline"
            >
                <span>연세대 화면 열기</span>
                <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 rounded-xl bg-[#003876] dark:bg-blue-600 text-white text-xs font-black cursor-pointer hover:opacity-90 transition shrink-0"
            >
                확인
            </button>
        </>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="연세대 미래캠퍼스 설정"
            subtitle="캠퍼스 허브 시작 화면, 기본 방향 및 지도 연동 옵션을 관리합니다"
            icon={modalIcon}
            footer={modalFooter}
            maxWidth="md"
            height="auto"
            zIndex="z-[110]"
            enableHistory={false}
            ariaLabel="연세대 미래캠퍼스 설정 모달"
        >
            <div className="overflow-y-auto p-4 sm:p-5 space-y-3.5 custom-scrollbar">
                {/* 1. Default Start Page */}
                <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 space-y-2.5">
                    <div>
                        <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                            앱 첫 접속 시 기본 시작 화면
                        </p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                            브라우저로 <code className="font-mono">/</code>에 접속했을 때 자동으로 열릴 화면을 선택합니다
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            type="button"
                            onClick={() => {
                                triggerHaptic("selection");
                                updateSettings({defaultStartPage: "map"});
                            }}
                            className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all cursor-pointer active:scale-[0.98] ${
                                settings.defaultStartPage === "map"
                                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-sm"
                                    : "bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 border-black/10 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10"
                            }`}
                        >
                            <MapIcon className="w-4 h-4 shrink-0" />
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
                                updateSettings({defaultStartPage: "yonsei"});
                            }}
                            className={`flex items-center gap-2 p-3 rounded-xl border text-left transition-all cursor-pointer active:scale-[0.98] ${
                                settings.defaultStartPage === "yonsei"
                                    ? "bg-[#003876] text-white border-transparent shadow-sm"
                                    : "bg-white dark:bg-white/5 text-slate-700 dark:text-slate-200 border-black/10 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10"
                            }`}
                        >
                            <GraduationCap className="w-4 h-4 shrink-0" />
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

                {/* 2. Yonsei Default Direction */}
                <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 space-y-2.5">
                    <div>
                        <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                            연세대 화면 기본 등·하교 방향
                        </p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                            자동 선택 시 오전(12시 전)은 등교, 오후(12시 이후)는 하교 기준으로 열립니다
                        </p>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                        {(
                            [
                                {id: "AUTO", label: "시간대 자동"},
                                {id: "OUTBOUND", label: "하교 고정"},
                                {id: "INBOUND", label: "등교 고정"},
                            ] as const
                        ).map((opt) => (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                    triggerHaptic("selection");
                                    updateSettings({yonseiDefaultDirection: opt.id});
                                }}
                                className={`py-2 px-2.5 rounded-xl text-xs font-black border transition cursor-pointer ${
                                    settings.yonseiDefaultDirection === opt.id
                                        ? "bg-[#003876] text-white border-transparent shadow-xs"
                                        : "bg-white dark:bg-white/5 text-slate-700 dark:text-slate-300 border-black/10 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10"
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 3. Show Yonsei Features on Map */}
                <div className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-black/5 dark:border-white/10 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                            지도 화면 내 연세대 기능 표시
                        </p>
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                            원주 지도 상단바·노선 모달 바로가기 버튼과 미래관 무료 셔틀 핀 마커를 표시합니다
                        </p>
                    </div>
                    <ToggleSwitch
                        checked={settings.showYonseiFeatures}
                        onChange={(next) => {
                            triggerHaptic("selection");
                            updateSettings({showYonseiFeatures: next});
                        }}
                        ariaLabel="지도 화면 내 연세대 기능 표시 전환"
                    />
                </div>
            </div>
        </Modal>
    );
};
