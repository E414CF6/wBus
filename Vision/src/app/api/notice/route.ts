import type {NoticeItem, NoticeListResponse} from "@entities/notice/types";
import {buildCacheControl} from "@shared/cache/cachePolicy";
import {getCachedOrFetch} from "@shared/redis/client";
import {NextResponse} from "next/server";

export const dynamic = "force-dynamic";

async function fetchNoticeListFromOrigin(page: number, searchText: string, searchGb: string): Promise<NoticeListResponse> {
    const params = new URLSearchParams();
    if (page > 1) params.set("pageNo", String(page));
    if (searchText) {
        params.set("searchText", searchText);
        params.set("searchGb", searchGb || "title");
    }

    const url = `http://its.wonju.go.kr/center/notice.do${params.toString() ? `?${params.toString()}` : ""}`;
    const res = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        }, cache: "no-store",
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch notice list from Wonju ITS: status ${res.status}`);
    }

    const html = await res.text();

    // Extract total count
    let totalCount = 0;
    const totalMatch = html.match(/총\s*게시물[\s\S]*?<span[^>]*class="num"[^>]*>(\d+)<\/span>/i);
    if (totalMatch) {
        totalCount = parseInt(totalMatch[1], 10);
    }

    // Extract notice table rows
    const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    const notices: NoticeItem[] = [];

    if (tbodyMatch) {
        const trMatches = [...tbodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];
        for (const tr of trMatches) {
            const trHtml = tr[1];
            const isNotice = /class="notice"/i.test(trHtml) || /tbl_notice/i.test(tr[0]);

            const bdIdxMatch = trHtml.match(/bdIdx=(\d+)/i);
            const id = bdIdxMatch ? bdIdxMatch[1] : "";
            if (!id) continue;

            const numMatch = trHtml.match(/<span class="num">(\d+)<\/span>/i);
            const num = isNotice ? "공지" : (numMatch ? numMatch[1] : "");

            const titleMatch = trHtml.match(/<span class="title"><a[^>]*>([\s\S]*?)<\/a><\/span>/i);
            const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";

            const hasFile = /class="file"/i.test(trHtml);

            const tds = [...trHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => m[1].replace(/<[^>]+>/g, "").trim());
            const date = tds.find(t => /^\d{4}-\d{2}-\d{2}$/.test(t)) || "";
            // The 5th td (index 4) is view count
            const views = tds.length >= 5 ? tds[4] : (tds.find(t => /^[\d,]+$/.test(t) && !/^\d{4}$/.test(t)) || "0");

            notices.push({
                id, num, isNotice, title, hasFile, date, views,
            });
        }
    }

    return {
        notices, totalCount: totalCount || notices.length, page,
    };
}

export async function GET(request: Request) {
    try {
        const {searchParams} = new URL(request.url);
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
        const searchText = (searchParams.get("searchText") || "").trim();
        const searchGb = (searchParams.get("searchGb") || "title").trim();

        const cacheKey = `notice:list:p${page}:q${encodeURIComponent(searchText)}:g${searchGb}`;
        const cacheOptions = {
            ttlSeconds: 300, // 5 min cache
            staleWhileRevalidateSeconds: 600, staleIfErrorSeconds: 3600,
        };

        const result = await getCachedOrFetch<NoticeListResponse>(cacheKey, () => fetchNoticeListFromOrigin(page, searchText, searchGb), cacheOptions);

        const cacheControl = buildCacheControl({
            ttlSeconds: 300, staleWhileRevalidateSeconds: 600,
        });

        return NextResponse.json(result, {
            headers: {
                "Cache-Control": cacheControl, ...(result.meta ? {
                    "X-Cache-Status": result.meta.status, "X-Cache-Layer": result.meta.layer,
                } : {}),
            },
        });
    } catch (error) {
        console.error("[API /api/notice]", error);
        return NextResponse.json({error: "알림마당 목록을 불러오는 데 실패했습니다."}, {status: 500});
    }
}
