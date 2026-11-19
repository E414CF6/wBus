import type {ShuttleInboundItem, ShuttleOutboundItem, ShuttleStopLocation, ShuttleViaStop} from "@entities/schedule";
import {UI_TEXT} from "@shared/config/locale";
import {normalizeWikiSlug} from "../schemas";
import type {WikiBoardingStop, WikiLinkedRoute, WikiShuttleBlock} from "../types";

export type WikiInlineNode =
    | { type: "text"; text: string }
    | { type: "strong"; children: WikiInlineNode[] }
    | { type: "em"; children: WikiInlineNode[] }
    | { type: "code"; text: string }
    | { type: "del"; children: WikiInlineNode[] }
    | { type: "link"; label: string; href: string; isExternal: boolean }
    | { type: "wikilink"; slug: string; label: string }
    | { type: "routelink"; cityCode: string; routeNo: string; label: string }
    | { type: "roadview"; lat: number; lng: number; label: string };

export type WikiCalloutTone = "NOTE" | "TIP" | "IMPORTANT" | "WARNING";

export type WikiBlockNode =
    | { type: "heading"; level: 1 | 2 | 3; id: string; text: string; children: WikiInlineNode[] }
    | { type: "paragraph"; children: WikiInlineNode[] }
    | { type: "list"; ordered: boolean; items: WikiInlineNode[][] }
    | { type: "blockquote"; children: WikiInlineNode[][] }
    | { type: "callout"; tone: WikiCalloutTone; lines: WikiInlineNode[][] }
    | { type: "code"; lang: string; code: string }
    | { type: "table"; headers: WikiInlineNode[][]; rows: WikiInlineNode[][][] }
    | { type: "routes"; routes: WikiLinkedRoute[] }
    | { type: "shuttle"; shuttle: WikiShuttleBlock }
    | { type: "stops"; stops: WikiBoardingStop[] }
    | { type: "hr" };

export interface WikiTocItem {
    id: string;
    level: 1 | 2 | 3;
    text: string;
}

export interface ParsedWikiMarkdown {
    blocks: WikiBlockNode[];
    toc: WikiTocItem[];
}

export function isSafeWikiHref(rawHref: string): boolean {
    const trimmed = (rawHref || "").trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;
    if (trimmed.startsWith("#")) return true;
    try {
        const parsed = new URL(trimmed);
        return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
        return false;
    }
}

export function slugifyHeadingId(text: string, usedIds?: Map<string, number>): string {
    const base =
        text
            .trim()
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s-]/gu, "")
            .replace(/\s+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "") || "section";

    if (!usedIds) return base;
    const count = usedIds.get(base) ?? 0;
    usedIds.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
}

export function parseInlineMarkdown(text: string): WikiInlineNode[] {
    if (!text) return [];
    const nodes: WikiInlineNode[] = [];
    const tokenRegex =
        /(\[\[[^\]]+\]\]|`[^`]+`|\*\*[^*]+\*\*|~~[^~]+~~|\*[^*]+\*|\[([^\]]+)\]\(([^)\s]+)\))/g;

    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            nodes.push({type: "text", text: text.slice(lastIndex, match.index)});
        }

        const token = match[0];

        if (token.startsWith("[[") && token.endsWith("]]")) {
            const inner = token.slice(2, -2).trim();
            const parsedCustom = parseCustomWikiToken(inner);
            if (parsedCustom) {
                nodes.push(parsedCustom);
            } else {
                nodes.push({type: "text", text: token});
            }
        } else if (token.startsWith("`") && token.endsWith("`")) {
            nodes.push({type: "code", text: token.slice(1, -1)});
        } else if (token.startsWith("**") && token.endsWith("**")) {
            nodes.push({type: "strong", children: parseInlineMarkdown(token.slice(2, -2))});
        } else if (token.startsWith("~~") && token.endsWith("~~")) {
            nodes.push({type: "del", children: parseInlineMarkdown(token.slice(2, -2))});
        } else if (token.startsWith("*") && token.endsWith("*")) {
            nodes.push({type: "em", children: parseInlineMarkdown(token.slice(1, -1))});
        } else if (match[2] !== undefined && match[3] !== undefined) {
            const label = match[2];
            const href = match[3];
            if (isSafeWikiHref(href)) {
                const isExternal = /^https?:\/\//i.test(href);
                nodes.push({type: "link", label, href, isExternal});
            } else {
                nodes.push({type: "text", text: label});
            }
        } else {
            nodes.push({type: "text", text: token});
        }

        lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < text.length) {
        nodes.push({type: "text", text: text.slice(lastIndex)});
    }

    return nodes;
}

function parseCustomWikiToken(inner: string): WikiInlineNode | null {
    const token = inner.trim();
    if (!token) return null;

    // [[route:32020:30]] or [[route:32020:30|30번 버스]]
    if (token.toLowerCase().startsWith("route:")) {
        const [pathPart, customLabel] = token.split("|");
        const parts = pathPart.split(":").map((p) => p.trim());
        const cityCode = parts[1] || "32020";
        const routeNo = parts[2] || "";
        if (!routeNo) return null;
        return {
            type: "routelink",
            cityCode,
            routeNo,
            label: customLabel?.trim() || UI_TEXT.COMMON.ROUTE_NUMBER(routeNo),
        };
    }

    // [[roadview:lat,lng,라벨]]
    if (token.toLowerCase().startsWith("roadview:")) {
        const rest = token.slice("roadview:".length).trim();
        const [latStr, lngStr, ...labelParts] = rest.split(",");
        const lat = Number(latStr);
        const lng = Number(lngStr);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            return {
                type: "roadview",
                lat,
                lng,
                label: labelParts.join(",").trim() || UI_TEXT.WIKI.MARKDOWN.DEFAULT_ROADVIEW_LABEL,
            };
        }
        return null;
    }

    // [[slug]] or [[slug|표시명]]
    const [rawSlug, rawLabel] = token.split("|");
    const slug = normalizeWikiSlug(rawSlug);
    if (!slug) return null;
    return {
        type: "wikilink",
        slug,
        label: rawLabel?.trim() || rawSlug.trim(),
    };
}

function splitTableRow(line: string): string[] {
    const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    return trimmed.split("|").map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
    const trimmed = line.trim();
    if (!trimmed.includes("|")) return false;
    const cells = splitTableRow(trimmed);
    return cells.length > 0 && cells.every((c) => /^:?-{2,}:?$/.test(c));
}

function normalizeTimeHHMM(raw: string): string | null {
    const match = /^(\d{1,2}):(\d{2})$/.exec(raw.trim());
    if (!match) return null;
    const hh = Number(match[1]);
    const mm = Number(match[2]);
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
    return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function parseViaSegment(segment: string): ShuttleViaStop[] {
    const cleaned = segment.replace(/^경유\s*:\s*/i, "").trim();
    if (!cleaned) return [];
    return cleaned
        .split(",")
        .map((token) => token.trim())
        .filter(Boolean)
        .map((token) => {
            const parenMatch = /^(.+?)\(([^)]+)\)$/.exec(token);
            if (!parenMatch) {
                return {name: token, time: null};
            }
            const name = parenMatch[1].trim();
            const meta = parenMatch[2].trim();
            const isFixed = /정시|fixed/i.test(meta);
            const timeMatch = /(\d{1,2}:\d{2})/.exec(meta);
            const time = timeMatch ? normalizeTimeHHMM(timeMatch[1]) : null;
            // Preserve parenthetical stop qualifiers such as "원주시청사거리(무실동)" when no time/fixed marker is present
            if (!time && !isFixed) {
                return {name: token, time: null};
            }
            return {
                name,
                time,
                ...(isFixed ? {is_fixed_time: true} : {}),
            };
        });
}

function parseShuttleItemLine(
    rawLine: string,
    defaultPoint: string,
    defaultDest: string,
): ShuttleInboundItem | ShuttleOutboundItem | null {
    const cleaned = rawLine.replace(/^[-*+]\s+/, "").trim();
    if (!cleaned) return null;
    const parts = cleaned.split("|").map((p) => p.trim());
    if (parts.length < 3) return null;

    const operation_type = parts[0] || UI_TEXT.WIKI.MARKDOWN.DEFAULT_OPERATION_TYPE;
    const departure_time = normalizeTimeHHMM(parts[1]);
    if (!departure_time) return null;

    const routeExpr = parts[2] || "";
    const arrowParts = routeExpr.split(/\s*(?:->|→)\s*/);
    const departure_point = arrowParts[0]?.trim() || defaultPoint;
    const destination = arrowParts[1]?.trim() || defaultDest;

    let via: ShuttleViaStop[] = [];
    let note: string | null = null;

    for (const extra of parts.slice(3)) {
        if (!extra) continue;
        if (/^경유\s*:/i.test(extra)) {
            via = parseViaSegment(extra);
        } else if (/^비고\s*:/i.test(extra)) {
            const n = extra.replace(/^비고\s*:/i, "").trim();
            note = n || null;
        } else if (!note) {
            note = extra;
        }
    }

    return {
        operation_type,
        departure_point,
        departure_time,
        destination,
        via,
        note,
    };
}

function parseRoutesBlock(code: string): WikiLinkedRoute[] {
    const trimmed = code.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
        try {
            const parsed = JSON.parse(trimmed) as unknown;
            if (Array.isArray(parsed)) {
                return parsed
                    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
                    .map((item) => ({
                        cityCode: String(item.cityCode ?? ""),
                        routeNo: String(item.routeNo ?? "").trim(),
                        ...(item.label ? {label: String(item.label)} : {}),
                        ...(item.description ? {description: String(item.description)} : {}),
                        ...(item.viaStops ? {viaStops: String(item.viaStops)} : {}),
                        ...(item.note ? {note: String(item.note)} : {}),
                    }))
                    .filter((r) => r.routeNo.length > 0 && /^\d{2,10}$/.test(r.cityCode));
            }
        } catch {
            // Fall through to line parser
        }
    }

    const routes: WikiLinkedRoute[] = [];
    for (const rawLine of trimmed.split("\n")) {
        const line = rawLine.replace(/^[-*+]\s+/, "").trim();
        if (!line || line.startsWith("#") || line.startsWith("//")) continue;
        const parts = line.split("|").map((p) => p.trim());
        if (parts.length < 2) continue;

        const cityCode = parts[0];
        const routeNo = parts[1];
        if (!/^\d{2,10}$/.test(cityCode) || !routeNo) continue;

        routes.push({
            cityCode,
            routeNo,
            ...(parts[2] ? {label: parts[2]} : {}),
            ...(parts[3] ? {description: parts[3]} : {}),
            ...(parts[4] ? {viaStops: parts[4]} : {}),
            ...(parts[5] ? {note: parts[5]} : {}),
        });
    }
    return routes;
}

function parseShuttleBlock(code: string): WikiShuttleBlock | null {
    const trimmed = code.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith("{")) {
        try {
            const parsed = JSON.parse(trimmed) as Partial<WikiShuttleBlock>;
            return {
                enabled: parsed.enabled !== false,
                title: String(parsed.title || UI_TEXT.WIKI.MARKDOWN.DEFAULT_SHUTTLE_TITLE),
                stop_locations: Array.isArray(parsed.stop_locations) ? parsed.stop_locations : [],
                inbound_to_campus: Array.isArray(parsed.inbound_to_campus)
                    ? parsed.inbound_to_campus
                    : [],
                outbound_from_campus: Array.isArray(parsed.outbound_from_campus)
                    ? parsed.outbound_from_campus
                    : [],
                guidelines: Array.isArray(parsed.guidelines) ? parsed.guidelines : [],
            };
        } catch {
            // Fall through to line parser
        }
    }

    let title: string = UI_TEXT.WIKI.MARKDOWN.DEFAULT_SHUTTLE_TITLE;
    let section: "stops" | "inbound" | "outbound" | "guidelines" | null = null;
    const stop_locations: ShuttleStopLocation[] = [];
    const inbound_to_campus: ShuttleInboundItem[] = [];
    const outbound_from_campus: ShuttleOutboundItem[] = [];
    const guidelines: string[] = [];

    for (const rawLine of trimmed.split("\n")) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#") || line.startsWith("//")) continue;

        if (/^title\s*:/i.test(line)) {
            const val = line.replace(/^title\s*:/i, "").trim();
            if (val) title = val;
            continue;
        }

        const sectionMatch = /^\[([^\]]+)\]$/.exec(line);
        if (sectionMatch) {
            const key = sectionMatch[1].trim().toLowerCase();
            if (key === "stops" || key === "정류장") section = "stops";
            else if (key === "inbound" || key === "등교" || key === "진입") section = "inbound";
            else if (key === "outbound" || key === "하교" || key === "출발") section = "outbound";
            else if (key === "guidelines" || key === "안내") section = "guidelines";
            continue;
        }

        if (section === "stops") {
            const cleaned = line.replace(/^[-*+]\s+/, "").trim();
            const [name, desc = ""] = cleaned.split("|").map((p) => p.trim());
            if (name) {
                stop_locations.push({name, location_description: desc});
            }
        } else if (section === "inbound") {
            const parsed = parseShuttleItemLine(
                line,
                UI_TEXT.WIKI.MARKDOWN.DEFAULT_DEPARTURE_POINT,
                UI_TEXT.WIKI.MARKDOWN.DEFAULT_ARRIVAL_POINT
            );
            if (parsed) inbound_to_campus.push(parsed);
        } else if (section === "outbound") {
            const parsed = parseShuttleItemLine(
                line,
                UI_TEXT.WIKI.MARKDOWN.DEFAULT_DEPARTURE_POINT,
                UI_TEXT.WIKI.MARKDOWN.DEFAULT_ARRIVAL_POINT
            );
            if (parsed) outbound_from_campus.push(parsed);
        } else if (section === "guidelines") {
            const cleaned = line.replace(/^[-*+]\s+/, "").trim();
            if (cleaned) guidelines.push(cleaned);
        }
    }

    if (
        stop_locations.length === 0 &&
        inbound_to_campus.length === 0 &&
        outbound_from_campus.length === 0 &&
        guidelines.length === 0
    ) {
        return null;
    }

    return {
        enabled: true,
        title,
        stop_locations,
        inbound_to_campus,
        outbound_from_campus,
        guidelines,
    };
}

function parseStopsBlock(code: string): WikiBoardingStop[] {
    const trimmed = code.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
        try {
            const parsed = JSON.parse(trimmed) as unknown;
            if (Array.isArray(parsed)) {
                return parsed
                    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
                    .map((item, idx) => ({
                        id: String(item.id || `stop-${idx + 1}`),
                        name: String(item.name || "").trim(),
                        directionTag: (item.directionTag === "시내방면" || item.directionTag === "학교방면"
                            ? item.directionTag
                            : "공통") as WikiBoardingStop["directionTag"],
                        lat: Number(item.lat),
                        lng: Number(item.lng),
                        locationDescription: String(item.locationDescription || "").trim(),
                        ...(item.tips ? {tips: String(item.tips)} : {}),
                    }))
                    .filter(
                        (s) =>
                            s.name.length > 0 &&
                            Number.isFinite(s.lat) &&
                            Number.isFinite(s.lng) &&
                            s.locationDescription.length > 0,
                    );
            }
        } catch {
            // Fall through to line parser
        }
    }

    const stops: WikiBoardingStop[] = [];
    for (const rawLine of trimmed.split("\n")) {
        const line = rawLine.replace(/^[-*+]\s+/, "").trim();
        if (!line || line.startsWith("#") || line.startsWith("//")) continue;
        const parts = line.split("|").map((p) => p.trim());
        if (parts.length < 4) continue;

        const name = parts[0];
        const rawDir = parts[1];
        const directionTag: WikiBoardingStop["directionTag"] =
            rawDir === "시내방면" || rawDir === "학교방면" ? rawDir : "공통";
        const [latStr, lngStr] = parts[2].split(",").map((s) => s.trim());
        const lat = Number(latStr);
        const lng = Number(lngStr);
        const locationDescription = parts[3];
        const tips = parts[4] || undefined;

        if (!name || !locationDescription || !Number.isFinite(lat) || !Number.isFinite(lng)) {
            continue;
        }

        stops.push({
            id: `stop-${stops.length + 1}`,
            name,
            directionTag,
            lat,
            lng,
            locationDescription,
            ...(tips ? {tips} : {}),
        });
    }
    return stops;
}

export function serializeShuttleViaToText(via: ShuttleViaStop[]): string {
    return via
        .map((v) => {
            const parts: string[] = [];
            if (v.time) parts.push(v.time);
            if (v.is_fixed_time) parts.push("정시");
            return parts.length > 0 ? `${v.name}(${parts.join(" ")})` : v.name;
        })
        .join(", ");
}

/**
 * Converts structured wiki route/shuttle/stop payloads into standardized fenced Markdown blocks.
 * Used for schema migrations from legacy DB columns or Blob documents.
 */
export function serializeStructuredBlocksToMarkdown(input: {
    linkedRoutes?: WikiLinkedRoute[] | null;
    shuttle?: WikiShuttleBlock | null;
    boardingStops?: WikiBoardingStop[] | null;
}): string {
    const sections: string[] = [];

    const routes = input.linkedRoutes ?? [];
    if (routes.length > 0) {
        const lines = routes.map((r) => {
            const cols = [
                r.cityCode,
                r.routeNo,
                r.label ?? UI_TEXT.COMMON.ROUTE_NUMBER(r.routeNo),
                r.description ?? "",
                r.viaStops ?? "",
                r.note ?? "",
            ];
            while (cols.length > 2 && cols[cols.length - 1] === "") {
                cols.pop();
            }
            return cols.join(" | ");
        });
        sections.push(`## ${UI_TEXT.WIKI.MARKDOWN.SECTION_LINKED_ROUTES}\n\n\`\`\`routes\n${lines.join("\n")}\n\`\`\``);
    }

    const shuttle = input.shuttle;
    if (shuttle?.enabled) {
        const shuttleLines: string[] = [`title: ${shuttle.title || UI_TEXT.WIKI.MARKDOWN.DEFAULT_SHUTTLE_TITLE}`];

        if (shuttle.stop_locations.length > 0) {
            shuttleLines.push("", "[stops]");
            for (const s of shuttle.stop_locations) {
                shuttleLines.push(`- ${s.name} | ${s.location_description}`);
            }
        }

        const formatTrip = (item: ShuttleInboundItem | ShuttleOutboundItem) => {
            const cols = [
                item.operation_type,
                item.departure_time,
                `${item.departure_point} -> ${item.destination}`,
            ];
            if (item.via && item.via.length > 0) {
                cols.push(`${UI_TEXT.WIKI.MARKDOWN.VIA_PREFIX} ${serializeShuttleViaToText(item.via)}`);
            }
            if (item.note) {
                cols.push(`${UI_TEXT.WIKI.MARKDOWN.NOTE_PREFIX} ${item.note}`);
            }
            return `- ${cols.join(" | ")}`;
        };

        if (shuttle.inbound_to_campus.length > 0) {
            shuttleLines.push("", "[inbound]");
            for (const item of shuttle.inbound_to_campus) {
                shuttleLines.push(formatTrip(item));
            }
        }

        if (shuttle.outbound_from_campus.length > 0) {
            shuttleLines.push("", "[outbound]");
            for (const item of shuttle.outbound_from_campus) {
                shuttleLines.push(formatTrip(item));
            }
        }

        if (shuttle.guidelines.length > 0) {
            shuttleLines.push("", "[guidelines]");
            for (const g of shuttle.guidelines) {
                shuttleLines.push(`- ${g}`);
            }
        }

        sections.push(`## ${shuttle.title || UI_TEXT.WIKI.MARKDOWN.DEFAULT_SHUTTLE_HEADING_FALLBACK}\n\n\`\`\`shuttle\n${shuttleLines.join("\n")}\n\`\`\``);
    }

    const stops = input.boardingStops ?? [];
    if (stops.length > 0) {
        const lines = stops.map((s) => {
            const cols = [
                s.name,
                s.directionTag,
                `${s.lat}, ${s.lng}`,
                s.locationDescription,
                ...(s.tips ? [s.tips] : []),
            ];
            return `- ${cols.join(" | ")}`;
        });
        sections.push(`## ${UI_TEXT.WIKI.MARKDOWN.SECTION_BOARDING_STOPS}\n\n\`\`\`stops\n${lines.join("\n")}\n\`\`\``);
    }

    return sections.join("\n\n");
}

/**
 * Appends serialized structured blocks onto an existing markdownBody only when missing.
 */
export function mergeStructuredBlocksIntoMarkdown(
    markdownBody: string,
    input: {
        linkedRoutes?: WikiLinkedRoute[] | null;
        shuttle?: WikiShuttleBlock | null;
        boardingStops?: WikiBoardingStop[] | null;
    },
): string {
    const base = (markdownBody || "").trim();
    const hasRoutesFence = /```routes\b/i.test(base);
    const hasShuttleFence = /```shuttle\b/i.test(base);
    const hasStopsFence = /```stops\b/i.test(base);

    const addition = serializeStructuredBlocksToMarkdown({
        linkedRoutes: hasRoutesFence ? null : input.linkedRoutes,
        shuttle: hasShuttleFence ? null : input.shuttle,
        boardingStops: hasStopsFence ? null : input.boardingStops,
    });

    if (!addition) return base;
    return base ? `${base}\n\n${addition}` : addition;
}

/**
 * Extracts summary badge counts directly from Markdown fenced directives (zero extra DB storage).
 */
export function extractWikiStructuredCounts(markdown: string): {
    hasShuttle: boolean;
    linkedRouteCount: number;
    boardingStopCount: number;
} {
    const parsed = parseWikiMarkdown(markdown);
    let hasShuttle = false;
    let linkedRouteCount = 0;
    let boardingStopCount = 0;

    for (const block of parsed.blocks) {
        if (block.type === "routes") {
            linkedRouteCount += block.routes.length;
        } else if (block.type === "shuttle" && block.shuttle.enabled) {
            hasShuttle = true;
        } else if (block.type === "stops") {
            boardingStopCount += block.stops.length;
        }
    }

    return {hasShuttle, linkedRouteCount, boardingStopCount};
}

export function parseWikiMarkdown(markdown: string): ParsedWikiMarkdown {
    const normalized = (markdown || "").replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    const blocks: WikiBlockNode[] = [];
    const toc: WikiTocItem[] = [];
    const usedIds = new Map<string, number>();

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        if (!trimmed) {
            i++;
            continue;
        }

        // 1. Fenced code block ``` (including unified routes/shuttle/stops directives)
        if (trimmed.startsWith("```")) {
            const lang = trimmed.slice(3).trim();
            const langLower = lang.toLowerCase();
            const codeLines: string[] = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith("```")) {
                codeLines.push(lines[i]);
                i++;
            }
            if (i < lines.length) i++;
            const code = codeLines.join("\n");

            if (langLower === "routes") {
                const routes = parseRoutesBlock(code);
                if (routes.length > 0) {
                    blocks.push({type: "routes", routes});
                    continue;
                }
            } else if (langLower === "shuttle") {
                const shuttle = parseShuttleBlock(code);
                if (shuttle) {
                    blocks.push({type: "shuttle", shuttle});
                    continue;
                }
            } else if (langLower === "stops") {
                const stops = parseStopsBlock(code);
                if (stops.length > 0) {
                    blocks.push({type: "stops", stops});
                    continue;
                }
            }

            blocks.push({type: "code", lang, code});
            continue;
        }

        // 2. Horizontal rule
        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
            blocks.push({type: "hr"});
            i++;
            continue;
        }

        // 3. Headings (#, ##, ###)
        const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
        if (headingMatch) {
            const level = headingMatch[1].length as 1 | 2 | 3;
            const text = headingMatch[2].trim();
            const id = slugifyHeadingId(text, usedIds);
            toc.push({id, level, text});
            blocks.push({
                type: "heading",
                level,
                id,
                text,
                children: parseInlineMarkdown(text),
            });
            i++;
            continue;
        }

        // 4. Blockquote or GitHub-style Callout (> [!TIP])
        if (trimmed.startsWith(">")) {
            const quoteLines: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith(">")) {
                quoteLines.push(lines[i].trim().replace(/^>\s?/, ""));
                i++;
            }
            const firstLine = quoteLines[0] || "";
            const calloutMatch = /^\[!(NOTE|TIP|IMPORTANT|WARNING)\]\s*(.*)$/i.exec(firstLine);
            if (calloutMatch) {
                const tone = calloutMatch[1].toUpperCase() as WikiCalloutTone;
                const remaining = [calloutMatch[2], ...quoteLines.slice(1)]
                    .map((l) => l.trim())
                    .filter(Boolean);
                blocks.push({
                    type: "callout",
                    tone,
                    lines: remaining.map((l) => parseInlineMarkdown(l)),
                });
            } else {
                blocks.push({
                    type: "blockquote",
                    children: quoteLines
                        .filter((l) => l.length > 0)
                        .map((l) => parseInlineMarkdown(l)),
                });
            }
            continue;
        }

        // 5. GFM Table
        if (
            trimmed.includes("|") &&
            i + 1 < lines.length &&
            isTableSeparator(lines[i + 1])
        ) {
            const headers = splitTableRow(trimmed).map((cell) => parseInlineMarkdown(cell));
            i += 2;
            const rows: WikiInlineNode[][][] = [];
            while (i < lines.length && lines[i].trim().includes("|") && lines[i].trim() !== "") {
                const cells = splitTableRow(lines[i]).map((cell) => parseInlineMarkdown(cell));
                rows.push(cells);
                i++;
            }
            blocks.push({type: "table", headers, rows});
            continue;
        }

        // 6. Unordered or Ordered List
        const unorderedMatch = /^[-*+]\s+(.+)$/.exec(trimmed);
        const orderedMatch = /^\d+\.\s+(.+)$/.exec(trimmed);
        if (unorderedMatch || orderedMatch) {
            const ordered = Boolean(orderedMatch);
            const items: WikiInlineNode[][] = [];
            while (i < lines.length) {
                const cur = lines[i].trim();
                const m = ordered ? /^\d+\.\s+(.+)$/.exec(cur) : /^[-*+]\s+(.+)$/.exec(cur);
                if (!m) break;
                items.push(parseInlineMarkdown(m[1]));
                i++;
            }
            blocks.push({type: "list", ordered, items});
            continue;
        }

        // 7. Paragraph
        const paraLines: string[] = [];
        while (i < lines.length) {
            const cur = lines[i].trim();
            if (
                !cur ||
                cur.startsWith("#") ||
                cur.startsWith("```") ||
                cur.startsWith(">") ||
                /^[-*+]\s+/.test(cur) ||
                /^\d+\.\s+/.test(cur) ||
                /^(-{3,}|\*{3,}|_{3,})$/.test(cur) ||
                (cur.includes("|") && i + 1 < lines.length && isTableSeparator(lines[i + 1]))
            ) {
                break;
            }
            paraLines.push(cur);
            i++;
        }
        if (paraLines.length > 0) {
            blocks.push({
                type: "paragraph",
                children: parseInlineMarkdown(paraLines.join(" ")),
            });
        }
    }

    return {blocks, toc};
}
