"use client";

import React, {useState} from "react";
import {Bus, ExternalLink, Info, MapPin, Ticket, X} from "lucide-react";
import {createPortal} from "react-dom";

export const YONSEI_SHUTTLE_URL = "https://ysbusticket.yonsei.ac.kr/index.php?mid=m01&cmid=m10_02&lang=k&act=view&uid=1040&page=1";

interface YonseiShuttleCardProps {
    className?: string;
}

export const YonseiShuttleCard: React.FC<YonseiShuttleCardProps> = ({className = ""}) => {
    const [isModalOpen, setIsModalOpen] = useState(false);

    return (
        <>
            <div
                className={`backdrop-blur-2xl bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-slate-900/10 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-slate-900/40 rounded-3xl p-5 sm:p-6 border border-blue-500/20 shadow-sm relative overflow-hidden ${className}`}
            >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span
                                className="px-3 py-1 rounded-full text-xs font-black bg-[#003876] text-white shadow-xs flex items-center gap-1.5">
                                <Bus className="w-3.5 h-3.5"/>
                                <span>연세대학교 통학 · 셔틀버스</span>
                            </span>
                            <span
                                className="px-2.5 py-0.5 rounded-xl text-[11px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                원주·여주 셔틀 (무료)
                            </span>
                            <span
                                className="px-2.5 py-0.5 rounded-xl text-[11px] font-bold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                                서울 통학 (유료/예약제)
                            </span>
                        </div>

                        <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                            원주역 · 여주역 셔틀버스 & 서울 통학버스 안내
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300">
                            학기 중 원주역/여주역 무료 셔틀버스 및 서울 주요 지역 통학버스 예약 시스템 링크
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            type="button"
                            onClick={() => setIsModalOpen(true)}
                            className="px-4 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-slate-800 dark:text-white text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                        >
                            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400"/>
                            <span>상세 노선/안내</span>
                        </button>

                        <a
                            href={YONSEI_SHUTTLE_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-extrabold shadow-md shadow-blue-600/20 transition-all cursor-pointer flex items-center gap-1.5 active:scale-95"
                        >
                            <Ticket className="w-4 h-4"/>
                            <span>예약/공지 바로가기</span>
                            <ExternalLink className="w-3.5 h-3.5 ml-0.5 opacity-80"/>
                        </a>
                    </div>
                </div>
            </div>

            {/* Shuttle Modal */}
            {isModalOpen && (
                <YonseiShuttleModal onClose={() => setIsModalOpen(false)}/>
            )}
        </>
    );
};

interface YonseiShuttleModalProps {
    onClose: () => void;
}

export const YonseiShuttleModal: React.FC<YonseiShuttleModalProps> = ({onClose}) => {
    const [activeTab, setActiveTab] = useState<"FREE" | "SEOUL">("FREE");

    const modalContent = (
        <div
            className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-slate-950/60 dark:bg-black/80 backdrop-blur-lg animate-fadeIn pointer-events-auto"
            onClick={onClose}
        >
            <div
                className="w-full max-w-3xl max-h-[90vh] rounded-3xl border border-black/10 dark:border-white/10 shadow-2xl flex flex-col overflow-hidden bg-white dark:bg-[#121212] transition-colors duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Modal Header */}
                <div
                    className="p-5 sm:p-6 border-b border-black/5 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] flex items-start justify-between gap-4">
                    <div>
                        <div
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black bg-[#003876] text-white mb-2">
                            <Bus className="w-3.5 h-3.5"/>
                            <span>연세대학교 미래캠퍼스</span>
                        </div>
                        <h3 className="text-xl font-black text-slate-900 dark:text-white">
                            통학 · 셔틀버스 상세 안내
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer"
                    >
                        <X className="h-4 w-4"/>
                    </button>
                </div>

                {/* Tab Controls */}
                <div
                    className="p-4 border-b border-black/5 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.01] flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setActiveTab("FREE")}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                            activeTab === "FREE"
                                ? "bg-emerald-600 text-white shadow-md"
                                : "bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                    >
                        <MapPin className="w-4 h-4"/>
                        <span>원주역 · 여주역 셔틀 (무료)</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab("SEOUL")}
                        className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center justify-center gap-2 ${
                            activeTab === "SEOUL"
                                ? "bg-blue-600 text-white shadow-md"
                                : "bg-slate-100 dark:bg-white/[0.06] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                    >
                        <Ticket className="w-4 h-4"/>
                        <span>서울 통학버스 (유료/예약제)</span>
                    </button>
                </div>

                {/* Modal Body */}
                <div className="p-5 sm:p-6 flex-1 overflow-y-auto space-y-6 text-xs text-slate-700 dark:text-slate-300">
                    {activeTab === "FREE" ? (
                        <div className="space-y-4">
                            <div
                                className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 text-emerald-900 dark:text-emerald-200">
                                <div className="font-extrabold text-sm mb-1 flex items-center gap-1.5">
                                    <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400"/>
                                    <span>원주역 및 여주역 셔틀버스 이용 안내 (무료)</span>
                                </div>
                                <p className="leading-relaxed">
                                    학기 중 연세대학교 미래캠퍼스 학생 및 교직원을 위한 무료 셔틀버스입니다. 국가지정 공휴일 및 방학 기간에는 운행이 정지되거나 변경될 수 있습니다.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div
                                    className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-black/5 dark:border-white/5 space-y-2">
                                    <div
                                        className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                                        <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400"/>
                                        <span>원주역 셔틀버스</span>
                                    </div>
                                    <div className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                        <p><strong>운행 구간:</strong> 원주역 ↔ 연세대학교 미래캠퍼스</p>
                                        <p><strong>이용 요금:</strong> 무료 (학생증/교직원증 지참)</p>
                                        <p><strong>운행 구분:</strong> 학기 중 평일 운행 (공휴일/주말 미운행)</p>
                                    </div>
                                </div>

                                <div
                                    className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-black/5 dark:border-white/5 space-y-2">
                                    <div
                                        className="font-extrabold text-sm text-slate-900 dark:text-white flex items-center gap-1.5">
                                        <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400"/>
                                        <span>여주역 셔틀버스</span>
                                    </div>
                                    <div className="text-slate-600 dark:text-slate-400 leading-relaxed">
                                        <p><strong>운행 구간:</strong> 경강선 여주역 ↔ 연세대학교 미래캠퍼스</p>
                                        <p><strong>이용 요금:</strong> 무료 (학생증/교직원증 지참)</p>
                                        <p><strong>운행 구분:</strong> 학기 중 평일 운행 (수도권 전철 경강선 연계)</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div
                                className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-500/30 text-blue-900 dark:text-blue-200">
                                <div className="font-extrabold text-sm mb-1 flex items-center gap-1.5">
                                    <Ticket className="w-4 h-4 text-blue-600 dark:text-blue-400"/>
                                    <span>서울 / 수도권 통학버스 예약 안내 (유료)</span>
                                </div>
                                <p className="leading-relaxed">
                                    서울 및 경기 주요 지역과 미래캠퍼스를 연결하는 통학버스로, 공식 원주 통학버스 예약 시스템에서 사전 예약권 구매 후 탑승하실 수 있습니다.
                                </p>
                            </div>

                            <div
                                className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-black/5 dark:border-white/5 space-y-3">
                                <div className="font-extrabold text-sm text-slate-900 dark:text-white">
                                    주요 서울 노선 및 예약 규정
                                </div>
                                <ul className="list-disc pl-4 space-y-1.5 text-slate-600 dark:text-slate-400">
                                    <li><strong>주요 탑승 지역:</strong> 신촌, 강남, 잠실, 일산, 노원, 부천 등</li>
                                    <li><strong>예약 방식:</strong> 원주 통학버스 예약 시스템 온라인 사전에매</li>
                                    <li><strong>문의 전화:</strong> 통학버스 사무소 033-760-5161 / 010-3793-7882</li>
                                    <li><strong>주의 사항:</strong> 입학연도 학번으로 본인인증 후 예약권을 구매해야 합니다.</li>
                                </ul>
                            </div>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div
                    className="p-4 border-t border-black/5 dark:border-white/10 bg-slate-50/80 dark:bg-white/[0.03] flex items-center justify-between gap-3">
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        원주 통학버스 예약 시스템 공식 웹사이트 제공
                    </span>
                    <a
                        href={YONSEI_SHUTTLE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                        <span>공식 예약 사이트 바로가기</span>
                        <ExternalLink className="w-3.5 h-3.5"/>
                    </a>
                </div>
            </div>
        </div>
    );

    return typeof window !== "undefined" ? createPortal(modalContent, document.body) : null;
};
