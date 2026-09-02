import React from "react";
import Link from "next/link";
import {AlertCircle, ArrowLeft, Bus, ChevronRight, FileText} from "lucide-react";
import type {Metadata} from "next";

export const metadata: Metadata = {
    title: "서비스 이용약관", description: "wBus 서비스 이용약관",
};

export default function TermsPage() {
    return (<div
        className="min-h-screen bg-slate-50 dark:bg-[#0b0f19] text-slate-800 dark:text-slate-200 transition-colors">
        {/* Sticky Header */}
        <header
            className="sticky top-0 z-40 bg-white/80 dark:bg-[#0b0f19]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/10">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Link
                        href="/"
                        className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 transition-colors"
                        aria-label="메인 홈으로 돌아가기"
                    >
                        <ArrowLeft className="w-4 h-4"/>
                    </Link>
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                            <Bus className="w-4 h-4"/>
                        </div>
                        <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                                wBus
                            </span>
                    </div>
                </div>

                <div
                    className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 p-1 rounded-xl text-xs font-semibold">
                        <span
                            className="px-3 py-1 rounded-lg bg-white dark:bg-white/15 text-blue-600 dark:text-blue-400 shadow-xs">
                            이용약관
                        </span>
                    <Link
                        href="/privacy"
                        className="px-3 py-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                        개인정보처리방침
                    </Link>
                </div>
            </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
            {/* Title Banner */}
            <div className="space-y-2">
                <div
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-bold">
                    <FileText className="w-3.5 h-3.5"/>
                    <span>wBus Service Policy</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    서비스 이용약관
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    최종 개정일: 2026년 3월 1일 | 시행일: 2026년 3월 1일
                </p>
            </div>

            {/* Important Notice Callout */}
            <div
                className="p-4 sm:p-5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/40 space-y-2">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0"/>
                    <span>공공데이터 기반 실시간 버스 정보 안내</span>
                </div>
                <p className="text-xs sm:text-sm text-blue-900/80 dark:text-blue-200/80 leading-relaxed">
                    wBus는 원주시 교통정보센터(ITS) 및 공공데이터포털의 공개 API를 활용하여 시민과 학생들에게 편의를 제공하는 비영리 목적의 공공 정보 서비스입니다. 실시간 도로 사정
                    및 통신 상태에 따라 실제 버스 위치와 수 초~수 분의 오차가 발생할 수 있습니다.
                </p>
            </div>

            {/* Articles List */}
            <div className="space-y-6 text-sm sm:text-base leading-relaxed">
                {/* 제1조 */}
                <section
                    className="p-6 rounded-3xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="text-blue-600 dark:text-blue-400">제1조</span> (목적)
                    </h2>
                    <p className="text-slate-600 dark:text-slate-300 text-sm">
                        본 약관은 wBus(이하 &quot;서비스&quot;)가 제공하는 원주시 버스 실시간 위치, 노선 시간표, 스퀘어(커뮤니티 광장) 등 제반 서비스의 이용 조건 및
                        절차, 이용자와 서비스 간의 권리, 의무 및 책임 사항을 규정함을 목적으로 합니다.
                    </p>
                </section>

                {/* 제2조 */}
                <section
                    className="p-6 rounded-3xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="text-blue-600 dark:text-blue-400">제2조</span> (용어의 정의)
                    </h2>
                    <ul className="list-disc list-inside space-y-1.5 text-slate-600 dark:text-slate-300 text-sm pl-1">
                        <li><strong>&quot;서비스&quot;</strong>란 단말기(PC, 스마트폰 등)와 무관하게 이용자가 이용할 수 있는 wBus 웹/앱 서비스를
                            의미합니다.
                        </li>
                        <li><strong>&quot;이용자&quot;</strong>란 서비스에 접속하여 본 약관에 따라 서비스를 이용하는 모든 사용자를 의미합니다.</li>
                        <li><strong>&quot;스퀘어&quot;</strong>이란 이용자가 버스 운행 상황 공유, 질문, 정보 교환 등을 위해 작성하는 실시간 스레드 및 메시지
                            게시 공간을 말합니다.
                        </li>
                    </ul>
                </section>

                {/* 제3조 */}
                <section
                    className="p-6 rounded-3xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="text-blue-600 dark:text-blue-400">제3조</span> (약관의 효력 및 변경)
                    </h2>
                    <p className="text-slate-600 dark:text-slate-300 text-sm">
                        1. 본 약관은 서비스 화면에 게시함으로써 효력이 발생합니다.<br/>
                        2. 서비스는 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있으며, 개정 시 적용일자 및 개정 사유를 명시하여 최소 7일 전 서비스 내 공지합니다.
                    </p>
                </section>

                {/* 제4조 */}
                <section
                    className="p-6 rounded-3xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="text-blue-600 dark:text-blue-400">제4조</span> (서비스의 제공 및 한계)
                    </h2>
                    <div className="space-y-2 text-slate-600 dark:text-slate-300 text-sm">
                        <p>1. 서비스는 연중무휴, 1일 24시간 제공을 원칙으로 합니다.</p>
                        <p>2. 실시간 버스 위치 및 도착 예정 정보는 원주시 ITS 및 공공데이터포털 Open API를 기반으로 가공·제공됩니다. 공공기관 시스템의 점검, 네트워크
                            장애, 기상 상황, 도로 정체 등에 의해 실제 버스 운행 상황과 일부 차이가 있을 수 있습니다.</p>
                        <p>3. 본 서비스에서 제공하는 모든 운행 및 도착 정보는 참고용이며, 서비스 이용으로 인해 발생한 직·간접적 손해(예: 버스 미탑승, 환승 실패, 지각 등)에
                            대해 서비스 제공자는 법적 책임을 지지 않습니다.</p>
                    </div>
                </section>

                {/* 제5조 */}
                <section
                    className="p-6 rounded-3xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="text-blue-600 dark:text-blue-400">제5조</span> (스퀘어 및 게시물 관리 기준)
                    </h2>
                    <div className="space-y-2 text-slate-600 dark:text-slate-300 text-sm">
                        <p>1. 스퀘어는 시민과 이용자 간의 건전한 정보 공유를 위한 익명 소통 공간입니다.</p>
                        <p>2. 이용자는 다음 각 호에 해당하는 행위나 게시물을 등록해서는 안 됩니다:</p>
                        <ul className="list-disc list-inside pl-2 space-y-1 text-slate-500 dark:text-slate-400">
                            <li>타인의 명예를 훼손하거나 모욕, 비방, 허위사실을 유포하는 행위</li>
                            <li>욕설, 비속어, 음란물 또는 혐오 발언을 게시하는 행위</li>
                            <li>영리 목적의 광고성 스팸 글을 반복 등록하는 행위</li>
                            <li>타인의 개인정보(이름, 연락처, 차량번호 등)를 무단 공개하는 행위</li>
                            <li>서비스의 정상적인 운영을 방해하거나 시스템에 과도한 부하를 가하는 행위</li>
                        </ul>
                        <p>3. 위 조항을 위반한 게시물은 사전 통보 없이 즉시 삭제되거나 숨김 처리될 수 있으며, 해당 이용자의 서비스 이용이 일시적 또는 영구적으로 제한될 수
                            있습니다.</p>
                    </div>
                </section>

                {/* 제6조 */}
                <section
                    className="p-6 rounded-3xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="text-blue-600 dark:text-blue-400">제6조</span> (위치기반 서비스 및 데이터 이용)
                    </h2>
                    <p className="text-slate-600 dark:text-slate-300 text-sm">
                        1. 서비스는 이용자의 현재 위치 기준 주변 정류장 탐색 및 실시간 거리 계산을 위해 브라우저의 Geolocation API를 활용할 수 있습니다.<br/>
                        2. 위치 정보는 이용자의 기기(브라우저)에서만 실시간으로 연산 처리되며, 서버에 별도로 수집·저장되지 않습니다.
                    </p>
                </section>

                {/* 제7조 */}
                <section
                    className="p-6 rounded-3xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="text-blue-600 dark:text-blue-400">제7조</span> (저작권 및 지식재산권)
                    </h2>
                    <p className="text-slate-600 dark:text-slate-300 text-sm">
                        1. 서비스가 자체 제작한 UI, 디자인, 소스코드, 콘텐츠의 저작권은 서비스 운영자에게 있습니다.<br/>
                        2. 원주시 버스 노선, 정류장 위치, 운행 시각표 등의 공공데이터에 대한 권리는 원주시 및 국토교통부 공공데이터 제공기관의 지침에 따릅니다.
                    </p>
                </section>

                {/* 제8조 */}
                <section
                    className="p-6 rounded-3xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="text-blue-600 dark:text-blue-400">제8조</span> (준거법 및 재판관할)
                    </h2>
                    <p className="text-slate-600 dark:text-slate-300 text-sm">
                        본 약관과 관련된 분쟁에 대해서는 대한민국 법률을 준거법으로 하며, 분쟁 발생 시 관할 법원은 민사소송법에 따른 법원을 전속관할로 합니다.
                    </p>
                </section>
            </div>

            {/* Footer Navigation */}
            <div
                className="pt-6 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <Link
                    href="/privacy"
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline"
                >
                    <span>개인정보처리방침 확인하기</span>
                    <ChevronRight className="w-4 h-4"/>
                </Link>
                <Link
                    href="/"
                    className="px-5 py-2.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity"
                >
                    메인 홈으로 돌아가기
                </Link>
            </div>
        </main>
    </div>);
}
