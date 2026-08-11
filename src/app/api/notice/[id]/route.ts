import type {NoticeDetail} from "@entities/notice/types";
import {buildCacheControl} from "@shared/cache/cachePolicy";
import {getCachedOrFetch} from "@shared/redis/client";
import {NextResponse} from "next/server";

export const dynamic = "force-dynamic";

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
    const writer = writerMatch ? writerMatch[1].replace(/<[^>]+>/g, "").trim() : "원주시";
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
            return NextResponse.json({error: "유효하지 않은 게시글 ID입니다."}, {status: 400});
        }

        const cacheKey = `notice:detail:${id}`;
        const cacheOptions = {
            ttlSeconds: 1800, // 30 min cache for notice details
            staleWhileRevalidateSeconds: 3600, staleIfErrorSeconds: 86400,
        };

        const result = await getCachedOrFetch<NoticeDetail>(cacheKey, () => fetchNoticeDetailFromOrigin(id), cacheOptions);

        const cacheControl = buildCacheControl({
            ttlSeconds: 1800, staleWhileRevalidateSeconds: 3600,
        });

        return NextResponse.json(result, {
            headers: {
                "Cache-Control": cacheControl, ...(result.meta ? {
                    "X-Cache-Status": result.meta.status, "X-Cache-Layer": result.meta.layer,
                } : {}),
            },
        });
    } catch (error) {
        console.error("[API /api/notice/[id]]", error);
        return NextResponse.json({error: "공지사항 상세 정보를 불러오는 데 실패했습니다."}, {status: 500});
    }
}
