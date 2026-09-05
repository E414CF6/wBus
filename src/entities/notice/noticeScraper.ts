import type {NoticeDetail, NoticeItem, NoticeListResponse} from "./types";
import {APP_LOCALE, UI_TEXT} from "@shared/config/locale";
import {CacheManager} from "@shared/cache/CacheManager";

const BASE_URL = "http://its.wonju.go.kr";
const NOTICE_LIST_URL = `${BASE_URL}/center/notice.do`;
const NOTICE_VIEW_URL = `${BASE_URL}/center/noticeView.do`;

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": APP_LOCALE.ACCEPT_LANGUAGE,
};

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

// In-Memory cache with LRU memory management
const listCache = new CacheManager<CacheEntry<NoticeListResponse>>(50);
const detailCache = new CacheManager<CacheEntry<NoticeDetail>>(200);

const LIST_TTL_MS = 10 * 60 * 1000; // 10 mins in memory
const DETAIL_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours in memory

/**
 * Scrapes notice list from Wonju ITS with retry and resilient caching.
 */
export async function scrapeWonjuNoticeList(page = 1, searchText = "", searchGb = "title", maxRetries = 3): Promise<NoticeListResponse> {
    const cacheKey = `p${page}:q${encodeURIComponent(searchText)}:g${searchGb}`;
    const cached = listCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.data;
    }

    const params = new URLSearchParams();
    if (page > 1) params.set("pageNo", String(page));
    if (searchText) {
        params.set("searchText", searchText);
        params.set("searchGb", searchGb || "title");
    }

    const url = `${NOTICE_LIST_URL}${params.toString() ? `?${params.toString()}` : ""}`;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch(url, {
                headers: HEADERS, signal: AbortSignal.timeout(12000),
            });

            if (!res.ok) {
                throw new Error(`Failed to fetch notice list from Wonju ITS (Status: ${res.status})`);
            }

            const html = await res.text();
            const notices: NoticeItem[] = [];

            // Extract table rows from tbody
            const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
            const tableHtml = tbodyMatch ? tbodyMatch[1] : html;

            const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
            let trMatch: RegExpExecArray | null;

            while ((trMatch = trRegex.exec(tableHtml)) !== null) {
                const row = trMatch[1];
                const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1].trim());
                if (tds.length < 4) continue;

                // Check if explicitly marked as pinned notice
                const isNotice = tds[0].includes("공지") || tds[0].includes("icon_notice") || tds[0].includes('class="notice"');

                const num = tds[0].replace(/<[^>]+>/g, "").trim() || (isNotice ? "공지" : "");

                // Find notice link and ID
                const linkMatch = tds[1].match(/href="[^"]*bdIdx=([^"&]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/i) || tds[1].match(/href="javascript:detailView\('([^']+)'\);"[^>]*>([\s\S]*?)<\/a>/i) || tds[1].match(/<a[^>]*>([\s\S]*?)<\/a>/i);

                const id = linkMatch ? (linkMatch[1] || "").trim() : "";
                const rawTitle = linkMatch ? linkMatch[2].replace(/<[^>]+>/g, "").trim() : tds[1].replace(/<[^>]+>/g, "").trim();

                if (!id || !rawTitle) continue;

                // Check attachment
                const hasFile = row.includes("icon_file") || row.includes('class="file"') || tds[2]?.includes("file") || tds[2]?.includes("첨부");

                // Date and views
                const date = tds[tds.length - 2]?.replace(/<[^>]+>/g, "").trim() || "";
                const views = tds[tds.length - 1]?.replace(/<[^>]+>/g, "").trim() || "0";

                notices.push({
                    id, num, isNotice, title: rawTitle, hasFile, date, views,
                });
            }

            // Extract totalPages and totalCount
            const paginateMatch = html.match(/<div[^>]*class=['"][^'"]*paginate[^'"]*['"][\s\S]*?<\/div>/i);
            const paginationHtml = paginateMatch ? paginateMatch[0] : "";
            const pageNums = [...paginationHtml.matchAll(/(?:goSearch\((\d+)\)|<strong>(\d+)<\/strong>)/g)]
                .map((m) => parseInt(m[1] || m[2], 10))
                .filter((n) => !isNaN(n));
            const totalPages = pageNums.length > 0 ? Math.max(...pageNums) : 1;

            let totalCount = notices.length;
            if (!searchText) {
                // If not searching, find highest regular notice number (e.g. 214)
                const firstRegular = notices.find((n) => !n.isNotice && /^\d+$/.test(n.num));
                if (firstRegular) {
                    totalCount = parseInt(firstRegular.num, 10);
                } else if (totalPages > 1) {
                    totalCount = totalPages * 10;
                }
            } else {
                totalCount = totalPages > 1 ? totalPages * 10 : notices.filter((n) => !n.isNotice).length;
            }

            const result: NoticeListResponse = {
                notices, page, totalPages, totalCount,
            };

            listCache.set(cacheKey, {
                data: result, expiresAt: Date.now() + LIST_TTL_MS,
            });

            return result;
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
            }
        }
    }

    if (cached) {
        console.warn("[NoticeScraper] Fetch failed after retries, serving stale cached list.");
        return cached.data;
    }

    throw lastError instanceof Error ? lastError : new Error("Failed to fetch notice list from Wonju ITS");
}

/**
 * Scrapes notice detail from Wonju ITS with retry and prev/next links.
 */
export async function scrapeWonjuNoticeDetail(id: string, maxRetries = 3): Promise<NoticeDetail> {
    const cached = detailCache.get(id);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.data;
    }

    const url = `${NOTICE_VIEW_URL}?bdIdx=${encodeURIComponent(id)}`;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch(url, {
                headers: HEADERS, signal: AbortSignal.timeout(12000),
            });

            if (!res.ok) {
                throw new Error(`Failed to fetch notice detail for ID ${id} (Status: ${res.status})`);
            }

            const html = await res.text();

            const titleMatch = html.match(/<p[^>]*class="[^"]*title[^"]*"[^>]*>([\s\S]*?)<\/p>/i) || html.match(/<th[^>]*class="[^"]*subject[^"]*"[^>]*>(.*?)<\/th>/i) || html.match(/<td[^>]*class="[^"]*subject[^"]*"[^>]*>(.*?)<\/td>/i);
            const title = titleMatch ? (titleMatch[1] || titleMatch[2] || "").replace(/<[^>]+>/g, "").trim() : "";

            const dateMatch = html.match(/<span[^>]*class="[^"]*date[^"]*"[^>]*>([^<]+)<\/span>/i) || html.match(/(\d{4}-\d{2}-\d{2})/);
            const date = dateMatch ? (dateMatch[1] || "").trim() : "";

            const writerMatch = html.match(/<span[^>]*class="[^"]*writer[^"]*"[^>]*>([^<]+)<\/span>/i);
            const writer = writerMatch ? writerMatch[1].trim() : UI_TEXT.NOTICE.DEFAULT_WRITER;

            const viewsMatch = html.match(/<span[^>]*class="[^"]*hit[^"]*"[^>]*>([^<]+)<\/span>/i);
            const views = viewsMatch ? viewsMatch[1].trim() : "0";

            const contentMatch = html.match(/<div[^>]*class="[^"]*cont_area[^"]*"[^>]*>([\s\S]*?)<\/div>/i) || html.match(/<div[^>]*class="[^"]*(?:board_view_con|view_con|con_area)[^"]*"[^>]*>(.*?)<\/div>/i);
            let content = contentMatch ? contentMatch[1].trim() : "";

            if (!content) {
                const bodyContentMatch = html.match(/<td[^>]*colspan="[^"]*"[^>]*class="[^"]*view[^"]*"[^>]*>(.*?)<\/td>/i);
                if (bodyContentMatch) {
                    content = bodyContentMatch[1].trim();
                }
            }

            // Clean up relative images/links to absolute
            content = content.replace(/src="\/([^"]+)"/g, `src="${BASE_URL}/$1"`);
            content = content.replace(/href="\/([^"]+)"/g, `href="${BASE_URL}/$1"`);

            const files: Array<{ name: string; url: string }> = [];
            const fileRegex = /<a[^>]*href="([^"]*(?:noticeAttach\.do|fileDown|download)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
            let fileMatch: RegExpExecArray | null;

            while ((fileMatch = fileRegex.exec(html)) !== null) {
                let downloadUrl = fileMatch[1];
                if (downloadUrl.startsWith("/")) {
                    downloadUrl = `${BASE_URL}${downloadUrl}`;
                }
                const fileName = fileMatch[2].replace(/<[^>]+>/g, "").trim();
                if (fileName && !fileName.includes("이전") && !fileName.includes("다음")) {
                    files.push({
                        name: fileName, url: downloadUrl,
                    });
                }
            }

            // Extract prev / next article links
            const prevMatch = html.match(/<dl[^>]*class=["']prev["'][^>]*>[\s\S]*?<a[^>]*href=["'][^"']*bdIdx=([^"'&]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
            const prevId = prevMatch ? prevMatch[1].trim() : undefined;
            const prevTitle = prevMatch ? prevMatch[2].replace(/<[^>]+>/g, "").trim() : undefined;

            const nextMatch = html.match(/<dl[^>]*class=["']next["'][^>]*>[\s\S]*?<a[^>]*href=["'][^"']*bdIdx=([^"'&]+)[^"']*["'][^>]*>([\s\S]*?)<\/a>/i);
            const nextId = nextMatch ? nextMatch[1].trim() : undefined;
            const nextTitle = nextMatch ? nextMatch[2].replace(/<[^>]+>/g, "").trim() : undefined;

            const detail: NoticeDetail = {
                id,
                num: id,
                isNotice: false,
                title,
                date,
                content,
                writer,
                views,
                hasFile: files.length > 0,
                files,
                prevId,
                prevTitle,
                nextId,
                nextTitle,
            };

            detailCache.set(id, {
                data: detail, expiresAt: Date.now() + DETAIL_TTL_MS,
            });

            return detail;
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
            }
        }
    }

    if (cached) {
        console.warn(`[NoticeScraper] Fetch failed after retries for ID ${id}, serving stale cached detail.`);
        return cached.data;
    }

    throw lastError instanceof Error ? lastError : new Error(`Failed to fetch notice detail for ID ${id}`);
}
