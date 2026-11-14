import type {RawBusLocation} from "../publicApi";

export interface SeoulBusPosItem {
    sectOrd?: string | number;
    fullSectDist?: string | number;
    sectDist?: string | number;
    rtDist?: string | number;
    stopFlag?: string | number;
    sectionId?: string | number;
    dataTm?: string;
    tmX?: string | number | null;
    tmY?: string | number | null;
    gpsX?: string | number | null;
    gpsY?: string | number | null;
    posX?: string | number | null;
    posY?: string | number | null;
    vehId?: string | number;
    plainNo?: string;
    busType?: string | number;
    lastStTm?: string | number;
    nextStTm?: string | number;
    nextStId?: string | number;
    lastStnId?: string | number;
    trnstnid?: string | number;
    trnStnid?: string | number;
    isrunyn?: string | number;
    islastyn?: string | number;
    isFullFlag?: string | number;
    congetion?: string | number;
}

export interface SeoulWsEnvelope<T> {
    msgHeader?: {
        headerCd?: string | number;
        headerMsg?: string;
        itemCount?: number;
    };
    msgBody?: {
        itemList?: T | T[] | null;
    };
    ServiceResult?: {
        msgHeader?: {
            headerCd?: string | number;
            headerMsg?: string;
            itemCount?: number;
        };
        msgBody?: {
            itemList?: T | T[] | null;
        };
    };
}

const SEOUL_ROUTE_TYPE_MAP: Record<string, string> = {
    "1": "공항",
    "2": "마을",
    "3": "간선",
    "4": "지선",
    "5": "순환",
    "6": "광역",
    "7": "인천",
    "8": "경기",
    "9": "폐지",
    "10": "관광",
    "14": "한강",
    "15": "심야",
};

export function mapSeoulRouteType(code?: string | number | null): string {
    if (code === undefined || code === null) return "간선";
    return SEOUL_ROUTE_TYPE_MAP[String(code).trim()] || "간선";
}

export function mapSeoulVehicleType(busType?: string | number | null): string {
    const code = String(busType ?? "0").trim();
    if (code === "1") return "저상버스";
    if (code === "2") return "굴절버스";
    return "일반버스";
}

/**
 * Parses XML `<itemList>...</itemList>` blocks from `ws.bus.go.kr` when XML is returned instead of JSON.
 */
export function parseSeoulXmlItems<T = Record<string, unknown>>(xmlText: string): {
    headerCd: string;
    headerMsg: string;
    items: T[];
} {
    const cdMatch = xmlText.match(/<headerCd>([^<]*)<\/headerCd>/i);
    const msgMatch = xmlText.match(/<headerMsg>([^<]*)<\/headerMsg>/i);
    const headerCd = cdMatch ? cdMatch[1].trim() : "0";
    const headerMsg = msgMatch ? msgMatch[1].trim() : "";

    const items: T[] = [];
    const itemRegex = /<itemList>([\s\S]*?)<\/itemList>/gi;
    let match: RegExpExecArray | null;
    while ((match = itemRegex.exec(xmlText)) !== null) {
        const block = match[1];
        const obj: Record<string, string> = {};
        const tagRegex = /<([a-zA-Z0-9_]+)>([^<]*)<\/\1>/g;
        let tagMatch: RegExpExecArray | null;
        while ((tagMatch = tagRegex.exec(block)) !== null) {
            obj[tagMatch[1]] = tagMatch[2].trim();
        }
        items.push(obj as unknown as T);
    }

    return {headerCd, headerMsg, items};
}

/**
 * Extracts items from a Seoul `ws.bus.go.kr` JSON or XML response payload.
 * Per `서울특별시_버스위치정보조회_서비스_활용가이드`, `headerCd === "0"` is success and `headerCd === "4"` means no results.
 */
export function extractSeoulWsItems<T = Record<string, unknown>>(payload: SeoulWsEnvelope<T> | string): T[] {
    if (typeof payload === "string") {
        const trimmed = payload.trim();
        if (trimmed.startsWith("<")) {
            const parsedXml = parseSeoulXmlItems<T>(trimmed);
            if (parsedXml.headerCd !== "0" && parsedXml.headerCd !== "4") {
                throw new Error(`[SeoulAPI] ${parsedXml.headerMsg || "XML Error"} (Code: ${parsedXml.headerCd})`);
            }
            return parsedXml.items;
        }
        try {
            payload = JSON.parse(trimmed) as SeoulWsEnvelope<T>;
        } catch {
            throw new Error(`[SeoulAPI] Invalid JSON/XML payload from ws.bus.go.kr`);
        }
    }

    const header = payload.msgHeader ?? payload.ServiceResult?.msgHeader;
    const body = payload.msgBody ?? payload.ServiceResult?.msgBody;

    if (header && header.headerCd !== undefined) {
        const code = String(header.headerCd).trim();
        if (code === "4") {
            return [];
        }
        if (code !== "0" && code !== "00") {
            throw new Error(`[SeoulAPI] ${header.headerMsg ?? "Upstream Error"} (Code: ${code})`);
        }
    }

    const rawList = body?.itemList;
    if (!rawList) return [];
    return Array.isArray(rawList) ? rawList : [rawList];
}

/**
 * Normalizes a single Seoul `buspos` item into our unified `RawBusLocation` schema.
 */
export function normalizeSeoulBusPosItem(
    item: SeoulBusPosItem,
    routeId: string,
    stopLookup?: Map<number | string, { nodeid: string; nodenm: string; routenm?: string }>,
    routeName?: string
): RawBusLocation | null {
    if (String(item.isrunyn ?? "1") === "0") {
        return null;
    }

    const rawLng = Number(item.gpsX ?? item.tmX ?? item.posX ?? 0);
    const rawLat = Number(item.gpsY ?? item.tmY ?? item.posY ?? 0);

    if (!Number.isFinite(rawLat) || !Number.isFinite(rawLng) || rawLat < 33 || rawLat > 39 || rawLng < 124 || rawLng > 132) {
        return null;
    }

    const sectOrd = Number(item.sectOrd ?? 0);
    const lastStnId = String(item.lastStnId ?? "").trim();
    const matchedStop = (lastStnId ? stopLookup?.get(lastStnId) : undefined) ?? stopLookup?.get(sectOrd);
    const nodeid = String(lastStnId || matchedStop?.nodeid || item.nextStId || item.sectionId || "").trim();
    const nodenm = matchedStop?.nodenm;
    const routenm = routeName || matchedStop?.routenm || "";

    return {
        routeid: routeId,
        routenm,
        gpslati: rawLat,
        gpslong: rawLng,
        vehicleno: String(item.plainNo || item.vehId || "").trim(),
        nodeid: nodeid || undefined,
        nodenm: nodenm || undefined,
        nodeord: sectOrd,
    };
}
