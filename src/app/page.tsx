import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {MainApp} from "@widgets/AppShell";
import {UI_TEXT} from "@shared/config/locale";

export const metadata: Metadata = {
    title: UI_TEXT.METADATA.TITLE,
    description: UI_TEXT.METADATA.DESC,
    alternates: {
        canonical: "/",
    },
};

export default async function HomePage({
                                           searchParams,
                                       }: {
    searchParams: Promise<{ page?: string }>;
}) {
    const sp = await searchParams;
    if (sp.page === "wiki" || sp.page === "yonsei_mirae") {
        redirect("/");
    }

    return <MainApp/>;
}
