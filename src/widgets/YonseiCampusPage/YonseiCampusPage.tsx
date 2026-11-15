"use client";

import React, {useMemo} from "react";
import {getSeedWikiPage, type WikiPageDocument, YONSEI_MIRAE_WIKI_SLUG} from "@entities/wiki";
import {WikiPageView} from "@widgets/WikiPage";

export interface YonseiCampusPageProps {
    initialDocument?: WikiPageDocument;
}

export function YonseiCampusPage({initialDocument}: YonseiCampusPageProps) {
    const fallbackSeed = useMemo(
        () => initialDocument ?? getSeedWikiPage(YONSEI_MIRAE_WIKI_SLUG) ?? undefined,
        [initialDocument]
    );

    return (
        <WikiPageView
            slug={YONSEI_MIRAE_WIKI_SLUG}
            initialDocument={fallbackSeed}
        />
    );
}

export default YonseiCampusPage;
