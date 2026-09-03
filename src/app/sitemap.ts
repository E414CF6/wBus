import type {MetadataRoute} from "next";
import {SITE_CONFIG} from "@shared/config/env";

export default function sitemap(): MetadataRoute.Sitemap {
    const baseUrl = SITE_CONFIG.METADATA.BASE_URL;
    const lastModified = new Date();

    return [{
        url: baseUrl, lastModified, changeFrequency: "hourly", priority: 1.0,
    }, {
        url: `${baseUrl}/schedule`, lastModified, changeFrequency: "daily", priority: 0.9,
    }, {
        url: `${baseUrl}/live`, lastModified, changeFrequency: "hourly", priority: 0.9,
    }, {
        url: `${baseUrl}/map`, lastModified, changeFrequency: "hourly", priority: 0.8,
    }, {
        url: `${baseUrl}/square`, lastModified, changeFrequency: "always", priority: 0.7,
    }, {
        url: `${baseUrl}/privacy`, lastModified, changeFrequency: "monthly", priority: 0.3,
    }, {
        url: `${baseUrl}/terms`, lastModified, changeFrequency: "monthly", priority: 0.3,
    },];
}
