import type {MetadataRoute} from "next";
import {SITE_CONFIG} from "@shared/config/env";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*", allow: "/", disallow: ["/api/"],
        }, sitemap: `${SITE_CONFIG.METADATA.BASE_URL}/sitemap.xml`,
    };
}
