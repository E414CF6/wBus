import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {YONSEI_MIRAE_WIKI_SLUG} from "@entities/wiki";
import {MainApp} from "@widgets/AppShell";
import {UI_TEXT} from "@shared/config/locale";

export const metadata: Metadata = {
    title: UI_TEXT.METADATA.TITLE, description: UI_TEXT.METADATA.DESC, alternates: {
        canonical: "/",
    },
};

export default async function HomePage({
                                           searchParams,
                                       }: {
    searchParams: Promise<{ page?: string }>;
}) {
    const sp = await searchParams;
    if (sp.page === "yonsei_mirae") {
        redirect(`/wiki/${encodeURIComponent(YONSEI_MIRAE_WIKI_SLUG)}`);
    }
    if (sp.page === "wiki") {
        redirect("/wiki");
    }

    return <MainApp/>;
}
