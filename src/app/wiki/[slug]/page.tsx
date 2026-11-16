import {redirect} from "next/navigation";

function decodeSlugParam(raw: string): string {
    try {
        return decodeURIComponent(raw).trim();
    } catch {
        return raw.trim();
    }
}

/**
 * Legacy standalone wiki URLs redirect seamlessly into the main map modal (`/?wiki=...`).
 */
export default async function WikiSlugRedirectPage({
                                                       params,
                                                   }: {
    params: Promise<{ slug: string }>;
}) {
    const {slug: rawSlug} = await params;
    const slug = decodeSlugParam(rawSlug);
    if (!slug) {
        redirect("/");
    }
    redirect(`/?wiki=${encodeURIComponent(slug)}`);
}
