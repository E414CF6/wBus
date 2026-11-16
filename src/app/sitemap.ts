import type {MetadataRoute} from "next";
import {listWikiPages} from "@entities/wiki/server";
import {SITE_CONFIG} from "@shared/config/env";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const baseUrl = SITE_CONFIG.METADATA.BASE_URL;
    const lastModified = new Date();
    let wikiEntries: MetadataRoute.Sitemap;
    try {
        const index = await listWikiPages({limit: 100});
        wikiEntries = index.pages.map((page) => ({
            url: `${baseUrl}/?wiki=${encodeURIComponent(page.slug)}`,
            lastModified: new Date(page.updatedAt),
            changeFrequency: "daily" as const,
            priority: 0.8,
        }));
    } catch {
        wikiEntries = [];
    }

    return [
        {
            url: baseUrl,
            lastModified,
            changeFrequency: "hourly",
            priority: 1.0,
        },
        ...wikiEntries,
        {
            url: `${baseUrl}/privacy`,
            lastModified,
            changeFrequency: "monthly",
            priority: 0.3,
        },
        {
            url: `${baseUrl}/terms`,
            lastModified,
            changeFrequency: "monthly",
            priority: 0.3,
        },
    ];
}
