import "server-only";

import {parse} from "node-html-parser";
import type {NoticeDetail, NoticeItem, NoticeListResponse} from "./types";
import {fetchWithRetry, SharedCircuitBreaker} from "@shared/api/upstreamClient";
import {APP_LOCALE, UI_TEXT} from "@shared/config/locale";
import {getCachedOrFetch} from "@shared/cache";
import {sanitizeHtml} from "@shared/utils/sanitizer";

const BASE_URL = "http://its.wonju.go.kr";
const NOTICE_LIST_URL = `${BASE_URL}/center/notice.do`;
const NOTICE_VIEW_URL = `${BASE_URL}/center/noticeView.do`;

const wonjuNoticeBreaker = new SharedCircuitBreaker("WonjuNotice", 5, 20_000);

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": APP_LOCALE.ACCEPT_LANGUAGE,
};

const NOTICE_LIST_CACHE_OPTIONS = {
    ttlSeconds: 600, // 10 minutes fresh
    staleWhileRevalidateSeconds: 1800, // 30 minutes SWR
    staleIfErrorSeconds: 86400, // 24 hours fallback on upstream failure
    useDistributedCache: true,
};

const NOTICE_DETAIL_CACHE_OPTIONS = {
    ttlSeconds: 7200, // 2 hours fresh
    staleWhileRevalidateSeconds: 86400, // 24 hours SWR
    staleIfErrorSeconds: 86400 * 7, // 7 days fallback
    useDistributedCache: true,
};

export function parseNoticeListHtml(html: string, page = 1, searchText = ""): NoticeListResponse {
    const root = parse(html);
    const notices: NoticeItem[] = [];

    const tbody = root.querySelector("tbody") ?? root;
    for (const tr of tbody.querySelectorAll("tr")) {
        const tds = tr.querySelectorAll("td");
        if (tds.length < 4) continue;

        const firstCellHtml = tds[0].innerHTML;
        const firstCellText = tds[0].textContent.trim();
        const isNotice =
            firstCellHtml.includes("공지") ||
            firstCellHtml.includes("icon_notice") ||
            firstCellHtml.includes('class="notice"') ||
            firstCellText.includes("공지");

        const num = firstCellText || (isNotice ? "공지" : "");

        const titleCell = tds[1];
        const titleCellHtml = titleCell.innerHTML;
        const anchor = titleCell.querySelector("a");
        const href = anchor?.getAttribute("href") || "";
        const onclick = anchor?.getAttribute("onclick") || "";

        let id = "";
        const bdIdxMatch = (href || titleCellHtml).match(/bdIdx=([a-zA-Z0-9_-]+)/i);
        const jsDetailMatch = (onclick || titleCellHtml).match(/detailView\(['"]([^'"]+)['"]\)/i);
        if (bdIdxMatch) {
            id = bdIdxMatch[1].trim();
        } else if (jsDetailMatch) {
            id = jsDetailMatch[1].trim();
        }

        const rawTitle = (anchor ? anchor.textContent : titleCell.textContent).trim();
        if (!id || !rawTitle) continue;

        const rowHtml = tr.innerHTML;
        const thirdCellHtml = tds[2]?.innerHTML || "";
        const thirdCellText = tds[2]?.textContent || "";
        const hasFile =
            rowHtml.includes("icon_file") ||
            rowHtml.includes('class="file"') ||
            thirdCellHtml.includes("file") ||
            thirdCellText.includes("첨부");

        const date = tds[tds.length - 2]?.textContent.trim() || "";
        const views = tds[tds.length - 1]?.textContent.trim() || "0";

        notices.push({
            id, num, isNotice, title: rawTitle, hasFile, date, views,
        });
    }

    const paginateEl = root.querySelector(".paginate");
    const paginationHtml = paginateEl ? paginateEl.innerHTML : "";
    const pageNums = [...paginationHtml.matchAll(/goSearch\((\d+)\)|<strong>(\d+)<\/strong>/g)]
        .map((m) => parseInt(m[1] || m[2], 10))
        .filter((n) => !isNaN(n));
    const totalPages = pageNums.length > 0 ? Math.max(...pageNums) : 1;

    let totalCount = notices.length;
    if (!searchText) {
        const firstRegular = notices.find((n) => !n.isNotice && /^\d+$/.test(n.num));
        if (firstRegular) {
            totalCount = parseInt(firstRegular.num, 10);
        } else if (totalPages > 1) {
            totalCount = totalPages * 10;
        }
    } else {
        totalCount = totalPages > 1 ? totalPages * 10 : notices.filter((n) => !n.isNotice).length;
    }

    return {
        notices, page, totalPages, totalCount,
    };
}

export function parseNoticeDetailHtml(html: string, id: string): NoticeDetail {
    const root = parse(html);

    const titleEl =
        root.querySelector("p.title, .title") ||
        root.querySelector("th.subject, td.subject");
    const title = titleEl ? titleEl.textContent.trim() : "";

    const dateEl = root.querySelector("span.date, .date");
    let date = dateEl ? dateEl.textContent.trim() : "";
    if (!date) {
        const dateFallback = html.match(/(\d{4}-\d{2}-\d{2})/);
        date = dateFallback ? dateFallback[1].trim() : "";
    }

    const writerEl = root.querySelector("span.writer, .writer");
    const writer = writerEl?.textContent.trim() || UI_TEXT.NOTICE.DEFAULT_WRITER;

    const viewsEl = root.querySelector("span.hit, .hit");
    const views = viewsEl?.textContent.trim() || "0";

    // DOM-balanced extraction avoids premature truncation on nested <div> tags
    const contentEl =
        root.querySelector(".cont_area") ||
        root.querySelector(".board_view_con, .view_con, .con_area") ||
        root.querySelector("td.view[colspan]");
    let content = contentEl ? contentEl.innerHTML.trim() : "";

    content = content.replace(/src="\/([^"]+)"/g, `src="${BASE_URL}/$1"`);
    content = content.replace(/href="\/([^"]+)"/g, `href="${BASE_URL}/$1"`);
    content = sanitizeHtml(content);

    const files: Array<{ name: string; url: string }> = [];
    for (const anchor of root.querySelectorAll("a")) {
        const href = anchor.getAttribute("href") || "";
        if (!/(?:noticeAttach\.do|fileDown|download)/i.test(href)) continue;

        const downloadUrl = href.startsWith("/") ? `${BASE_URL}${href}` : href;
        const fileName = anchor.textContent.trim();
        if (fileName && !fileName.includes("이전") && !fileName.includes("다음")) {
            files.push({name: fileName, url: downloadUrl});
        }
    }

    const prevAnchor = root.querySelector("dl.prev a");
    const prevHref = prevAnchor?.getAttribute("href") || "";
    const prevIdMatch = prevHref.match(/bdIdx=([^"'&]+)/i);
    const prevId = prevIdMatch ? prevIdMatch[1].trim() : undefined;
    const prevTitle = prevAnchor ? prevAnchor.textContent.trim() : undefined;

    const nextAnchor = root.querySelector("dl.next a");
    const nextHref = nextAnchor?.getAttribute("href") || "";
    const nextIdMatch = nextHref.match(/bdIdx=([^"'&]+)/i);
    const nextId = nextIdMatch ? nextIdMatch[1].trim() : undefined;
    const nextTitle = nextAnchor ? nextAnchor.textContent.trim() : undefined;

    return {
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
}

async function fetchNoticeHtml(url: string, errorPrefix: string, maxRetries = 3): Promise<string> {
    const res = await fetchWithRetry(url, {
        maxAttempts: maxRetries,
        baseDelayMs: 600,
        timeoutMs: 12_000,
        headers: HEADERS,
        circuitBreaker: wonjuNoticeBreaker,
    });

    if (!res.ok) {
        throw new Error(`${errorPrefix} (Status: ${res.status})`);
    }

    return res.text();
}

async function rawFetchNoticeList(page = 1, searchText = "", searchGb = "title", maxRetries = 3): Promise<NoticeListResponse> {
    const params = new URLSearchParams();
    if (page > 1) params.set("pageNo", String(page));
    if (searchText) {
        params.set("searchText", searchText);
        params.set("searchGb", searchGb || "title");
    }

    const url = `${NOTICE_LIST_URL}${params.toString() ? `?${params.toString()}` : ""}`;
    const html = await fetchNoticeHtml(url, "Failed to fetch notice list from Wonju ITS", maxRetries);
    return parseNoticeListHtml(html, page, searchText);
}

/**
 * Scrapes notice list from Wonju ITS with retry and unified resilient caching (SWR + Stale-if-error).
 */
export async function scrapeWonjuNoticeList(page = 1, searchText = "", searchGb = "title", maxRetries = 3): Promise<NoticeListResponse> {
    const cacheKey = `notice-list:p${page}:q${encodeURIComponent(searchText)}:g${searchGb}`;
    const result = await getCachedOrFetch<NoticeListResponse>(
        cacheKey,
        () => rawFetchNoticeList(page, searchText, searchGb, maxRetries),
        NOTICE_LIST_CACHE_OPTIONS
    );
    return result.data;
}

async function rawFetchNoticeDetail(id: string, maxRetries = 3): Promise<NoticeDetail> {
    const url = `${NOTICE_VIEW_URL}?bdIdx=${encodeURIComponent(id)}`;
    const html = await fetchNoticeHtml(url, `Failed to fetch notice detail for ID ${id}`, maxRetries);
    return parseNoticeDetailHtml(html, id);
}

/**
 * Scrapes notice detail from Wonju ITS with retry and unified resilient caching (SWR + Stale-if-error).
 */
export async function scrapeWonjuNoticeDetail(id: string, maxRetries = 3): Promise<NoticeDetail> {
    const cacheKey = `notice-detail:${id}`;
    const result = await getCachedOrFetch<NoticeDetail>(
        cacheKey,
        () => rawFetchNoticeDetail(id, maxRetries),
        NOTICE_DETAIL_CACHE_OPTIONS
    );
    return result.data;
}
