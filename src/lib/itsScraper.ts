import {BusRoute, RouteDataset, TimetableEntry} from "@/types/bus";

const BASE_URL = "http://its.wonju.go.kr";
const LIST_URL = `${BASE_URL}/bus/bus04.do`;
const DETAIL_URL = `${BASE_URL}/bus/bus04Detail.do`;

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
};

const TARGET_RAW_NOS = ["30", "34(평일)", "34(방학,휴일)", "34-1(평일)", "34-1(방학,휴일)"];

export async function fetchList(filterYonseiOnly = false): Promise<{
    csrfToken: string;
    cookieStr: string;
    routes: BusRoute[];
}> {
    const res = await fetch(LIST_URL, {
        headers: HEADERS,
        signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch ITS list (Status: ${res.status})`);
    }

    const html = await res.text();

    // Extract CSRF token
    const csrfMatch = html.match(/name=["']CSRFToken["']\s+value=["']([^"']+)["']/);
    const csrfToken = csrfMatch ? csrfMatch[1] : "";

    // Extract cookies if any
    const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    const cookieStr = rawCookies.map((c) => c.split(";")[0]).join("; ");

    // Match table rows
    const rowRegex = /<tr[^>]*>\s*<td[^>]*onclick=["']goDetail\(['"]([^'"]+)['"]\);["'][^>]*>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<\/tr>/gs;

    const routes: BusRoute[] = [];
    let match: RegExpExecArray | null;

    while ((match = rowRegex.exec(html)) !== null) {
        const detailId = match[1].trim();
        const rawNo = match[2].replace(/<[^>]+>/g, "").trim();

        if (filterYonseiOnly) {
            const isTarget = TARGET_RAW_NOS.includes(rawNo) || rawNo.startsWith("30") || rawNo.startsWith("34");
            if (!isTarget) continue;
        }

        const cleanStationName = (name: string) =>
            name ? name.replace(/장양리시내버스공영(정류장)?/g, "장양리") : name;

        const origin = cleanStationName(match[3].replace(/<[^>]+>/g, "").trim());
        const destination = cleanStationName(match[4].replace(/<[^>]+>/g, "").trim());
        const firstBus = match[5].replace(/<[^>]+>/g, "").trim();
        const lastBus = match[6].replace(/<[^>]+>/g, "").trim();
        const runCount = match[7].replace(/<[^>]+>/g, "").trim();
        const interval = match[8].replace(/<[^>]+>/g, "").trim();

        let routeNo = rawNo;
        let dayType = "통상";
        const parenMatch = rawNo.match(/^([^(]+)(?:\(([^)]+)\))?/);
        if (parenMatch) {
            routeNo = parenMatch[1].trim();
            if (parenMatch[2]) {
                dayType = parenMatch[2].trim();
            }
        }

        routes.push({
            id: detailId,
            rawNo,
            routeNo,
            dayType,
            origin,
            destination,
            firstBus,
            lastBus,
            runCount,
            interval,
            timetable: [],
        });
    }

    return {csrfToken, cookieStr, routes};
}

export async function fetchDetail(
    detailId: string,
    csrfToken: string,
    cookieStr: string
): Promise<TimetableEntry[]> {
    const formData = new URLSearchParams();
    formData.append("CSRFToken", csrfToken);
    formData.append("no", detailId);

    const reqHeaders = {
        ...HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
        Referer: LIST_URL,
        Origin: BASE_URL,
        Cookie: cookieStr,
        "X-CSRF-TOKEN": csrfToken,
    };

    const res = await fetch(DETAIL_URL, {
        method: "POST",
        headers: reqHeaders,
        body: formData.toString(),
        signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch detail for ${detailId} (Status: ${res.status})`);
    }

    const html = await res.text();

    const tbodyMatch = html.match(/<tbody[^>]*>([\s\S]*?)<\/tbody>/i);
    if (!tbodyMatch) return [];

    const tbodyHtml = tbodyMatch[1];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const timetable: TimetableEntry[] = [];

    let trMatch: RegExpExecArray | null;
    while ((trMatch = trRegex.exec(tbodyHtml)) !== null) {
        const trContent = trMatch[1];
        const tdMatches = [...trContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
            m[1].replace(/<[^>]+>/g, "").trim()
        );

        if (tdMatches.length >= 4) {
            const seq = parseInt(tdMatches[0], 10) || timetable.length + 1;
            const originDepTime = tdMatches[1] || "-";
            const destDepTime = tdMatches[2] || "-";
            const type = tdMatches[3] || "공통";
            const notes = tdMatches[4] || "";

            timetable.push({seq, originDepTime, destDepTime, type, notes});
        }
    }

    return timetable;
}

/**
 * Scrapes all routes from Wonju ITS in concurrent batches (Default batch size: 8).
 */
export async function scrapeWonjuBusDataset(batchSize = 8): Promise<RouteDataset> {
    const startTime = Date.now();
    console.log("[ITS Scraper] Starting full scrape for all Wonju city bus routes...");

    const {csrfToken, cookieStr, routes} = await fetchList(false);
    console.log(`[ITS Scraper] Found ${routes.length} total routes in Wonju ITS. Crawling timetables in batches of ${batchSize}...`);

    for (let i = 0; i < routes.length; i += batchSize) {
        const batch = routes.slice(i, i + batchSize);
        await Promise.all(
            batch.map(async (route) => {
                try {
                    route.timetable = await fetchDetail(route.id, csrfToken, cookieStr);
                } catch (err) {
                    console.error(`[ITS Scraper] Failed to fetch timetable for route ${route.routeNo} (${route.id}):`, err instanceof Error ? err.message : err);
                    route.timetable = [];
                }
            })
        );
    }

    const dataset: RouteDataset = {
        updatedAt: new Date().toISOString(),
        sourceUrl: LIST_URL,
        totalRoutes: routes.length,
        routes,
    };

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[ITS Scraper] Successfully scraped all ${routes.length} routes in ${elapsed}s.`);

    return dataset;
}

/**
 * Scrapes only Yonsei University routes (30, 34, 34-1) quickly (< 1s).
 */
export async function scrapeWonjuItsYonsei(): Promise<RouteDataset> {
    const startTime = Date.now();
    console.log("[ITS Scraper] Starting fast scrape for Yonsei University bus routes...");

    const {csrfToken, cookieStr, routes} = await fetchList(true);
    console.log(`[ITS Scraper] Found ${routes.length} Yonsei routes. Crawling timetable details...`);

    await Promise.all(
        routes.map(async (route) => {
            try {
                route.timetable = await fetchDetail(route.id, csrfToken, cookieStr);
            } catch (err) {
                console.error(`[ITS Scraper] Failed to fetch timetable for ${route.id}:`, err instanceof Error ? err.message : err);
                route.timetable = [];
            }
        })
    );

    const dataset: RouteDataset = {
        updatedAt: new Date().toISOString(),
        sourceUrl: LIST_URL,
        totalRoutes: routes.length,
        routes,
    };

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[ITS Scraper] Successfully scraped ${routes.length} Yonsei routes in ${elapsed}s.`);

    return dataset;
}
