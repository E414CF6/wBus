import React from "react";
import Link from "next/link";
import {AlertCircle, ArrowLeft, Bus, ChevronRight, FileText} from "lucide-react";
import type {Metadata} from "next";
import {UI_TEXT} from "@shared/config/locale";

const L = UI_TEXT.LEGAL;
const T = L.TERMS;

export const metadata: Metadata = {
    title: T.META_TITLE,
    description: T.META_DESC,
};

export default function TermsPage() {
    return (
        <div
            className="min-h-dvh pb-[env(safe-area-inset-bottom,0px)] bg-slate-50 dark:bg-[#090d16] text-slate-800 dark:text-slate-200 transition-colors">
            {/* Sticky Header */}
            <header
                className="sticky top-0 z-40 bg-white/80 dark:bg-[#090d16]/80 backdrop-blur-xl border-b border-slate-200/80 dark:border-white/10">
                <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/"
                            className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-slate-200 transition-colors"
                            aria-label={L.BACK_TO_HOME_ARIA}
                        >
                            <ArrowLeft className="w-4 h-4"/>
                        </Link>
                        <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                                <Bus className="w-4 h-4"/>
                            </div>
                            <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                                {L.BRAND_NAME}
                            </span>
                        </div>
                    </div>

                    <div
                        className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 p-1 rounded-xl text-xs font-semibold">
                        <span
                            className="px-3 py-1 rounded-lg bg-white dark:bg-white/15 text-blue-600 dark:text-blue-400 shadow-xs">
                            {UI_TEXT.COMMON.TERMS_OF_SERVICE}
                        </span>
                        <Link
                            href="/privacy"
                            className="px-3 py-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            {UI_TEXT.COMMON.PRIVACY_POLICY}
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
                        <span>{T.BADGE}</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                        {T.TITLE}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                        {L.EFFECTIVE_DATE}
                    </p>
                </div>

                {/* Important Notice Callout */}
                <div
                    className="p-4 sm:p-5 rounded-2xl bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200/80 dark:border-blue-800/40 space-y-2">
                    <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-sm">
                        <AlertCircle className="w-4 h-4 shrink-0"/>
                        <span>{T.CALLOUT_TITLE}</span>
                    </div>
                    <p className="text-xs sm:text-sm text-blue-900/80 dark:text-blue-200/80 leading-relaxed">
                        {T.CALLOUT_BODY}
                    </p>
                </div>

                {/* Articles List */}
                <div className="space-y-6 text-sm sm:text-base leading-relaxed">
                    {/* Article 1 */}
                    <section
                        className="p-6 rounded-3xl bg-white dark:bg-[#11131a] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span
                                className="text-blue-600 dark:text-blue-400">{T.ARTICLES.A1_NUM}</span> {T.ARTICLES.A1_TITLE}
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 text-sm">
                            {T.ARTICLES.A1_BODY}
                        </p>
                    </section>

                    {/* Article 2 */}
                    <section
                        className="p-6 rounded-3xl bg-white dark:bg-[#11131a] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span
                                className="text-blue-600 dark:text-blue-400">{T.ARTICLES.A2_NUM}</span> {T.ARTICLES.A2_TITLE}
                        </h2>
                        <ul className="list-disc list-inside space-y-1.5 text-slate-600 dark:text-slate-300 text-sm pl-1">
                            <li>
                                <strong>{T.ARTICLES.A2_ITEM1_LABEL}</strong>
                                {T.ARTICLES.A2_ITEM1_BODY}
                            </li>
                            <li>
                                <strong>{T.ARTICLES.A2_ITEM2_LABEL}</strong>
                                {T.ARTICLES.A2_ITEM2_BODY}
                            </li>
                        </ul>
                    </section>

                    {/* Article 3 */}
                    <section
                        className="p-6 rounded-3xl bg-white dark:bg-[#11131a] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span
                                className="text-blue-600 dark:text-blue-400">{T.ARTICLES.A3_NUM}</span> {T.ARTICLES.A3_TITLE}
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 text-sm">
                            {T.ARTICLES.A3_P1}<br/>
                            {T.ARTICLES.A3_P2}
                        </p>
                    </section>

                    {/* Article 4 */}
                    <section
                        className="p-6 rounded-3xl bg-white dark:bg-[#11131a] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span
                                className="text-blue-600 dark:text-blue-400">{T.ARTICLES.A4_NUM}</span> {T.ARTICLES.A4_TITLE}
                        </h2>
                        <div className="space-y-2 text-slate-600 dark:text-slate-300 text-sm">
                            <p>{T.ARTICLES.A4_P1}</p>
                            <p>{T.ARTICLES.A4_P2}</p>
                            <p>{T.ARTICLES.A4_P3}</p>
                        </div>
                    </section>

                    {/* Article 5 */}
                    <section
                        className="p-6 rounded-3xl bg-white dark:bg-[#11131a] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span
                                className="text-blue-600 dark:text-blue-400">{T.ARTICLES.A5_NUM}</span> {T.ARTICLES.A5_TITLE}
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 text-sm">
                            {T.ARTICLES.A5_P1}<br/>
                            {T.ARTICLES.A5_P2}
                        </p>
                    </section>

                    {/* Article 6 */}
                    <section
                        className="p-6 rounded-3xl bg-white dark:bg-[#11131a] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span
                                className="text-blue-600 dark:text-blue-400">{T.ARTICLES.A6_NUM}</span> {T.ARTICLES.A6_TITLE}
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 text-sm">
                            {T.ARTICLES.A6_P1}<br/>
                            {T.ARTICLES.A6_P2}
                        </p>
                    </section>

                    {/* Article 7 */}
                    <section
                        className="p-6 rounded-3xl bg-white dark:bg-[#11131a] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span
                                className="text-blue-600 dark:text-blue-400">{T.ARTICLES.A7_NUM}</span> {T.ARTICLES.A7_TITLE}
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 text-sm">
                            {T.ARTICLES.A7_BODY}
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
                        <span>{T.CHECK_PRIVACY_LINK}</span>
                        <ChevronRight className="w-4 h-4"/>
                    </Link>
                    <Link
                        href="/"
                        className="px-5 py-2.5 rounded-2xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity"
                    >
                        {L.BACK_TO_HOME_BTN}
                    </Link>
                </div>
            </main>
        </div>
    );
}
