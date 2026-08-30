import {ROUTE_CONFIG} from "@/data/yonseiRoutes";

export interface RouteMeta {
    routeNo: string;
    origin: string;
    destination: string;
    description?: string;
    viaStops?: string;
    isYonsei?: boolean;
    category: RouteCategory;
}

export type RouteCategory =
    | "ALL"
    | "BOOKMARKS"
    | "YONSEI"
    | "1_19"
    | "20_49"
    | "50_99"
    | "100_PLUS"
    | "PUBLIC";

export const YONSEI_ROUTE_SET = new Set(["30", "34", "34-1"]);

export const STATIC_ROUTE_METADATA: Record<string, { origin: string; destination: string; description?: string }> = {
    "2": {origin: "관설동종점", destination: "횡성", description: "관설동 ↔ 원주역 ↔ 횡성"},
    "2-1": {origin: "관설동종점", destination: "횡성", description: "관설동 ↔ 남부시장 ↔ 횡성"},
    "3": {origin: "장양리", destination: "장양리 (순환)", description: "장양리 순환"},
    "3-1": {origin: "장양리", destination: "장양리 (순환)", description: "장양리 순환"},
    "4": {origin: "장양리", destination: "장양리 (순환)", description: "장양리 순환"},
    "4-1": {origin: "장양리", destination: "장양리 (순환)", description: "장양리 순환"},
    "5-2": {origin: "관설동종점", destination: "태장동", description: "관설동 ↔ 태장동"},
    "6": {origin: "관설동종점", destination: "태장주공1단지", description: "관설동 ↔ 남부시장 ↔ 태장주공"},
    "7": {origin: "관설동종점", destination: "태장주공1단지", description: "관설동 ↔ 원주역 ↔ 태장주공"},
    "8": {origin: "관설동종점", destination: "성문사입구", description: "관설동 ↔ 터미널 ↔ 성문사"},
    "10": {origin: "관설동종점", destination: "한라비발디", description: "관설동 ↔ 구곡 ↔ 한라비발디"},
    "13": {origin: "장양리", destination: "성문사입구", description: "장양리 ↔ 터미널 ↔ 성문사"},
    "16": {origin: "장양리", destination: "장양리 (순환)", description: "장양리 순환 (시내순환)"},
    "16-1": {origin: "장양리", destination: "장양리 (순환)", description: "장양리 순환 (반대방향)"},
    "18": {origin: "관설동종점", destination: "한라대학교", description: "관설동 ↔ 남부시장 ↔ 한라대"},
    "21": {origin: "장양리", destination: "학산종점", description: "장양리 ↔ 터미널 ↔ 학산"},
    "22": {origin: "장양리", destination: "구학", description: "장양리 ↔ 신림 ↔ 구학"},
    "23": {origin: "장양리", destination: "성남종점", description: "장양리 ↔ 신림 ↔ 성남"},
    "24": {origin: "장양리", destination: "운학", description: "장양리 ↔ 신림 ↔ 운학"},
    "25": {origin: "장양리", destination: "주천", description: "장양리 ↔ 신림 ↔ 주천"},
    "30": {
        origin: "장양리",
        destination: "연세대",
        description: ROUTE_CONFIG["30"]?.description || "장양리 ↔ 터미널 ↔ 원주역 ↔ 연세대",
    },
    "31": {origin: "장양리", destination: "귀래·운남·용암", description: "장양리 ↔ 터미널 ↔ 귀래"},
    "32": {origin: "장양리", destination: "서곡리", description: "장양리 ↔ 터미널 ↔ 서곡리"},
    "34": {
        origin: "장양리",
        destination: "연세대",
        description: ROUTE_CONFIG["34"]?.description || "장양리 ↔ 남부시장 ↔ 한라대/흥업 ↔ 연세대",
    },
    "34-1": {
        origin: "장양리",
        destination: "회촌 (연세대 경유)",
        description: ROUTE_CONFIG["34-1"]?.description || "장양리 ↔ 원주역 ↔ 연세대 ↔ 매지리/회촌",
    },
    "41": {origin: "관설동종점", destination: "구룡사", description: "관설동 ↔ 중앙시장 ↔ 치악산 구룡사"},
    "41-2": {origin: "관설동종점", destination: "구룡사", description: "관설동 ↔ 혁신도시 ↔ 치악산 구룡사"},
    "50": {origin: "장양리", destination: "문막공단", description: "장양리 ↔ 터미널 ↔ 문막공단"},
    "51": {origin: "관설동종점", destination: "문막읍", description: "관설동 ↔ 원주역 ↔ 문막"},
    "51-1": {origin: "관설동종점", destination: "문막읍", description: "관설동 ↔ 터미널 ↔ 문막"},
    "52-1": {origin: "관설동종점", destination: "기업도시", description: "관설동 ↔ 터미널 ↔ 기업도시"},
    "55": {origin: "관설동종점", destination: "부론", description: "관설동 ↔ 문막 ↔ 부론"},
    "55-1": {origin: "관설동종점", destination: "부론", description: "관설동 ↔ 문막 ↔ 부론"},
    "56": {origin: "관설동종점", destination: "월송리", description: "관설동 ↔ 지정 ↔ 월송리"},
    "57": {origin: "관설동종점", destination: "상구현", description: "관설동 ↔ 지정 ↔ 상구현"},
    "58": {origin: "관설동종점", destination: "양동", description: "관설동 ↔ 지정 ↔ 양동역"},
    "59": {origin: "관설동종점", destination: "판대", description: "관설동 ↔ 간현 ↔ 판대"},
    "81": {origin: "장양리", destination: "미래고", description: "장양리 ↔ 중앙시장 ↔ 미래고"},
    "82": {origin: "장양리", destination: "하초구", description: "장양리 ↔ 소초 ↔ 하초구"},
    "90": {origin: "장양리", destination: "한라대학교", description: "장양리 ↔ 터미널 ↔ 한라대"},
    "100": {origin: "관설동종점", destination: "기업도시", description: "관설동 ↔ 혁신도시 ↔ 터미널 ↔ 기업도시"},
    "100-2": {origin: "당둔지승강장", destination: "기업도시", description: "혁신도시 ↔ 기업도시"},
    "111": {origin: "관설동종점", destination: "롯데캐슬2차", description: "관설동 ↔ 혁신도시 ↔ 기업도시"},
};

/**
 * Categorize route by route number
 */
export function getRouteCategory(route: string): RouteCategory {
    if (YONSEI_ROUTE_SET.has(route)) return "YONSEI";
    if (route.startsWith("공영") || route.includes("순환") || route.includes("조조")) return "PUBLIC";
    const num = parseInt(route, 10);
    if (isNaN(num)) return "ALL";
    if (num < 20) return "1_19";
    if (num < 50) return "20_49";
    if (num < 100) return "50_99";
    return "100_PLUS";
}

/**
 * Return human-friendly metadata for a given route name
 */
export function getRouteMeta(routeName: string): RouteMeta {
    const isYonsei = YONSEI_ROUTE_SET.has(routeName);
    const yonseiConfig = ROUTE_CONFIG[routeName];
    const staticInfo = STATIC_ROUTE_METADATA[routeName];

    const origin = yonseiConfig?.originLabel?.replace(" 출발", "") || staticInfo?.origin || "원주";
    const destination = yonseiConfig?.destLabel?.replace(" 출발", "") || staticInfo?.destination || "원주";
    const description = yonseiConfig?.description || staticInfo?.description || `${origin} ↔ ${destination}`;
    const viaStops = yonseiConfig?.viaStops;

    return {
        routeNo: routeName,
        origin,
        destination,
        description,
        viaStops,
        isYonsei,
        category: getRouteCategory(routeName),
    };
}
