import {getCityByCode} from "@entities/city";
import {YONSEI_ROUTE_SET} from "@entities/route/routeMetadata";
import type {BusRoute} from "@entities/schedule";

export type WikiDocType =
    | "city"
    | "yonsei"
    | "yonsei-shuttle"
    | "route"
    | "notices"
    | "notice-detail";

export interface WikiDocDescriptor {
    docId: string;
    type: WikiDocType;
    title: string;
    shortTitle: string;
    namespace: string;
    cityCode: string;
    routeNo?: string;
    noticeId?: string;
    parentDocId: string | null;
    parentTitle: string | null;
    secondaryParentDocId?: string | null;
    secondaryParentTitle?: string | null;
    categories: Array<{ label: string; targetDocId: string }>;
}

export interface WikiBreadcrumbItem {
    docId: string;
    label: string;
}

export interface WikiSearchResultItem {
    docId: string;
    title: string;
    subtitle: string;
    badge: string;
}

/**
 * Normalizes a subTab or raw document identifier into a canonical WikiDocDescriptor.
 */
export function resolveWikiDoc(
    rawDocOrSubTab: string | undefined | null,
    defaultCityCode: string = "32020"
): WikiDocDescriptor {
    const city = getCityByCode(defaultCityCode);
    const input = (rawDocOrSubTab || "").trim();

    // 1. Yonsei Campus Transit Hub Document (only in Wonju 32020, or when explicitly requested)
    if (input === "yonsei" || input === "연세대학교 미래캠퍼스/교통") {
        return {
            docId: "yonsei",
            type: "yonsei",
            title: "연세대학교 미래캠퍼스/교통",
            shortTitle: "연세대 미래캠퍼스/교통",
            namespace: "대학 교통 문서",
            cityCode: "32020",
            parentDocId: "city:32020",
            parentTitle: "원주시 시내버스",
            categories: [
                {label: "원주시의 대중교통", targetDocId: "city:32020"},
                {label: "연세대학교 미래캠퍼스", targetDocId: "yonsei"},
                {label: "통학·캠퍼스 교통", targetDocId: "yonsei-shuttle"},
            ],
        };
    }

    // 2. Yonsei Free Shuttle Bus Document
    if (input === "yonsei-shuttle" || input === "shuttle" || input === "연세대학교 미래캠퍼스/셔틀버스") {
        return {
            docId: "yonsei-shuttle",
            type: "yonsei-shuttle",
            title: "연세대학교 미래캠퍼스/셔틀버스",
            shortTitle: "연세대 셔틀버스",
            namespace: "셔틀버스 문서",
            cityCode: "32020",
            parentDocId: "yonsei",
            parentTitle: "연세대학교 미래캠퍼스/교통",
            secondaryParentDocId: "city:32020",
            secondaryParentTitle: "원주시 시내버스",
            categories: [
                {label: "연세대학교 미래캠퍼스", targetDocId: "yonsei"},
                {label: "통학버스", targetDocId: "yonsei-shuttle"},
                {label: "원주시의 대중교통", targetDocId: "city:32020"},
            ],
        };
    }

    // 3. Wonju ITS Notice List Document
    if (input === "notices" || input === "원주시 교통정보센터/공지사항") {
        return {
            docId: "notices",
            type: "notices",
            title: "원주시 교통정보센터/공지사항",
            shortTitle: "교통 공지사항",
            namespace: "공지사항 문서",
            cityCode: "32020",
            parentDocId: "city:32020",
            parentTitle: "원주시 시내버스",
            categories: [
                {label: "원주시의 대중교통", targetDocId: "city:32020"},
                {label: "교통 공지사항", targetDocId: "notices"},
            ],
        };
    }

    // 4. Individual Notice Detail Document ("notice:{id}")
    if (input.startsWith("notice:")) {
        const noticeId = input.slice("notice:".length).trim();
        return {
            docId: `notice:${noticeId}`,
            type: "notice-detail",
            title: `원주시 교통정보센터/공지사항/#${noticeId}`,
            shortTitle: `공지 #${noticeId}`,
            namespace: "공지사항 상세 문서",
            cityCode: "32020",
            noticeId,
            parentDocId: "notices",
            parentTitle: "원주시 교통정보센터/공지사항",
            secondaryParentDocId: "city:32020",
            secondaryParentTitle: "원주시 시내버스",
            categories: [
                {label: "교통 공지사항", targetDocId: "notices"},
                {label: "원주시의 대중교통", targetDocId: "city:32020"},
            ],
        };
    }

    // 5. Individual Route Document ("route:{routeNo}" or "route:{cityCode}:{routeNo}")
    if (input.startsWith("route:")) {
        const rest = input.slice("route:".length).trim();
        let targetCityCode = city.code;
        let routeNo = rest;
        if (rest.includes(":")) {
            const parts = rest.split(":");
            targetCityCode = parts[0] || city.code;
            routeNo = parts.slice(1).join(":");
        }
        const routeCity = getCityByCode(targetCityCode);
        const routeShortCity = routeCity.name.split("/")[0];
        const isYonseiRoute = targetCityCode === "32020" && YONSEI_ROUTE_SET.has(routeNo);

        return {
            docId: `route:${routeNo}`,
            type: "route",
            title: `${routeShortCity} 시내버스/${routeNo}번`,
            shortTitle: `${routeNo}번`,
            namespace: "노선 상세 문서",
            cityCode: targetCityCode,
            routeNo,
            parentDocId: `city:${targetCityCode}`,
            parentTitle: `${routeShortCity} 시내버스`,
            secondaryParentDocId: isYonseiRoute ? "yonsei" : null,
            secondaryParentTitle: isYonseiRoute ? "연세대학교 미래캠퍼스/교통" : null,
            categories: [
                {label: `${routeShortCity} 시내버스 노선`, targetDocId: `city:${targetCityCode}`},
                ...(isYonseiRoute
                    ? [{label: "연세대학교 미래캠퍼스 경유 노선", targetDocId: "yonsei"}]
                    : []),
            ],
        };
    }

    // 6. Explicit City Document ("city:{cityCode}") or fallback ("all", "", etc.)
    let resolvedCityCode = city.code;
    if (input.startsWith("city:")) {
        const parsedCode = input.slice("city:".length).trim();
        if (parsedCode) {
            resolvedCityCode = getCityByCode(parsedCode).code;
        }
    }
    const targetCity = getCityByCode(resolvedCityCode);
    const targetShortCity = targetCity.name.split("/")[0];

    return {
        docId: `city:${targetCity.code}`,
        type: "city",
        title: `${targetShortCity} 시내버스`,
        shortTitle: `${targetShortCity} 시내버스`,
        namespace: "지역 대중교통 문서",
        cityCode: targetCity.code,
        parentDocId: null,
        parentTitle: null,
        categories: [
            {label: `${targetCity.province}의 시내버스`, targetDocId: `city:${targetCity.code}`},
            {label: `${targetShortCity}의 대중교통`, targetDocId: `city:${targetCity.code}`},
        ],
    };
}

/**
 * Builds the hierarchical breadcrumb trail for a given wiki document.
 */
export function getWikiBreadcrumbs(
    docId: string,
    defaultCityCode: string = "32020"
): WikiBreadcrumbItem[] {
    const desc = resolveWikiDoc(docId, defaultCityCode);
    const city = getCityByCode(desc.cityCode);
    const shortCityName = city.name.split("/")[0];
    const cityRoot: WikiBreadcrumbItem = {
        docId: `city:${city.code}`,
        label: `${shortCityName} 시내버스`,
    };

    if (desc.type === "city") {
        return [cityRoot];
    }

    if (desc.type === "yonsei") {
        return [
            cityRoot,
            {docId: "yonsei", label: "연세대학교 미래캠퍼스/교통"},
        ];
    }

    if (desc.type === "yonsei-shuttle") {
        return [
            cityRoot,
            {docId: "yonsei", label: "연세대학교 미래캠퍼스/교통"},
            {docId: "yonsei-shuttle", label: "셔틀버스"},
        ];
    }

    if (desc.type === "notices") {
        return [
            cityRoot,
            {docId: "notices", label: "교통정보센터/공지사항"},
        ];
    }

    if (desc.type === "notice-detail") {
        return [
            cityRoot,
            {docId: "notices", label: "교통정보센터/공지사항"},
            {docId: desc.docId, label: `#${desc.noticeId}`},
        ];
    }

    if (desc.type === "route") {
        const items: WikiBreadcrumbItem[] = [cityRoot];
        if (desc.secondaryParentDocId === "yonsei") {
            items.push({docId: "yonsei", label: "연세대학교 미래캠퍼스/교통"});
        }
        items.push({docId: desc.docId, label: `${desc.routeNo}번`});
        return items;
    }

    return [cityRoot];
}

/**
 * Searches available wiki documents (hub articles + route articles) by query string.
 */
export function searchWikiDocs(
    query: string,
    scheduleRoutes: BusRoute[],
    mapRouteNames: string[],
    cityCode: string = "32020"
): WikiSearchResultItem[] {
    const q = query.trim().toLowerCase();
    const city = getCityByCode(cityCode);
    const shortCity = city.name.split("/")[0];
    const isWonju = cityCode === "32020";

    const results: WikiSearchResultItem[] = [];

    // 1. Core Hub Articles
    const hubs: WikiSearchResultItem[] = [
        {
            docId: `city:${city.code}`,
            title: `${shortCity} 시내버스`,
            subtitle: `${city.name} 시내버스 노선 일람 및 시간표 대문 문서`,
            badge: "지역 문서",
        },
    ];

    if (isWonju) {
        hubs.push(
            {
                docId: "yonsei",
                title: "연세대학교 미래캠퍼스/교통",
                subtitle: "매지리 캠퍼스 시내버스(30, 34, 34-1번) 및 환승 종합 안내",
                badge: "캠퍼스 문서",
            },
            {
                docId: "yonsei-shuttle",
                title: "연세대학교 미래캠퍼스/셔틀버스",
                subtitle: "여주역 · 만종역 · 원주역 · 터미널 무료 통학 셔틀버스 시간표 및 승강장",
                badge: "셔틀 문서",
            },
            {
                docId: "notices",
                title: "원주시 교통정보센터/공지사항",
                subtitle: "시내버스 감회 · 우회 · 시간표 변경 공식 공지사항",
                badge: "공지 문서",
            }
        );
    }

    for (const hub of hubs) {
        if (
            !q ||
            hub.title.toLowerCase().includes(q) ||
            hub.subtitle.toLowerCase().includes(q) ||
            hub.badge.toLowerCase().includes(q)
        ) {
            results.push(hub);
        }
    }

    // 2. Deduplicated Route Articles
    const routeByNo = new Map<string, { origin: string; destination: string; dayTypes: string[] }>();
    for (const r of scheduleRoutes) {
        const existing = routeByNo.get(r.routeNo);
        if (existing) {
            if (!existing.dayTypes.includes(r.dayType)) {
                existing.dayTypes.push(r.dayType);
            }
        } else {
            routeByNo.set(r.routeNo, {
                origin: r.origin,
                destination: r.destination,
                dayTypes: [r.dayType],
            });
        }
    }

    for (const rName of mapRouteNames) {
        if (!routeByNo.has(rName)) {
            routeByNo.set(rName, {
                origin: shortCity,
                destination: "시내 순환/운행",
                dayTypes: ["상시"],
            });
        }
    }

    const sortedRouteNos = Array.from(routeByNo.keys()).sort((a, b) =>
        a.localeCompare(b, undefined, {numeric: true})
    );

    for (const routeNo of sortedRouteNos) {
        const info = routeByNo.get(routeNo)!;
        const title = `${shortCity} 시내버스/${routeNo}번`;
        const subtitle = `${info.origin} ↔ ${info.destination} (${info.dayTypes.join("·")})`;

        if (
            !q ||
            routeNo.toLowerCase().includes(q) ||
            title.toLowerCase().includes(q) ||
            subtitle.toLowerCase().includes(q)
        ) {
            results.push({
                docId: `route:${routeNo}`,
                title,
                subtitle,
                badge: `${routeNo}번 노선`,
            });
        }
    }

    return results.slice(0, 25);
}
