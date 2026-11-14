"use client";

import React from "react";
import Link from "next/link";
import {ChevronRight, Database, FileText, Info, RotateCcw, ShieldCheck, Sparkles, Trash2} from "lucide-react";
import {markModalNavigating} from "@shared/ui";
import {triggerHaptic} from "@shared/utils/haptics";
import {SettingsSectionHeader} from "../SettingsPrimitives";

interface DataSettingsTabProps {
    appVersion: string;
    confirmClearData: boolean;
    onSetConfirmClearData: (confirm: boolean) => void;
    onClose: () => void;
    onOpenOnboarding: () => void;
    onClearApiCache: () => void;
    onResetSettings: () => void;
    onClearAllData: () => void;
}

export const DataSettingsTab: React.FC<DataSettingsTabProps> = ({
    appVersion,
    confirmClearData,
    onSetConfirmClearData,
    onClose,
    onOpenOnboarding,
    onClearApiCache,
    onResetSettings,
    onClearAllData,
}) => (
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
                        onOpenOnboarding();
                    }}
                    className="w-full p-3.5 rounded-2xl bg-slate-50/90 hover:bg-slate-100 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] border border-black/5 dark:border-white/10 flex items-center justify-between gap-3 text-left transition cursor-pointer active:scale-[0.99]"
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-300 shrink-0">
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
                    onClick={onClearApiCache}
                    className="w-full p-3.5 rounded-2xl bg-slate-50/90 hover:bg-slate-100 dark:bg-white/[0.03] dark:hover:bg-white/[0.06] border border-black/5 dark:border-white/10 flex items-center justify-between gap-3 text-left transition cursor-pointer active:scale-[0.99]"
                >
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 shrink-0">
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
                    onClick={onResetSettings}
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
                            onSetConfirmClearData(true);
                        }}
                        className="w-full flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-500/30 text-xs font-black transition cursor-pointer active:scale-[0.99]"
                    >
                        <Trash2 className="w-3.5 h-3.5"/>
                        <span>즐겨찾기·캐시·쿠키 전체 초기화</span>
                    </button>
                ) : (
                    <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 space-y-2.5">
                        <p className="text-xs font-bold text-rose-800 dark:text-rose-200 text-center">
                            저장된 즐겨찾기, 최근 조회, 캐시, 설정이 모두 삭제됩니다. 계속할까요?
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => onSetConfirmClearData(false)}
                                className="py-2 px-3 rounded-xl bg-white dark:bg-white/10 text-slate-700 dark:text-slate-200 border border-black/10 dark:border-white/10 text-xs font-black cursor-pointer hover:bg-slate-100 dark:hover:bg-white/15 transition"
                            >
                                취소
                            </button>
                            <button
                                type="button"
                                onClick={onClearAllData}
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
                    <span className="text-[11px] font-mono font-bold text-slate-400 dark:text-slate-500">
                        wBus v{appVersion}
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
);
