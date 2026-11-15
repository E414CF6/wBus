import type {Metadata} from "next";
import {YONSEI_MIRAE_WIKI_SLUG} from "@entities/wiki";
import {getWikiPage} from "@entities/wiki/server";
import {YonseiCampusPage} from "@widgets/YonseiCampusPage";
import {UI_TEXT} from "@shared/config/locale";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
    title: UI_TEXT.YONSEI.TITLE,
    description: "연세대학교 미래캠퍼스 시내버스(30번·34번·34-1번) 및 무료 셔틀버스 시간표와 탑승 장소를 빠르게 확인하세요.",
    alternates: {
        canonical: "/schedule",
    },
};

export default async function SchedulePage() {
    const doc = await getWikiPage(YONSEI_MIRAE_WIKI_SLUG).catch(() => null);
    return <YonseiCampusPage initialDocument={doc ?? undefined}/>;
}
