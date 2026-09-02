import React from "react";
import Link from "next/link";
import {ArrowLeft, Bus, CheckCircle2, ChevronRight, Lock, Shield} from "lucide-react";
import type {Metadata} from "next";

export const metadata: Metadata = {
    title: "개인정보처리방침", description: "wBus 원주 버스 정보 서비스 개인정보처리방침",
};

export default function PrivacyPage() {
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
                        <div
                            className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                            <Bus className="w-4 h-4"/>
                        </div>
                        <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                                wBus
                            </span>
                    </div>
                </div>

                <div
                    className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 p-1 rounded-xl text-xs font-semibold">
                    <Link
                        href="/terms"
                        className="px-3 py-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                    >
                        이용약관
                    </Link>
                    <span
                        className="px-3 py-1 rounded-lg bg-white dark:bg-white/15 text-emerald-600 dark:text-emerald-400 shadow-xs">
                            개인정보처리방침
                        </span>
                </div>
            </div>
        </header>

        {/* Main Content */}
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
            {/* Title Banner */}
            <div className="space-y-2">
                <div
                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                    <Shield className="w-3.5 h-3.5"/>
                    <span>wBus Privacy Policy</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                    개인정보처리방침
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                    최종 개정일: 2026년 3월 1일 | 시행일: 2026년 3월 1일
                </p>
            </div>

            {/* Privacy Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div
                    className="p-4 rounded-2xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-1.5">
                    <div
                        className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                        <Lock className="w-4 h-4"/>
                        <span>비회원제 익명 서비스</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                        별도의 회원가입 없이 누구나 자유롭게 이용하며, 주민등록번호, 연락처 등 민감한 개인 식별 정보를 요구하거나 저장하지 않습니다.
                    </p>
                </div>

                <div
                    className="p-4 rounded-2xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-1.5">
                    <div
                        className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                        <CheckCircle2 className="w-4 h-4"/>
                        <span>위치정보 서버 비저장</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                        주변 정류장 확인을 위한 GPS 위치 정보는 이용자의 브라우저 내에서만 1회성으로 사용되며 서버로 전송·수집되지 않습니다.
                    </p>
                </div>

                <div
                    className="p-4 rounded-2xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-1.5">
                    <div
                        className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                        <Shield className="w-4 h-4"/>
                        <span>로컬 스토리지 안전 관리</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                        즐겨찾기, 최근 조회 노선, 다크모드 테마 설정은 이용자 기기의 로컬 스토리지에만 안전하게 보관됩니다.
                    </p>
                </div>
            </div>

            {/* Detailed Sections */}
            <div className="space-y-6 text-sm sm:text-base leading-relaxed">
                {/* 1. 총칙 */}
                <section
                    className="p-6 rounded-3xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="text-emerald-600 dark:text-emerald-400">1.</span> 총칙
                    </h2>
                    <p className="text-slate-600 dark:text-slate-300 text-sm">
                        wBus(이하 &quot;서비스&quot;)는 이용자의 개인정보를 중요시하며, 「개인정보 보호법」 등 관련 법령을 준수하고 있습니다. 본 방침은 이용자가 제공하는
                        정보가 어떠한 용도와 방식으로 이용되고 있으며, 개인정보 보호를 위해 어떠한 조치가 취해지고 있는지 알려드립니다.
                    </p>
                </section>

                {/* 2. 수집하는 개인정보 항목 및 방법 */}
                <section
                    className="p-6 rounded-3xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="text-emerald-600 dark:text-emerald-400">2.</span> 수집하는 항목 및 수집 방법
                    </h2>
                    <div className="space-y-3 text-slate-600 dark:text-slate-300 text-sm">
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white mb-1">가. 스퀘어(커뮤니티 광장) 이용 시</h3>
                            <p>작성 시 입력한 닉네임(익명 가능), 게시글 내용, 작성 일시, 작성자가 설정한 식별 태그(본인 글 삭제 확인용)가 수집될 수 있습니다.</p>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white mb-1">나. 서비스 이용 과정에서 자동 생성되는
                                정보</h3>
                            <p>서비스 악용 및 비정상 접근(어뷰징/DDoS 방지) 대응을 위한 최소한의 접속 IP 주소, 브라우저 종류(User-Agent), 접속 일시가 웹 서버
                                로그에 일시적으로 기록될 수 있습니다.</p>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white mb-1">다. 위치 정보
                                (Geolocation)</h3>
                            <p>주변 버스 정류장 검색 기능을 사용할 경우 사용자의 동의 하에 위치 좌표가 브라우저에서 읽혀지며, 이는 기기 내에서 거리 계산 용도로만 쓰이고 서버에
                                기록되거나 축적되지 않습니다.</p>
                        </div>
                    </div>
                </section>

                {/* 3. 개인정보의 이용 목적 및 보유 기간 */}
                <section
                    className="p-6 rounded-3xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="text-emerald-600 dark:text-emerald-400">3.</span> 개인정보의 이용 목적 및 보유 기간
                    </h2>
                    <ul className="list-disc list-inside space-y-1.5 text-slate-600 dark:text-slate-300 text-sm pl-1">
                        <li><strong>스퀘어 메시지</strong>: 이용자가 직접 삭제하거나 서비스 운영 정책에 따라 정리될 때까지 보관됩니다.</li>
                        <li><strong>서버 접속 로그</strong>: 통신비밀보호법 등 관련 법령에 의거하여 비정상 트래픽 분석 후 일정 기간(통상 3개월 이내) 경과 시
                            파기됩니다.
                        </li>
                    </ul>
                </section>

                {/* 4. 개인정보의 제3자 제공 */}
                <section
                    className="p-6 rounded-3xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="text-emerald-600 dark:text-emerald-400">4.</span> 개인정보의 제3자 제공
                    </h2>
                    <p className="text-slate-600 dark:text-slate-300 text-sm">
                        서비스는 이용자의 개인정보를 제3자에게 제공하거나 판매하지 않습니다. 다만, 법령의 규정에 의거하거나 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의
                        요구가 있는 경우에 한하여 예외로 합니다.
                    </p>
                </section>

                {/* 5. 로컬 스토리지(Local Storage) 및 쿠키 사용 안내 */}
                <section
                    className="p-6 rounded-3xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="text-emerald-600 dark:text-emerald-400">5.</span> 브라우저 저장소(Local Storage)
                        운용
                    </h2>
                    <div className="space-y-2 text-slate-600 dark:text-slate-300 text-sm">
                        <p>서비스는 이용자의 편의성 증대를 위해 브라우저의 Local Storage 기술을 활용하여 다음의 설정값을 기기에 저장합니다:</p>
                        <ul className="list-disc list-inside pl-2 space-y-1 text-slate-500 dark:text-slate-400">
                            <li>즐겨찾기한 버스 노선 목록</li>
                            <li>최근 조회한 노선 및 정류장</li>
                            <li>다크 모드 / 라이트 모드 테마 환경설정</li>
                            <li>스퀘어에서 본인이 작성한 게시글 식별 키 (게시글 삭제 관리용)</li>
                        </ul>
                        <p className="text-xs text-slate-400">※ 이용자는 웹 브라우저 캐시 및 쿠키/사이트 데이터 삭제 메뉴를 통해 언제든지 위 정보를
                            초기화할 수 있습니다.</p>
                    </div>
                </section>

                {/* 6. 정보주체의 권리 및 행사 방법 */}
                <section
                    className="p-6 rounded-3xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="text-emerald-600 dark:text-emerald-400">6.</span> 정보주체의 권리 및 행사 방법
                    </h2>
                    <p className="text-slate-600 dark:text-slate-300 text-sm">
                        이용자는 스퀘어에 작성한 본인의 게시물을 직접 삭제할 수 있으며, 타인에 의한 명예훼손 또는 개인정보 노출 게시물이 있을 경우 서비스 운영자에게 삭제를 요청할 수
                        있습니다.
                    </p>
                </section>

                {/* 7. 개인정보 보호책임자 및 문의처 */}
                <section
                    className="p-6 rounded-3xl bg-white dark:bg-[#111218] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                    <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <span className="text-emerald-600 dark:text-emerald-400">7.</span> 개인정보 보호책임자 및 문의
                    </h2>
                    <div className="space-y-1 text-slate-600 dark:text-slate-300 text-sm">
                        <p>wBus 서비스의 개인정보 보호 및 관련 문의사항은 아래로 연락해 주시기 바랍니다.</p>
                        <div className="p-3 mt-2 rounded-xl bg-slate-50 dark:bg-white/5 text-xs space-y-1">
                            <p><strong>서비스명</strong>: wBus (원주 버스 정보 서비스)</p>
                            <p><strong>문의 창구</strong>: 스퀘어 문의 카테고리 또는 GitHub Issues</p>
                        </div>
                    </div>
                </section>
            </div>

            {/* Footer Navigation */}
            <div
                className="pt-6 border-t border-slate-200 dark:border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4">
                <Link
                    href="/terms"
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                    <span>서비스 이용약관 확인하기</span>
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
