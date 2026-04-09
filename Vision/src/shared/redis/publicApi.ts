/**
 * Direct client for Korea's public data API (apis.data.go.kr).
 * Replaces the CloudFront → API Gateway proxy chain.
 */

const PUBLIC_API_BASE = "http://apis.data.go.kr/1613000";
const CITY_CODE = "32020";
const DEFAULT_PARAMS = {
    numOfRows: "1024", pageNo: "1", _type: "json", cityCode: CITY_CODE,
};

function getServiceKey(): string {
    const key = process.env.DATA_GO_KR_SERVICE_KEY;
    if (!key) {
        throw new Error("[PublicAPI] DATA_GO_KR_SERVICE_KEY is not set.");
    }
    return key;
}

function buildUrl(path: string, params: Record<string, string>): string {
    const url = new URL(`${PUBLIC_API_BASE}${path}`);
    url.searchParams.set("serviceKey", getServiceKey());
    for (const [k, v] of Object.entries({...DEFAULT_PARAMS, ...params})) {
        url.searchParams.set(k, v);
    }
    return url.toString();
}

async function fetchPublicApi<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = buildUrl(path, params);
    const res = await fetch(url, {
        headers: {Client: "wBus"}, signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
        // Sanitize URL to avoid leaking service key in logs
        const safeUrl = url.replace(/serviceKey=[^&]+/, "serviceKey=***");
        throw new Error(`[PublicAPI] ${res.status} ${res.statusText} — ${safeUrl}`);
    }

    return res.json() as Promise<T>;
}

// Extracts items from the standard public data API response envelope
function extractItems<T>(data: { response?: { body?: { items?: { item?: T | T[] } } } }): T[] {
    const raw = data?.response?.body?.items?.item;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
}

// Public Functions

export interface RawBusLocation {
    routeid?: string;
    routenm: string;
    gpslati: number;
    gpslong: number;
    vehicleno: string;
    nodenm?: string;
    nodeid?: string;
    nodeord?: number;
}

export async function fetchBusLocations(routeId: string): Promise<RawBusLocation[]> {
    const data = await fetchPublicApi<{
        response?: { body?: { items?: { item?: RawBusLocation | RawBusLocation[] } } };
    }>("/BusLcInfoInqireService/getRouteAcctoBusLcList", {routeId});

    return extractItems(data).map((bus) => ({
        ...bus, routeid: bus.routeid ?? routeId,
    }));
}

export interface RawBusArrival {
    arrprevstationcnt: number;
    arrtime: number;
    routeid: string;
    routeno: string;
    vehicletp: string;
}

export async function fetchBusArrivals(nodeId: string): Promise<RawBusArrival[]> {
    const data = await fetchPublicApi<{
        response?: { body?: { items?: { item?: RawBusArrival | RawBusArrival[] } } };
    }>("/ArvlInfoInqireService/getSttnAcctoArvlPrearngeInfoList", {nodeId});

    return extractItems(data);
}

export interface RawBusStop {
    nodeid: string;
    nodenm: string;
    nodeno: string | number;
    gpslati: number;
    gpslong: number;
    nodeord?: number;
    updowncd?: number;
}

export async function fetchRouteStops(routeId: string): Promise<RawBusStop[]> {
    const data = await fetchPublicApi<{
        response?: { body?: { items?: { item?: RawBusStop | RawBusStop[] } } };
    }>("/BusRouteInfoInqireService/getRouteAcctoThrghSttnList", {routeId});

    return extractItems(data);
}
