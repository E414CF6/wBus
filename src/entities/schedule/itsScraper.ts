import "server-only";

import {parse} from "node-html-parser";
import type {BusRoute, RouteDataset, TimetableEntry} from "./types";
import {APP_LOCALE} from "@shared/config/locale";

const BASE_URL = "http://its.wonju.go.kr";
const LIST_URL = `${BASE_URL}/bus/bus04.do`;
const DETAIL_URL = `${BASE_URL}/bus/bus04Detail.do`;

const HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": APP_LOCALE.ACCEPT_LANGUAGE,
};

const TARGET_RAW_NOS = ["30", "34(평일)", "34(방학,휴일)", "34-1(평일)", "34-1(방학,휴일)"];

function cleanStationName(name: string): string {
    return name ? name.replace(/장양리시내버스공영(정류장)?/g, "장양리") : name;
}

export function parseItsListHtml(html: string, filterYonseiOnly = false): {
    csrfToken: string;
    routes: BusRoute[];
} {
    const root = parse(html);
    const csrfInput = root.querySelector("input[name='CSRFToken']");
    const csrfToken = csrfInput?.getAttribute("value") || "";

    const routes: BusRoute[] = [];
    for (const tr of root.querySelectorAll("tr")) {
        const rowHtml = tr.innerHTML;
        const onclickMatch = rowHtml.match(/goDetail\(['"]([^'"]+)['"]\)/i);
        if (!onclickMatch) continue;

        const detailId = onclickMatch[1].trim();
        const tds = tr.querySelectorAll("td").map((td) => td.textContent.trim());
        if (tds.length < 7) continue;

        const rawNo = tds[0];
        if (filterYonseiOnly) {
            const isTarget = TARGET_RAW_NOS.includes(rawNo) || rawNo.startsWith("30") || rawNo.startsWith("34");
            if (!isTarget) continue;
        }

        const origin = cleanStationName(tds[1]);
        const destination = cleanStationName(tds[2]);
        const firstBus = tds[3] || "";
        const lastBus = tds[4] || "";
        const runCount = tds[5] || "";
        const interval = tds[6] || "";

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

    return {csrfToken, routes};
}

export function parseItsDetailHtml(html: string): TimetableEntry[] {
    const root = parse(html);
    const timetable: TimetableEntry[] = [];

    for (const tr of root.querySelectorAll("tr")) {
        const tds = tr.querySelectorAll("td").map((td) => td.textContent.trim());
        if (tds.length < 5) continue;

        const seq = parseInt(tds[0], 10);
        if (isNaN(seq)) continue;

        timetable.push({
            seq,
            originDepTime: tds[1],
            destDepTime: tds[2],
            type: tds[3],
            notes: tds[4],
        });
    }

    return timetable;
}

export async function fetchList(filterYonseiOnly = false, maxRetries = 3): Promise<{
    csrfToken: string; cookieStr: string; routes: BusRoute[];
}> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const res = await fetch(LIST_URL, {
                headers: HEADERS, signal: AbortSignal.timeout(12000),
            });

            if (!res.ok) {
                throw new Error(`Failed to fetch ITS list (Status: ${res.status})`);
            }

            const html = await res.text();
            const rawCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
            const cookieStr = rawCookies.map((c) => c.split(";")[0]).join("; ");

            const {csrfToken, routes} = parseItsListHtml(html, filterYonseiOnly);
            return {csrfToken, cookieStr, routes};
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
            }
        }
    }

    throw lastError instanceof Error ? lastError : new Error("Failed to fetch ITS route list after retries");
}

export async function fetchDetail(detailId: string, csrfToken: string, cookieStr: string, maxRetries = 3): Promise<TimetableEntry[]> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const formData = new URLSearchParams();
            if (csrfToken) formData.set("CSRFToken", csrfToken);
            formData.set("no", detailId);
            formData.set("id", detailId);

            const headers: Record<string, string> = {
                ...HEADERS, "Content-Type": "application/x-www-form-urlencoded",
            };
            if (cookieStr) headers.Cookie = cookieStr;

            const res = await fetch(DETAIL_URL, {
                method: "POST", headers, body: formData.toString(), signal: AbortSignal.timeout(12000),
            });

            if (!res.ok) {
                throw new Error(`Failed to fetch ITS detail for ID ${detailId} (Status: ${res.status})`);
            }

            const html = await res.text();
            return parseItsDetailHtml(html);
        } catch (err) {
            lastError = err;
            if (attempt < maxRetries) {
                await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
            }
        }
    }

    throw lastError instanceof Error ? lastError : new Error(`Failed to fetch timetable for route ID ${detailId}`);
}

export async function scrapeWonjuBusDataset(filterYonseiOnly = false): Promise<RouteDataset> {
    const {csrfToken, cookieStr, routes} = await fetchList(filterYonseiOnly);

    // Gently fetch timetables in chunks of 2 with small throttling to avoid overloading legacy server
    const CHUNK_SIZE = 2;
    for (let i = 0; i < routes.length; i += CHUNK_SIZE) {
        const chunk = routes.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (r) => {
            try {
                r.timetable = await fetchDetail(r.id, csrfToken, cookieStr);
            } catch (err) {
                console.error(`Failed to fetch timetable for route ${r.rawNo}:`, err);
            }
        }));
        if (i + CHUNK_SIZE < routes.length) {
            await new Promise((resolve) => setTimeout(resolve, 80));
        }
    }

    return {
        updatedAt: new Date().toISOString(), sourceUrl: LIST_URL, totalRoutes: routes.length, routes,
    };
}

export async function scrapeWonjuItsYonsei(): Promise<RouteDataset> {
    return scrapeWonjuBusDataset(true);
}
