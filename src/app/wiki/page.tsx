import type {Metadata} from "next";
import {WIKI_CATEGORIES, type WikiCategory} from "@entities/wiki";
import {listWikiPages} from "@entities/wiki/server";
import {WikiDirectoryPage} from "@widgets/WikiDirectory";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "wBus 커뮤니티 위키 | 함께 만드는 버스·셔틀 가이드",
    description:
        "누구나 직접 편집하고 최신화하는 시내버스 노선·캠퍼스 셔틀·터미널 위키. 실시간 시간표와 커뮤니티 팁을 함께 만나보세요.",
    alternates: {
        canonical: "/wiki",
    },
};

export default async function WikiIndexRoutePage({
                                                     searchParams,
                                                 }: {
    searchParams: Promise<{ q?: string; category?: string }>;
}) {
    const sp = await searchParams;
    const rawCategory = sp.category;
    const validCategory: WikiCategory | "all" =
        rawCategory && WIKI_CATEGORIES.includes(rawCategory as WikiCategory)
            ? (rawCategory as WikiCategory)
            : "all";
    const query = typeof sp.q === "string" ? sp.q : "";

    const initialData = await listWikiPages().catch(() => undefined);

    return (
        <WikiDirectoryPage
            initialData={initialData}
            initialQuery={query}
            initialCategory={validCategory}
        />
    );
}
