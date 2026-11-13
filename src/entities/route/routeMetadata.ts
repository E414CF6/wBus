import {classifyRouteType, type GenericRouteType, ROUTE_TYPE_COLORS, type RouteColorConfig} from "./routeColor";

export interface RouteMeta {
    routeNo: string;
    origin: string;
    destination: string;
    description?: string;
    isYonsei?: boolean;
    firstTime?: string;
    lastTime?: string;
    routeType?: string;
    genericType: GenericRouteType;
    colorTheme: RouteColorConfig;
}

export const YONSEI_ROUTE_SET = new Set(["30", "34", "34-1"]);

const STATIC_ROUTE_METADATA: Record<string, {
    origin: string;
    destination: string;
    description?: string;
    routeType?: string
}> = {
    "2": {origin: "관설동종점", destination: "횡성", description: "관설동 ↔ 원주역 ↔ 횡성", routeType: "일반버스"},
    "2-1": {origin: "관설동종점", destination: "횡성", description: "관설동 ↔ 남부시장 ↔ 횡성", routeType: "일반버스"},
    "3": {origin: "장양리", destination: "장양리 (순환)", description: "장양리 순환", routeType: "순환버스"},
    "3-1": {origin: "장양리", destination: "장양리 (순환)", description: "장양리 순환", routeType: "순환버스"},
    "4": {origin: "장양리", destination: "장양리 (순환)", description: "장양리 순환", routeType: "순환버스"},
    "4-1": {origin: "장양리", destination: "장양리 (순환)", description: "장양리 순환", routeType: "순환버스"},
    "5-2": {origin: "관설동종점", destination: "태장동", description: "관설동 ↔ 태장동", routeType: "일반버스"},
    "6": {origin: "관설동종점", destination: "태장주공1단지", description: "관설동 ↔ 남부시장 ↔ 태장주공", routeType: "일반버스"},
    "7": {origin: "관설동종점", destination: "태장주공1단지", description: "관설동 ↔ 원주역 ↔ 태장주공", routeType: "일반버스"},
    "8": {origin: "관설동종점", destination: "성문사입구", description: "관설동 ↔ 터미널 ↔ 성문사", routeType: "일반버스"},
    "10": {origin: "관설동종점", destination: "한라비발디", description: "관설동 ↔ 구곡 ↔ 한라비발디", routeType: "일반버스"},
    "13": {origin: "장양리", destination: "성문사입구", description: "장양리 ↔ 터미널 ↔ 성문사", routeType: "일반버스"},
    "16": {origin: "장양리", destination: "장양리 (순환)", description: "장양리 순환 (시내순환)", routeType: "순환버스"},
    "16-1": {origin: "장양리", destination: "장양리 (순환)", description: "장양리 순환 (반대방향)", routeType: "순환버스"},
    "18": {origin: "관설동종점", destination: "한라대학교", description: "관설동 ↔ 남부시장 ↔ 한라대", routeType: "일반버스"},
    "21": {origin: "장양리", destination: "학산종점", description: "장양리 ↔ 터미널 ↔ 학산", routeType: "일반버스"},
    "22": {origin: "장양리", destination: "구학", description: "장양리 ↔ 신림 ↔ 구학", routeType: "일반버스"},
    "23": {origin: "장양리", destination: "성남종점", description: "장양리 ↔ 신림 ↔ 성남", routeType: "일반버스"},
    "24": {origin: "장양리", destination: "운학", description: "장양리 ↔ 신림 ↔ 운학", routeType: "일반버스"},
    "25": {origin: "장양리", destination: "주천", description: "장양리 ↔ 신림 ↔ 주천", routeType: "일반버스"},
    "30": {
        origin: "장양리",
        destination: "연세대",
        description: "장양리 ↔ 터미널 ↔ 원주역 ↔ (상지대) ↔ 연세대 (매일 운행)",
        routeType: "일반버스",
    },
    "31": {origin: "장양리", destination: "귀래·운남·용암", description: "장양리 ↔ 터미널 ↔ 귀래", routeType: "일반버스"},
    "32": {origin: "장양리", destination: "서곡리", description: "장양리 ↔ 터미널 ↔ 서곡리", routeType: "일반버스"},
    "34": {
        origin: "장양리",
        destination: "연세대",
        description: "장양리 ↔ 남부시장 ↔ 의료원 ↔ 한라대/흥업 ↔ 연세대",
        routeType: "일반버스",
    },
    "34-1": {
        origin: "장양리",
        destination: "회촌",
        description: "장양리 ↔ 원주역 ↔ 남부시장 ↔ 연세대 ↔ 매지리/회촌",
        routeType: "일반버스",
    },
    "41": {origin: "관설동종점", destination: "구룡사", description: "관설동 ↔ 중앙시장 ↔ 치악산 구룡사", routeType: "일반버스"},
    "41-2": {origin: "관설동종점", destination: "구룡사", description: "관설동 ↔ 혁신도시 ↔ 치악산 구룡사", routeType: "일반버스"},
    "50": {origin: "장양리", destination: "문막공단", description: "장양리 ↔ 터미널 ↔ 문막공단", routeType: "일반버스"},
    "51": {origin: "관설동종점", destination: "문막읍", description: "관설동 ↔ 원주역 ↔ 문막", routeType: "일반버스"},
    "51-1": {origin: "관설동종점", destination: "문막읍", description: "관설동 ↔ 터미널 ↔ 문막", routeType: "일반버스"},
    "52-1": {origin: "관설동종점", destination: "기업도시", description: "관설동 ↔ 터미널 ↔ 기업도시", routeType: "일반버스"},
    "55": {origin: "관설동종점", destination: "부론", description: "관설동 ↔ 문막 ↔ 부론", routeType: "일반버스"},
    "55-1": {origin: "관설동종점", destination: "부론", description: "관설동 ↔ 문막 ↔ 부론", routeType: "일반버스"},
    "56": {origin: "관설동종점", destination: "월송리", description: "관설동 ↔ 지정 ↔ 월송리", routeType: "일반버스"},
    "57": {origin: "관설동종점", destination: "상구현", description: "관설동 ↔ 지정 ↔ 상구현", routeType: "일반버스"},
    "58": {origin: "관설동종점", destination: "양동", description: "관설동 ↔ 지정 ↔ 양동역", routeType: "일반버스"},
    "59": {origin: "관설동종점", destination: "판대", description: "관설동 ↔ 간현 ↔ 판대", routeType: "일반버스"},
    "81": {origin: "장양리", destination: "미래고", description: "장양리 ↔ 중앙시장 ↔ 미래고", routeType: "일반버스"},
    "82": {origin: "장양리", destination: "하초구", description: "장양리 ↔ 소초 ↔ 하초구", routeType: "일반버스"},
    "90": {origin: "장양리", destination: "한라대학교", description: "장양리 ↔ 터미널 ↔ 한라대", routeType: "일반버스"},
    "100": {origin: "관설동종점", destination: "기업도시", description: "관설동 ↔ 혁신도시 ↔ 터미널 ↔ 기업도시", routeType: "일반버스"},
    "100-2": {origin: "당둔지승강장", destination: "기업도시", description: "혁신도시 ↔ 기업도시", routeType: "일반버스"},
    "111": {origin: "관설동종점", destination: "롯데캐슬2차", description: "관설동 ↔ 혁신도시 ↔ 기업도시", routeType: "일반버스"},
};

const DYNAMIC_ROUTE_METADATA = new Map<string, RouteMeta>();

export function registerDynamicRouteMeta(
    cityCode: string,
    rawRoutes: Array<{
        routeid: string;
        routeno: string | number;
        routetp?: string;
        startnodenm?: string;
        endnodenm?: string;
        startvehicletime?: string | number;
        endvehicletime?: string | number;
    }>
) {
    for (const r of rawRoutes) {
        const routeNo = String(r.routeno);
        const origin = r.startnodenm || "기점";
        const destination = r.endnodenm || "종점";
        const formatTime = (t?: string | number) => {
            if (t === undefined || t === null || t === "") return undefined;
            const digits = String(t).replace(/[^0-9]/g, "");
            if (digits.length < 3) return undefined;
            const s = digits.padStart(4, "0").slice(0, 4);
            return `${s.slice(0, 2)}:${s.slice(2, 4)}`;
        };
        let firstTime = formatTime(r.startvehicletime);
        let lastTime = formatTime(r.endvehicletime);
        // MOLIT TAGO API uses "0000" for both start/end when schedule bounds are unknown
        if (firstTime === "00:00" && lastTime === "00:00") {
            firstTime = undefined;
            lastTime = undefined;
        }
        const routeType = r.routetp;

        const key = `${cityCode}:${routeNo}`;
        const existing = DYNAMIC_ROUTE_METADATA.get(key);
        const genericType = classifyRouteType(routeNo, routeType);
        DYNAMIC_ROUTE_METADATA.set(key, {
            routeNo,
            origin,
            destination,
            description: routeType ? `[${routeType}] ${origin} ↔ ${destination}` : `${origin} ↔ ${destination}`,
            isYonsei: cityCode === "32020" && YONSEI_ROUTE_SET.has(routeNo),
            firstTime: firstTime ?? existing?.firstTime,
            lastTime: lastTime ?? existing?.lastTime,
            routeType: routeType ?? existing?.routeType,
            genericType,
            colorTheme: ROUTE_TYPE_COLORS[genericType],
        });
    }
}

/**
 * Return human-friendly metadata for a given route name and city code
 */
export function getRouteMeta(routeName: string, cityCode = "32020"): RouteMeta {
    const dynamicKey = `${cityCode}:${routeName}`;
    if (DYNAMIC_ROUTE_METADATA.has(dynamicKey)) {
        return DYNAMIC_ROUTE_METADATA.get(dynamicKey)!;
    }

    if (cityCode === "32020") {
        const isYonsei = YONSEI_ROUTE_SET.has(routeName);
        const staticInfo = STATIC_ROUTE_METADATA[routeName];

        const origin = staticInfo?.origin || "관설동/장양리";
        const destination = staticInfo?.destination || "원주시내";
        const description = staticInfo?.description || `${origin} ↔ ${destination}`;
        const routeType = staticInfo?.routeType || "일반버스";
        const genericType = classifyRouteType(routeName, routeType);

        return {
            routeNo: routeName,
            origin,
            destination,
            description,
            isYonsei,
            routeType,
            genericType,
            colorTheme: ROUTE_TYPE_COLORS[genericType],
        };
    }

    const genericType = classifyRouteType(routeName);

    return {
        routeNo: routeName,
        origin: "기점",
        destination: "종점",
        description: `${routeName}번 시내버스`,
        isYonsei: false,
        genericType,
        colorTheme: ROUTE_TYPE_COLORS[genericType],
    };
}
