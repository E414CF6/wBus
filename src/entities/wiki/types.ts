import type {ShuttleInboundItem, ShuttleOutboundItem, ShuttleStopLocation} from "@entities/schedule";

export type WikiCategory = "campus" | "route" | "stop" | "terminal" | "guide";

export interface WikiEditorInfo {
    nickname: string;
    editorId: string;
}

export interface WikiLinkedRoute {
    routeNo: string;
    cityCode: string;
    label?: string;
    description?: string;
    destLabel?: string;
    originLabel?: string;
    viaStops?: string;
    note?: string;
}

export interface WikiBoardingStop {
    id: string;
    number?: number;
    name: string;
    shortName?: string;
    lat: number;
    lng: number;
    locationDescription: string;
    directionTag: "시내방면" | "학교방면" | "공통";
    tips?: string;
}

export interface WikiShuttleBlock {
    enabled: boolean;
    title: string;
    stop_locations: ShuttleStopLocation[];
    inbound_to_campus: ShuttleInboundItem[];
    outbound_from_campus: ShuttleOutboundItem[];
    guidelines: string[];
}

export interface WikiPageDocument {
    slug: string;
    title: string;
    subtitle: string;
    category: WikiCategory;
    cityCode?: string;
    lat?: number;
    lng?: number;
    tags: string[];
    version: number;
    createdAt: string;
    updatedAt: string;
    lastEditor: WikiEditorInfo;
    isProtected?: boolean;
    linkedRoutes: WikiLinkedRoute[];
    shuttle: WikiShuttleBlock | null;
    boardingStops: WikiBoardingStop[];
    markdownBody: string;
}

export interface WikiDiffStats {
    added: number;
    removed: number;
    structuredChanges: string[];
}

export interface WikiRevision {
    slug: string;
    version: number;
    baseVersion: number;
    summary: string;
    editor: WikiEditorInfo;
    createdAt: string;
    diffStats: WikiDiffStats;
    snapshot: WikiPageDocument;
}

export interface WikiRevisionMeta {
    slug: string;
    version: number;
    baseVersion: number;
    summary: string;
    editor: WikiEditorInfo;
    createdAt: string;
    diffStats: WikiDiffStats;
}

export interface WikiPageSummary {
    slug: string;
    title: string;
    subtitle: string;
    category: WikiCategory;
    cityCode?: string;
    lat?: number;
    lng?: number;
    tags: string[];
    version: number;
    updatedAt: string;
    lastEditor: WikiEditorInfo;
    isProtected?: boolean;
    hasShuttle: boolean;
    linkedRouteCount: number;
    boardingStopCount: number;
    pinned?: boolean;
}

export interface WikiRecentChangeItem {
    slug: string;
    title: string;
    category: WikiCategory;
    version: number;
    summary: string;
    editor: WikiEditorInfo;
    createdAt: string;
    diffStats: WikiDiffStats;
}

export type WikiMarkdownPatchOp =
    | { op: "keep"; count: number }
    | { op: "del"; count: number }
    | { op: "ins"; lines: string[] };

export interface WikiMarkdownPatch {
    ops: WikiMarkdownPatchOp[];
}

export interface WikiFieldsPatch {
    title?: string;
    subtitle?: string;
    category?: WikiCategory;
    cityCode?: string | null;
    lat?: number | null;
    lng?: number | null;
    tags?: string[];
    linkedRoutes?: WikiLinkedRoute[];
    shuttle?: WikiShuttleBlock | null;
    boardingStops?: WikiBoardingStop[];
}

export interface WikiRevisionDelta {
    markdownPatch?: WikiMarkdownPatch;
    fieldsPatch?: WikiFieldsPatch;
}

export interface WikiIndexData {
    updatedAt: string;
    pages: WikiPageSummary[];
    recentChanges: WikiRecentChangeItem[];
    totalCount?: number;
    hasMore?: boolean;
}
