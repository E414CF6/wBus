import React from "react";
import Link from "next/link";
import {ArrowLeft, Bus, CheckCircle2, ChevronRight, Lock, Shield} from "lucide-react";
import type {Metadata} from "next";
import {UI_TEXT} from "@shared/config/locale";

const L = UI_TEXT.LEGAL;
const P = L.PRIVACY;

export const metadata: Metadata = {
    title: P.META_TITLE,
    description: P.META_DESC,
};

export default function PrivacyPage() {
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
                            <div
                                className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center text-white">
                                <Bus className="w-4 h-4"/>
                            </div>
                            <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                                {L.BRAND_NAME}
                            </span>
                        </div>
                    </div>

                    <div
                        className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 p-1 rounded-xl text-xs font-semibold">
                        <Link
                            href="/terms"
                            className="px-3 py-1 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        >
                            {UI_TEXT.COMMON.TERMS_OF_SERVICE}
                        </Link>
                        <span
                            className="px-3 py-1 rounded-lg bg-white dark:bg-white/15 text-emerald-600 dark:text-emerald-400 shadow-xs">
                            {UI_TEXT.COMMON.PRIVACY_POLICY}
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
                        <span>{P.BADGE}</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
                        {P.TITLE}
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
                        {L.EFFECTIVE_DATE}
                    </p>
                </div>

                {/* Privacy Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div
                        className="p-4 rounded-2xl bg-white dark:bg-[#11131a] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-1.5">
                        <div
                            className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                            <Lock className="w-4 h-4"/>
                            <span>{P.SUMMARY_CARDS.ANONYMOUS_TITLE}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                            {P.SUMMARY_CARDS.ANONYMOUS_DESC}
                        </p>
                    </div>

                    <div
                        className="p-4 rounded-2xl bg-white dark:bg-[#11131a] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-1.5">
                        <div
                            className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                            <CheckCircle2 className="w-4 h-4"/>
                            <span>{P.SUMMARY_CARDS.LOCATION_TITLE}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                            {P.SUMMARY_CARDS.LOCATION_DESC}
                        </p>
                    </div>

                    <div
                        className="p-4 rounded-2xl bg-white dark:bg-[#11131a] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-1.5">
                        <div
                            className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                            <Shield className="w-4 h-4"/>
                            <span>{P.SUMMARY_CARDS.STORAGE_TITLE}</span>
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                            {P.SUMMARY_CARDS.STORAGE_DESC}
                        </p>
                    </div>
                </div>

                {/* Detailed Sections */}
                <div className="space-y-6 text-sm sm:text-base leading-relaxed">
                    {/* 1 */}
                    <section
                        className="p-6 rounded-3xl bg-white dark:bg-[#11131a] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="text-emerald-600 dark:text-emerald-400">1.</span> {P.SECTIONS.S1_TITLE}
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 text-sm">
                            {P.SECTIONS.S1_BODY}
                        </p>
                    </section>

                    {/* 2 */}
                    <section
                        className="p-6 rounded-3xl bg-white dark:bg-[#11131a] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="text-emerald-600 dark:text-emerald-400">2.</span> {P.SECTIONS.S2_TITLE}
                        </h2>
                        <div className="space-y-3 text-slate-600 dark:text-slate-300 text-sm">
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white mb-1">{P.SECTIONS.S2_A_TITLE}</h3>
                                <p>{P.SECTIONS.S2_A_BODY}</p>
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white mb-1">{P.SECTIONS.S2_B_TITLE}</h3>
                                <p>{P.SECTIONS.S2_B_BODY}</p>
                            </div>
                        </div>
                    </section>

                    {/* 3 */}
                    <section
                        className="p-6 rounded-3xl bg-white dark:bg-[#11131a] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="text-emerald-600 dark:text-emerald-400">3.</span> {P.SECTIONS.S3_TITLE}
                        </h2>
                        <ul className="list-disc list-inside space-y-1.5 text-slate-600 dark:text-slate-300 text-sm pl-1">
                            <li>
                                <strong>{P.SECTIONS.S3_ITEM_LABEL}</strong>
                                {P.SECTIONS.S3_ITEM_BODY}
                            </li>
                        </ul>
                    </section>

                    {/* 4 */}
                    <section
                        className="p-6 rounded-3xl bg-white dark:bg-[#11131a] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="text-emerald-600 dark:text-emerald-400">4.</span> {P.SECTIONS.S4_TITLE}
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 text-sm">
                            {P.SECTIONS.S4_BODY}
                        </p>
                    </section>

                    {/* 5 */}
                    <section
                        className="p-6 rounded-3xl bg-white dark:bg-[#11131a] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="text-emerald-600 dark:text-emerald-400">5.</span> {P.SECTIONS.S5_TITLE}
                        </h2>
                        <div className="space-y-2 text-slate-600 dark:text-slate-300 text-sm">
                            <p>{P.SECTIONS.S5_INTRO}</p>
                            <ul className="list-disc list-inside pl-2 space-y-1 text-slate-500 dark:text-slate-400">
                                <li>
                                    {P.SECTIONS.S5_ITEM_1_PREFIX}
                                    <code className="font-mono">{P.SECTIONS.S5_ITEM_1_CODE}</code>
                                    {P.SECTIONS.S5_ITEM_1_SUFFIX}
                                </li>
                                <li>{P.SECTIONS.S5_ITEM_2}</li>
                                <li>{P.SECTIONS.S5_ITEM_3}</li>
                                <li>{P.SECTIONS.S5_ITEM_4}</li>
                            </ul>
                            <p className="text-xs text-slate-400">{P.SECTIONS.S5_NOTE}</p>
                        </div>
                    </section>

                    {/* 6 */}
                    <section
                        className="p-6 rounded-3xl bg-white dark:bg-[#11131a] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="text-emerald-600 dark:text-emerald-400">6.</span> {P.SECTIONS.S6_TITLE}
                        </h2>
                        <p className="text-slate-600 dark:text-slate-300 text-sm">
                            {P.SECTIONS.S6_BODY}
                        </p>
                    </section>

                    {/* 7 */}
                    <section
                        className="p-6 rounded-3xl bg-white dark:bg-[#11131a] border border-slate-200/80 dark:border-white/5 shadow-xs space-y-3">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <span className="text-emerald-600 dark:text-emerald-400">7.</span> {P.SECTIONS.S7_TITLE}
                        </h2>
                        <div className="space-y-1 text-slate-600 dark:text-slate-300 text-sm">
                            <p>{P.SECTIONS.S7_INTRO}</p>
                            <div className="p-3 mt-2 rounded-xl bg-slate-50 dark:bg-white/5 text-xs space-y-1">
                                <p><strong>{P.SECTIONS.S7_SERVICE_LABEL}</strong>: {P.SECTIONS.S7_SERVICE_VALUE}</p>
                                <p><strong>{P.SECTIONS.S7_CONTACT_LABEL}</strong>: {P.SECTIONS.S7_CONTACT_VALUE}</p>
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
                        <span>{P.CHECK_TERMS_LINK}</span>
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
