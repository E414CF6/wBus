"use client";

import React from "react";
import Link from "next/link";
import {ExternalLink, GraduationCap} from "lucide-react";

import {YONSEI_MIRAE_WIKI_SLUG} from "@entities/wiki";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {markModalNavigating, Modal} from "@shared/ui";
import {triggerHaptic} from "@shared/utils/haptics";

import {SettingsBlock, SettingsGroup, SettingsToggleRow} from "./SettingsPrimitives";

export interface YonseiSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCloseParent?: () => void;
}

/**
 * Dedicated sub-modal for Yonsei University Mirae Campus specific options,
 * accessed from SettingsModal.
 */
export const YonseiSettingsModal: React.FC<YonseiSettingsModalProps> = ({
                                                                            isOpen,
                                                                            onClose,
                                                                            onCloseParent,
                                                                        }) => {
    const {settings, updateSettings} = useAppSettings();

    const modalIcon = (
        <div
            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-[#003876] text-white shadow-sm shrink-0">
            <GraduationCap className="w-5 h-5"/>
        </div>
    );

    const modalFooter = (
        <>
            <Link
                href={`/wiki/${encodeURIComponent(YONSEI_MIRAE_WIKI_SLUG)}`}
                onClick={() => {
                    markModalNavigating();
                    onClose();
                    onCloseParent?.();
                }}
                className="inline-flex items-center gap-1.5 text-xs font-black text-[#003876] dark:text-blue-300 hover:underline"
            >
                <span>연세대 위키 열기</span>
                <ExternalLink className="w-3.5 h-3.5"/>
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
            modalId="yonsei-settings"
            ariaLabel="연세대 미래캠퍼스 설정 모달"
        >
            <div className="overflow-y-auto p-4 sm:p-5 space-y-3.5 custom-scrollbar">
                <SettingsGroup>
                    {/* 1. Yonsei Default Direction */}
                    <SettingsBlock>
                        <div>
                            <p className="text-xs sm:text-[13px] font-black text-slate-900 dark:text-white">
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
                    </SettingsBlock>

                    {/* 3. Show Yonsei Features on Map */}
                    <SettingsToggleRow
                        title="지도 화면 내 연세대 기능 표시"
                        description="원주 지도 상단바와 노선 선택 모달에 연세대 캠퍼스 위키 바로가기 및 배지를 표시합니다"
                        checked={settings.showYonseiFeatures}
                        onChange={(next) => {
                            triggerHaptic("selection");
                            updateSettings({showYonseiFeatures: next});
                        }}
                        ariaLabel="지도 화면 내 연세대 기능 표시 전환"
                    />
                </SettingsGroup>
            </div>
        </Modal>
    );
};
