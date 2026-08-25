import type {NoticeDetail} from "@entities/notice/types";
import {CacheManager} from "@shared/cache/CacheManager";
import {buildCacheControl} from "@shared/cache/cachePolicy";
import {UI_TEXT} from "@shared/config/locale";
import {NextResponse} from "next/server";

export const dynamic = "force-dynamic";

const noticeDetailCache = new CacheManager<NoticeDetail>(100);

const CACHE_CONTROL = buildCacheControl({
    ttlSeconds: 1800,
    maxAgeSeconds: 300,
    sMaxAgeSeconds: 3600,
    staleWhileRevalidateSeconds: 3600,
    staleIfErrorSeconds: 86400,
});

async function fetchNoticeDetailFromOrigin(id: string): Promise<NoticeDetail> {
    const url = `http://its.wonju.go.kr/center/noticeView.do?bdIdx=${encodeURIComponent(id)}`;
    const res = await fetch(url, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
        }, cache: "no-store",
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch notice detail for bdIdx=${id}: status ${res.status}`);
    }

    const html = await res.text();

    const titleMatch = html.match(/<p class="title">([\s\S]*?)<\/p>/i);
    const writerMatch = html.match(/<span class="writer">([\s\S]*?)<\/span>/i);
    const dateMatch = html.match(/<span class="date">([\s\S]*?)<\/span>/i);
    const hitMatch = html.match(/<span class="hit">([\s\S]*?)<\/span>/i);
    const contMatch = html.match(/<div class="cont_area">([\s\S]*?)<\/div>/i);

    const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
    const writer = writerMatch ? writerMatch[1].replace(/<[^>]+>/g, "").trim() : UI_TEXT.NOTICE.DEFAULT_WRITER;
    const date = dateMatch ? dateMatch[1].replace(/<[^>]+>/g, "").trim() : "";
    const views = hitMatch ? hitMatch[1].replace(/<[^>]+>/g, "").trim() : "0";

    // Clean up content HTML slightly (make relative URLs absolute if needed)
    let content = contMatch ? contMatch[1].trim() : "";
    content = content.replace(/src="\/(?!\/)/gi, 'src="http://its.wonju.go.kr/');

    // Attachments
    const fileAreaMatch = html.match(/<div class="file_area">([\s\S]*?)<\/div>/i);
    const files: { url: string; name: string }[] = [];
    if (fileAreaMatch) {
        const fileMatches = [...fileAreaMatch[1].matchAll(/<a href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi)];
        fileMatches.forEach(m => {
            let fileUrl = m[1];
            if (fileUrl.startsWith("/")) {
                fileUrl = `http://its.wonju.go.kr${fileUrl}`;
            }
            files.push({
                url: fileUrl, name: m[2].replace(/<[^>]+>/g, "").trim(),
            });
        });
    }

    // Prev / Next notice
    const prevMatch = html.match(/<dl class="prev">[\s\S]*?<a href="\/center\/noticeView\.do\?bdIdx=(\d+)"[^>]*>([\s\S]*?)<\/a>/i);
    const nextMatch = html.match(/<dl class="next">[\s\S]*?<a href="\/center\/noticeView\.do\?bdIdx=(\d+)"[^>]*>([\s\S]*?)<\/a>/i);

    return {
        id,
        num: "",
        isNotice: false,
        title,
        writer,
        date,
        views,
        hasFile: files.length > 0,
        content,
        files,
        prevId: prevMatch ? prevMatch[1] : undefined,
        prevTitle: prevMatch ? prevMatch[2].replace(/<[^>]+>/g, "").trim() : undefined,
        nextId: nextMatch ? nextMatch[1] : undefined,
        nextTitle: nextMatch ? nextMatch[2].replace(/<[^>]+>/g, "").trim() : undefined,
    };
}

export async function GET(_request: Request, {params}: { params: Promise<{ id: string }> }) {
    try {
        const resolvedParams = await params;
        const id = resolvedParams.id;

        if (!id || !/^\d+$/.test(id)) {
            return NextResponse.json({error: UI_TEXT.NOTICE.ERROR_INVALID_ID}, {status: 400});
        }

        const cached = noticeDetailCache.get(id);
        if (cached) {
            return NextResponse.json(
                {data: cached, timestamp: Date.now(), meta: {status: "hit", layer: "memory"}},
                {
                    headers: {
                        "Cache-Control": CACHE_CONTROL,
                        "X-Cache-Status": "hit",
                        "X-Cache-Layer": "memory",
                    },
                }
            );
        }

        const data = await fetchNoticeDetailFromOrigin(id);
        noticeDetailCache.set(id, data);

        return NextResponse.json(
            {data, timestamp: Date.now(), meta: {status: "miss", layer: "memory"}},
            {
                headers: {
                    "Cache-Control": CACHE_CONTROL,
                    "X-Cache-Status": "miss",
                    "X-Cache-Layer": "memory",
                },
            }
        );
    } catch (error) {
        console.error("[API /api/notice/[id]]", error);
        return NextResponse.json({error: UI_TEXT.NOTICE.ERROR_FETCH_DETAIL}, {status: 500});
    }
}

