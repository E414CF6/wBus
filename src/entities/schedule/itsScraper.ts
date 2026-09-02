import type {BusRoute, RouteDataset, TimetableEntry} from "@shared/types/bus";

const BASE_URL = "http://its.wonju.go.kr";
const LIST_URL = `${BASE_URL}/bus/bus04.do`;
const DETAIL_URL = `${BASE_URL}/bus/bus04Detail.do`;

const HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
};

const TARGET_RAW_NOS = [
    "30",
    "34(평일)",
    "34(방학,휴일)",
    "34-1(평일)",
    "34-1(방학,휴일)",
];

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
    const rowRegex =
        /<tr[^>]*>\s*<td[^>]*onclick=["']goDetail\(['"]([^'"]+)['"]\);["'][^>]*>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<\/tr>/gs;

    const routes: BusRoute[] = [];
    let match: RegExpExecArray | null;

    while ((match = rowRegex.exec(html)) !== null) {
        const detailId = match[1].trim();
        const rawNo = match[2].replace(/<[^>]+>/g, "").trim();

        if (filterYonseiOnly) {
            const isTarget =
                TARGET_RAW_NOS.includes(rawNo) ||
                rawNo.startsWith("30") ||
                rawNo.startsWith("34");
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
        let dayType = "매일";
        if (rawNo.includes("(")) {
            const parts = rawNo.split("(");
            routeNo = parts[0].trim();
            dayType = parts[1].replace(")", "").trim();
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
    if (csrfToken) formData.set("CSRFToken", csrfToken);
    formData.set("id", detailId);

    const headers: Record<string, string> = {
        ...HEADERS,
        "Content-Type": "application/x-www-form-urlencoded",
    };
    if (cookieStr) headers.Cookie = cookieStr;

    const res = await fetch(DETAIL_URL, {
        method: "POST",
        headers,
        body: formData.toString(),
        signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch ITS detail for ID ${detailId} (Status: ${res.status})`);
    }

    const html = await res.text();

    const rowRegex =
        /<tr[^>]*>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<td>(.*?)<\/td>\s*<\/tr>/gs;

    const timetable: TimetableEntry[] = [];
    let match: RegExpExecArray | null;

    while ((match = rowRegex.exec(html)) !== null) {
        const seqStr = match[1].replace(/<[^>]+>/g, "").trim();
        const seq = parseInt(seqStr, 10);
        if (isNaN(seq)) continue;

        const originDepTime = match[2].replace(/<[^>]+>/g, "").trim();
        const destDepTime = match[3].replace(/<[^>]+>/g, "").trim();
        const type = match[4].replace(/<[^>]+>/g, "").trim();
        const notes = match[5].replace(/<[^>]+>/g, "").trim();

        timetable.push({
            seq,
            originDepTime,
            destDepTime,
            type,
            notes,
        });
    }

    return timetable;
}

export async function scrapeWonjuBusDataset(filterYonseiOnly = false): Promise<RouteDataset> {
    const {csrfToken, cookieStr, routes} = await fetchList(filterYonseiOnly);

    // Concurrently fetch timetables in chunks of 5
    const CHUNK_SIZE = 5;
    for (let i = 0; i < routes.length; i += CHUNK_SIZE) {
        const chunk = routes.slice(i, i + CHUNK_SIZE);
        await Promise.all(
            chunk.map(async (r) => {
                try {
                    r.timetable = await fetchDetail(r.id, csrfToken, cookieStr);
                } catch (err) {
                    console.error(`Failed to fetch timetable for route ${r.rawNo}:`, err);
                }
            })
        );
    }

    return {
        updatedAt: new Date().toISOString(),
        sourceUrl: LIST_URL,
        totalRoutes: routes.length,
        routes,
    };
}

export async function scrapeWonjuItsYonsei(): Promise<RouteDataset> {
    return scrapeWonjuBusDataset(true);
}
