import type {Metadata} from "next";
import {WikiCreatePage} from "@widgets/WikiDirectory";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: "새 위키 문서 만들기 | wBus 커뮤니티 위키",
    description: "새로운 정류장, 노선, 캠퍼스 또는 터미널 위키 문서를 개설하세요.",
    robots: {
        index: false,
        follow: true,
    },
};

export default async function WikiNewRoutePage({
    searchParams,
}: {
    searchParams: Promise<{ slug?: string }>;
}) {
    const sp = await searchParams;
    const initialSlug = typeof sp.slug === "string" ? sp.slug : "";

    return <WikiCreatePage initialSlug={initialSlug}/>;
}
