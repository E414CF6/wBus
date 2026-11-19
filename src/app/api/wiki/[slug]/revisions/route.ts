import {type NextRequest, NextResponse} from "next/server";
import {isValidWikiSlug} from "@entities/wiki";
import {getWikiRevision, getWikiRevisionList} from "@entities/wiki/server";
import {UI_TEXT} from "@shared/config/locale";
import {decodeWikiSlug, handleWikiApiError, WIKI_NO_STORE_HEADERS} from "../../wikiApiUtils";

export const dynamic = "force-dynamic";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ slug: string }> }
) {
    try {
        const {slug: rawSlug} = await context.params;
        const slug = decodeWikiSlug(rawSlug);
        if (!isValidWikiSlug(slug)) {
            return NextResponse.json(
                {error: UI_TEXT.WIKI.API_ERRORS.INVALID_ADDRESS},
                {status: 400, headers: WIKI_NO_STORE_HEADERS}
            );
        }

        const revisions = await getWikiRevisionList(slug);
        if (revisions.length === 0) {
            return NextResponse.json(
                {error: UI_TEXT.WIKI.API_ERRORS.NOT_FOUND},
                {status: 404, headers: WIKI_NO_STORE_HEADERS}
            );
        }

        const versionParam = Number(request.nextUrl.searchParams.get("version"));
        const compareParam = Number(request.nextUrl.searchParams.get("compareTo"));

        const [selectedRevision, compareRevision] = await Promise.all([
            Number.isInteger(versionParam) && versionParam > 0
                ? getWikiRevision(slug, versionParam)
                : Promise.resolve(null),
            Number.isInteger(compareParam) && compareParam > 0
                ? getWikiRevision(slug, compareParam)
                : Promise.resolve(null),
        ]);

        return NextResponse.json(
            {
                slug,
                revisions,
                ...(selectedRevision ? {selectedRevision} : {}),
                ...(compareRevision ? {compareRevision} : {}),
            },
            {headers: WIKI_NO_STORE_HEADERS}
        );
    } catch (err) {
        return handleWikiApiError(err, UI_TEXT.WIKI.API_ERRORS.REVISIONS_FAILED);
    }
}
