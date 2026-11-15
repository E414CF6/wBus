import type {WikiPageDocument} from "../types";
import {
    createWonjuStationSeed,
    createWonjuTerminalSeed,
    WONJU_STATION_WIKI_SLUG,
    WONJU_TERMINAL_WIKI_SLUG,
} from "./wonjuHubSeeds";
import {createYonseiMiraeSeed, YONSEI_MIRAE_WIKI_SLUG} from "./yonseiMiraeSeed";

export {YONSEI_MIRAE_WIKI_SLUG, WONJU_TERMINAL_WIKI_SLUG, WONJU_STATION_WIKI_SLUG};

export function getSeedWikiPages(): WikiPageDocument[] {
    return [
        createYonseiMiraeSeed(),
        createWonjuTerminalSeed(),
        createWonjuStationSeed(),
    ];
}

export function getSeedWikiPage(slug: string): WikiPageDocument | null {
    const normalized = slug.trim();
    return getSeedWikiPages().find((p) => p.slug === normalized) ?? null;
}

export const PINNED_WIKI_SLUGS = new Set<string>([
    YONSEI_MIRAE_WIKI_SLUG,
    WONJU_TERMINAL_WIKI_SLUG,
    WONJU_STATION_WIKI_SLUG,
]);
