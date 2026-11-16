import type {MetadataRoute} from "next";
import {getSeedWikiPages} from "@entities/wiki";
import {SITE_CONFIG} from "@shared/config/env";

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = SITE_CONFIG.METADATA.BASE_URL;
    const lastModified = new Date();
    const wikiSeedEntries: MetadataRoute.Sitemap = getSeedWikiPages().map((page) => ({
        url: `${baseUrl}/wiki/${encodeURIComponent(page.slug)}`,
        lastModified,
        changeFrequency: "daily",
        priority: 0.9,
    }));

    return [
        {
            url: baseUrl,
            lastModified,
            changeFrequency: "hourly",
            priority: 1.0,
        },
        ...wikiSeedEntries,
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
