"use client";

import React from "react";
import Link from "next/link";
import {useRouter} from "next/navigation";
import {ArrowLeft, BookPlus} from "lucide-react";

import {mutateAllWikiQueries} from "@entities/wiki";
import {WikiCreateForm} from "@features/wiki";
import {Footer} from "@shared/ui/Footer";

export interface WikiCreatePageProps {
    initialSlug?: string;
    initialLat?: number;
    initialLng?: number;
    initialCityCode?: string;
}

export const WikiCreatePage: React.FC<WikiCreatePageProps> = ({
                                                                  initialSlug = "",
                                                                  initialLat,
                                                                  initialLng,
                                                                  initialCityCode,
                                                              }) => {
    const router = useRouter();

    return (
        <div className="min-h-screen bg-[#f4f7fb] dark:bg-[#080c15] text-slate-900 dark:text-slate-100 flex flex-col">
            <header
                className="sticky top-0 z-30 backdrop-blur-2xl bg-white/88 dark:bg-[#0b101b]/88 border-b border-slate-200/80 dark:border-white/[0.08]">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                        <Link
                            href="/wiki"
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-white/[0.07] dark:hover:bg-white/15 text-xs font-black text-slate-700 dark:text-slate-200 transition"
                        >
                            <ArrowLeft className="w-3.5 h-3.5"/>
                            <span>위키 목록</span>
                        </Link>
                        <div className="flex items-center gap-1.5">
                            <BookPlus className="w-4 h-4 text-[#003876] dark:text-sky-400"/>
                            <h1 className="text-sm sm:text-base font-black">새 위키 문서 만들기</h1>
                        </div>
                    </div>
                </div>
            </header>

            <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6">
                <WikiCreateForm
                    initialSlug={initialSlug}
                    initialLat={initialLat}
                    initialLng={initialLng}
                    initialCityCode={initialCityCode}
                    onCreated={async (created) => {
                        await mutateAllWikiQueries().catch(() => []);
                        router.push(`/wiki/${encodeURIComponent(created.slug)}`);
                    }}
                    onCancel={() => router.push("/wiki")}
                />
            </main>

            <Footer/>
        </div>
    );
};

export default WikiCreatePage;
