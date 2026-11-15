"use client";

import React from "react";
import {AlertTriangle, Check, RefreshCw, Save, ShieldAlert, User, X} from "lucide-react";

export interface WikiEditMetaBarProps {
    nickname: string;
    onNicknameChange: (val: string) => void;
    summary: string;
    onSummaryChange: (val: string) => void;
    honeypot: string;
    onHoneypotChange: (val: string) => void;
    isSaving: boolean;
    errorMessage?: string | null;
    conflictVersion?: number | null;
    onReloadLatest?: () => void;
    onForceOverwrite?: () => void;
    onSave: () => void;
    onCancel: () => void;
    saveLabel?: string;
    isProtected?: boolean;
}

export const WikiEditMetaBar: React.FC<WikiEditMetaBarProps> = ({
                                                                    nickname,
                                                                    onNicknameChange,
                                                                    summary,
                                                                    onSummaryChange,
                                                                    honeypot,
                                                                    onHoneypotChange,
                                                                    isSaving,
                                                                    errorMessage,
                                                                    conflictVersion,
                                                                    onReloadLatest,
                                                                    onForceOverwrite,
                                                                    onSave,
                                                                    onCancel,
                                                                    saveLabel = "변경사항 게시하기",
                                                                    isProtected = false,
                                                                }) => {
    return (
        <div
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/95 p-4 sm:p-5 shadow-sm space-y-4">
            {isProtected && (
                <div
                    className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-xs font-semibold">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"/>
                    <span>이 문서는 현재 보호 상태입니다. 관리자만 수정할 수 있습니다.</span>
                </div>
            )}

            {conflictVersion && (
                <div
                    className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700 space-y-2.5">
                    <div className="flex items-start gap-2 text-amber-900 dark:text-amber-100 text-xs font-bold">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400"/>
                        <div>
                            편집 충돌이 발생했습니다 (서버 최신 버전: <strong>v{conflictVersion}</strong>).
                            다른 사용자가 먼저 문서를 수정했습니다.
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {onReloadLatest && (
                            <button
                                type="button"
                                onClick={onReloadLatest}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-xs font-black text-amber-900 dark:text-amber-100 hover:bg-amber-100/60 transition cursor-pointer"
                            >
                                <RefreshCw className="w-3.5 h-3.5"/>
                                최신본 불러오기 (내 편집 초기화)
                            </button>
                        )}
                        {onForceOverwrite && (
                            <button
                                type="button"
                                onClick={onForceOverwrite}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-black transition cursor-pointer"
                            >
                                <Check className="w-3.5 h-3.5"/>
                                내 내용으로 v{conflictVersion} 위에 덮어쓰기
                            </button>
                        )}
                    </div>
                </div>
            )}

            {errorMessage && !conflictVersion && (
                <div
                    className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-200 text-xs font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0"/>
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* Honeypot anti-spam field */}
            <div className="sr-only" aria-hidden="true">
                <label htmlFor="wiki-website-honeypot">Website</label>
                <input
                    id="wiki-website-honeypot"
                    type="text"
                    name="website"
                    tabIndex={-1}
                    autoComplete="off"
                    value={honeypot}
                    onChange={(e) => onHoneypotChange(e.target.value)}
                />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                    <label
                        htmlFor="wiki-editor-nickname"
                        className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1 flex items-center gap-1"
                    >
                        <User className="w-3 h-3"/>
                        편집자 닉네임 (선택)
                    </label>
                    <input
                        id="wiki-editor-nickname"
                        name="nickname"
                        type="text"
                        value={nickname}
                        onChange={(e) => onNicknameChange(e.target.value)}
                        maxLength={24}
                        placeholder="미입력 시 익명 버스러"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    />
                </div>
                <div className="sm:col-span-2">
                    <label
                        htmlFor="wiki-editor-summary"
                        className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1"
                    >
                        편집 요약 (어떤 내용을 고쳤나요?)
                    </label>
                    <input
                        id="wiki-editor-summary"
                        name="summary"
                        type="text"
                        value={summary}
                        onChange={(e) => onSummaryChange(e.target.value)}
                        maxLength={160}
                        placeholder="예: 18:15 셔틀 시간 수정 및 만차 대비 팁 추가"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    />
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    모든 편집 내용은 개정 이력에 기록되며, 잘못된 수정은 언제든 이전 버전으로 복구할 수 있습니다.
                </p>
                <div className="flex items-center gap-2 ml-auto">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-extrabold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
                    >
                        <X className="w-3.5 h-3.5"/>
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#003876] hover:bg-[#00295a] dark:bg-sky-600 dark:hover:bg-sky-500 text-white text-xs font-black shadow-sm transition cursor-pointer disabled:opacity-50"
                    >
                        <Save className="w-3.5 h-3.5"/>
                        {isSaving ? "저장 중..." : saveLabel}
                    </button>
                </div>
            </div>
        </div>
    );
};
