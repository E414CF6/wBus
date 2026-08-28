import { NoticeDetail, NoticeItem, NoticeListResponse } from "@/types/notice";

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
const listCache = new Map<
  string,
  { data: NoticeListResponse; expiresAt: number }
>();
const detailCache = new Map<string, { data: NoticeDetail; expiresAt: number }>();

const LIST_TTL_MS = 5 * 60 * 1000; // 5 mins
const DETAIL_TTL_MS = 30 * 60 * 1000; // 30 mins

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
    throw new Error(`Failed to fetch notice list from Wonju ITS (Status: ${res.status})`);
  }

  const html = await res.text();

  // Extract total count
  let totalCount = 0;
  const totalMatch = html.match(
    /총\s*게시물[\s\S]*?<span[^>]*class="num"[^>]*>(\d+)<\/span>/i
  );
  if (totalMatch) {
    totalCount = parseInt(totalMatch[1], 10);
  }

  // Extract notice table rows
  const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
  const notices: NoticeItem[] = [];

  if (tbodyMatch) {
    const trMatches = [
      ...tbodyMatch[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi),
    ];
    for (const tr of trMatches) {
      const trHtml = tr[1];
      const isNotice =
        /class="notice"/i.test(trHtml) || /tbl_notice/i.test(tr[0]);

      const bdIdxMatch = trHtml.match(/bdIdx=(\d+)/i);
      const id = bdIdxMatch ? bdIdxMatch[1] : "";
      if (!id) continue;

      const numMatch = trHtml.match(/<span class="num">(\d+)<\/span>/i);
      const num = isNotice ? "공지" : numMatch ? numMatch[1] : "";

      const titleMatch = trHtml.match(
        /<span class="title"><a[^>]*>([\s\S]*?)<\/a><\/span>/i
      );
      const title = titleMatch
        ? titleMatch[1].replace(/<[^>]+>/g, "").trim()
        : "";

      const hasFile = /class="file"/i.test(trHtml);

      const tds = [
        ...trHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi),
      ].map((m) => m[1].replace(/<[^>]+>/g, "").trim());
      const date = tds.find((t) => /^\d{4}-\d{2}-\d{2}$/.test(t)) || "";
      const views =
        tds.length >= 5
          ? tds[4]
          : tds.find((t) => /^[\d,]+$/.test(t) && !/^\d{4}$/.test(t)) || "0";

      notices.push({
        id,
        num,
        isNotice,
        title,
        hasFile,
        date,
        views,
      });
    }
  }

  const result: NoticeListResponse = {
    notices,
    totalCount: totalCount || notices.length,
    page,
  };

  listCache.set(cacheKey, {
    data: result,
    expiresAt: Date.now() + LIST_TTL_MS,
  });

  return result;
}

/**
 * Scrapes notice detail from Wonju ITS by bdIdx.
 */
export async function scrapeWonjuNoticeDetail(id: string): Promise<NoticeDetail> {
  const cached = detailCache.get(id);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.data;
  }

  const url = `${NOTICE_VIEW_URL}?bdIdx=${encodeURIComponent(id)}`;
  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch notice detail for bdIdx=${id} (Status: ${res.status})`);
  }

  const html = await res.text();

  const titleMatch = html.match(/<p class="title">([\s\S]*?)<\/p>/i);
  const writerMatch = html.match(/<span class="writer">([\s\S]*?)<\/span>/i);
  const dateMatch = html.match(/<span class="date">([\s\S]*?)<\/span>/i);
  const hitMatch = html.match(/<span class="hit">([\s\S]*?)<\/span>/i);
  const contMatch = html.match(/<div class="cont_area">([\s\S]*?)<\/div>/i);

  const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
  const writer = writerMatch
    ? writerMatch[1].replace(/<[^>]+>/g, "").trim()
    : "원주시";
  const date = dateMatch ? dateMatch[1].replace(/<[^>]+>/g, "").trim() : "";
  const views = hitMatch ? hitMatch[1].replace(/<[^>]+>/g, "").trim() : "0";

  // Clean up content HTML slightly (make relative URLs absolute)
  let content = contMatch ? contMatch[1].trim() : "";
  content = content.replace(
    /src="\/(?!\/)/gi,
    'src="http://its.wonju.go.kr/'
  );

  // Attachments
  const fileAreaMatch = html.match(/<div class="file_area">([\s\S]*?)<\/div>/i);
  const files: { url: string; name: string }[] = [];
  if (fileAreaMatch) {
    const fileMatches = [
      ...fileAreaMatch[1].matchAll(/<a href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi),
    ];
    fileMatches.forEach((m) => {
      let fileUrl = m[1];
      if (fileUrl.startsWith("/")) {
        fileUrl = `http://its.wonju.go.kr${fileUrl}`;
      }
      files.push({
        url: fileUrl,
        name: m[2].replace(/<[^>]+>/g, "").trim(),
      });
    });
  }

  // Prev / Next notice
  const prevMatch = html.match(
    /<dl class="prev">[\s\S]*?<a href="\/center\/noticeView\.do\?bdIdx=(\d+)"[^>]*>([\s\S]*?)<\/a>/i
  );
  const nextMatch = html.match(
    /<dl class="next">[\s\S]*?<a href="\/center\/noticeView\.do\?bdIdx=(\d+)"[^>]*>([\s\S]*?)<\/a>/i
  );

  const detail: NoticeDetail = {
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

  detailCache.set(id, {
    data: detail,
    expiresAt: Date.now() + DETAIL_TTL_MS,
  });

  return detail;
}
