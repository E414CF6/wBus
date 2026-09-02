import type {NoticeDetail, NoticeItem, NoticeListResponse} from "./types";

const BASE_URL = "http://its.wonju.go.kr";
const NOTICE_LIST_URL = `${BASE_URL}/center/notice.do`;
const NOTICE_VIEW_URL = `${BASE_URL}/center/noticeView.do`;

const HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
};

// In-Memory cache with TTL
const listCache = new Map<string, { data: NoticeListResponse; expiresAt: number }>();
const detailCache = new Map<string, { data: NoticeDetail; expiresAt: number }>();

const LIST_TTL_MS = 10 * 60 * 1000; // 10 mins in memory
const DETAIL_TTL_MS = 2 * 60 * 60 * 1000; // 2 hours in memory

/**
 * Scrapes notice list from Wonju ITS.
 */
export async function scrapeWonjuNoticeList(
    page = 1,
    searchText = "",
    searchGb = "title"
): Promise<NoticeListResponse> {
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
    const res = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
        if (cached) {
            console.warn(`[NoticeScraper] Fetch failed (${res.status}), serving stale cached list.`);
            return cached.data;
        }
        throw new Error(`Failed to fetch notice list from Wonju ITS (Status: ${res.status})`);
    }

    const html = await res.text();

    // Match rows
    const rowRegex =
        /<tr[^>]*>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*class="[^"]*subject[^"]*"[^>]*>\s*<a[^>]*href="javascript:detailView\('([^']+)'\);"[^>]*>(.*?)<\/a>\s*<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<td[^>]*>(.*?)<\/td>\s*<\/tr>/gs;

    const notices: NoticeItem[] = [];
    let match: RegExpExecArray | null;

    while ((match = rowRegex.exec(html)) !== null) {
        const num = match[1].replace(/<[^>]+>/g, "").trim();
        const id = match[2].trim();
        const rawTitle = match[3].replace(/<[^>]+>/g, "").trim();
        const hasFile = match[3].includes("icon_file") || match[0].includes("icon_file");
        const date = match[5].replace(/<[^>]+>/g, "").trim();
        const views = match[6].replace(/<[^>]+>/g, "").trim();

        const isNotice = match[1].includes("icon_notice") || match[1].includes("공지");

        notices.push({
            id,
            num,
            isNotice,
            title: rawTitle,
            hasFile,
            date,
            views,
        });
    }

    const result: NoticeListResponse = {
        notices,
        page,
        totalCount: notices.length,
    };

    listCache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + LIST_TTL_MS,
    });

    return result;
}

/**
 * Scrapes notice detail from Wonju ITS.
 */
export async function scrapeWonjuNoticeDetail(id: string): Promise<NoticeDetail> {
    const cached = detailCache.get(id);
    if (cached && Date.now() < cached.expiresAt) {
        return cached.data;
    }

    const formData = new URLSearchParams();
    formData.set("boardId", id);

    const res = await fetch(NOTICE_VIEW_URL, {
        method: "POST",
        headers: {
            ...HEADERS,
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData.toString(),
        signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
        if (cached) {
            console.warn(`[NoticeScraper] Fetch failed (${res.status}), serving stale cached detail.`);
            return cached.data;
        }
        throw new Error(`Failed to fetch notice detail for ID ${id} (Status: ${res.status})`);
    }

    const html = await res.text();

    const titleMatch = html.match(
        /<th[^>]*class="[^"]*subject[^"]*"[^>]*>(.*?)<\/th>|<td[^>]*class="[^"]*subject[^"]*"[^>]*>(.*?)<\/td>/s
    );
    const title = titleMatch
        ? (titleMatch[1] || titleMatch[2] || "").replace(/<[^>]+>/g, "").trim()
        : "제목 없음";

    const dateMatch = html.match(/(\d{4}-\d{2}-\d{2})/);
    const date = dateMatch ? dateMatch[1] : "";

    const contentMatch = html.match(
        /<div[^>]*class="[^"]*(?:board_view_con|view_con|con_area)[^"]*"[^>]*>(.*?)<\/div>/s
    );
    let content = contentMatch ? contentMatch[1].trim() : "";

    if (!content) {
        const bodyContentMatch = html.match(/<td[^>]*colspan="[^"]*"[^>]*class="[^"]*view[^"]*"[^>]*>(.*?)<\/td>/s);
        if (bodyContentMatch) {
            content = bodyContentMatch[1].trim();
        }
    }

    // Clean up relative images/links to absolute
    content = content.replace(/src="\/([^"]+)"/g, `src="${BASE_URL}/$1"`);
    content = content.replace(/href="\/([^"]+)"/g, `href="${BASE_URL}/$1"`);

    const files: Array<{ name: string; url: string }> = [];
    const fileRegex = /<a[^>]*href="([^"]*(?:fileDown|download)[^"]*)"[^>]*>(.*?)<\/a>/gi;
    let fileMatch: RegExpExecArray | null;

    while ((fileMatch = fileRegex.exec(html)) !== null) {
        let downloadUrl = fileMatch[1];
        if (downloadUrl.startsWith("/")) {
            downloadUrl = `${BASE_URL}${downloadUrl}`;
        }
        const fileName = fileMatch[2].replace(/<[^>]+>/g, "").trim();
        if (fileName && !fileName.includes("이전") && !fileName.includes("다음")) {
            files.push({
                name: fileName,
                url: downloadUrl,
            });
        }
    }

    const detail: NoticeDetail = {
        id,
        num: id,
        isNotice: false,
        title,
        date,
        content,
        writer: "원주시 교통정보센터",
        views: "0",
        hasFile: files.length > 0,
        files,
    };

    detailCache.set(id, {
        data: detail,
        expiresAt: Date.now() + DETAIL_TTL_MS,
    });

    return detail;
}
