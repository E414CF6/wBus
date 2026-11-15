import type {Metadata} from "next";
import {redirect} from "next/navigation";
import {resolveLegacyWikiSlug} from "@entities/wiki";
import {getWikiPage} from "@entities/wiki/server";
import {WikiPageView} from "@widgets/WikiPage";

export const dynamic = "force-dynamic";

function decodeSlugParam(raw: string): string {
    try {
        return decodeURIComponent(raw).trim();
    } catch {
        return raw.trim();
    }
}

export async function generateMetadata({
                                           params,
                                       }: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    const {slug: rawSlug} = await params;
    const rawDecoded = decodeSlugParam(rawSlug);
    const slug = resolveLegacyWikiSlug(rawDecoded) ?? rawDecoded;
    const doc = await getWikiPage(slug).catch(() => null);

    if (!doc) {
        return {
            title: `${slug} — 새 위키 문서 | wBus 위키`,
            description: "아직 작성되지 않은 wBus 커뮤니티 위키 문서입니다.",
        };
    }

    return {
        title: `${doc.title} — wBus 위키`,
        description: doc.subtitle || `${doc.title} 버스·셔틀·정류장 커뮤니티 위키 가이드`,
        alternates: {
            canonical: `/wiki/${encodeURIComponent(doc.slug)}`,
        },
    };
}

export default async function WikiSlugRoutePage({
                                                    params,
                                                    searchParams,
                                                }: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ mode?: string }>;
}) {
    const {slug: rawSlug} = await params;
    const sp = await searchParams;
    const slug = decodeSlugParam(rawSlug);

    const legacyCanonical = resolveLegacyWikiSlug(slug);
    if (legacyCanonical && legacyCanonical !== slug) {
        const modeSuffix =
            sp.mode === "edit" || sp.mode === "history" ? `?mode=${sp.mode}` : "";
        redirect(`/wiki/${encodeURIComponent(legacyCanonical)}${modeSuffix}`);
    }

    const doc = await getWikiPage(slug).catch(() => null);
    if (doc && doc.slug !== slug) {
        const modeSuffix =
            sp.mode === "edit" || sp.mode === "history" ? `?mode=${sp.mode}` : "";
        redirect(`/wiki/${encodeURIComponent(doc.slug)}${modeSuffix}`);
    }

    const initialMode =
        sp.mode === "edit" || sp.mode === "history" ? sp.mode : "read";

    return (
        <WikiPageView
            slug={slug}
            initialDocument={doc ?? undefined}
            initialMode={initialMode}
        />
    );
}
