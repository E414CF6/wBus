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

const SAFE_URL_SCHEME_REGEX = /^(https?:\/\/|\/)/i;

export function isSafeWikiHref(rawHref: string): boolean {
    const trimmed = rawHref.trim();
    if (!trimmed) return false;
    if (trimmed.startsWith("//")) return false;
    return SAFE_URL_SCHEME_REGEX.test(trimmed);
}

export function slugifyHeadingId(text: string, usedIds: Map<string, number>): string {
    const base = text
        .trim()
        .toLowerCase()
        .replace(/[^\w\uAC00-\uD7A3\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-") || "section";

    const count = usedIds.get(base) ?? 0;
    usedIds.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
}

export function parseInlineMarkdown(input: string): WikiInlineNode[] {
    const nodes: WikiInlineNode[] = [];
    let pos = 0;

    const pushText = (text: string) => {
        if (!text) return;
        const last = nodes[nodes.length - 1];
        if (last && last.type === "text") {
            last.text += text;
        } else {
            nodes.push({type: "text", text});
        }
    };

    while (pos < input.length) {
        const rest = input.slice(pos);

        // 1. Inline code: `...`
        if (rest.startsWith("`")) {
            const endIdx = rest.indexOf("`", 1);
            if (endIdx > 1) {
                nodes.push({type: "code", text: rest.slice(1, endIdx)});
                pos += endIdx + 1;
                continue;
            }
        }

        // 2. wBus double-bracket tokens: [[...]]
        if (rest.startsWith("[[")) {
            const endIdx = rest.indexOf("]]", 2);
            if (endIdx > 2) {
                const token = rest.slice(2, endIdx).trim();
                const parsedToken = parseWikiBracketToken(token);
                if (parsedToken) {
                    nodes.push(parsedToken);
                    pos += endIdx + 2;
                    continue;
                }
            }
        }

        // 3. Markdown link: [label](href)
        if (rest.startsWith("[")) {
            const match = /^\[([^\]\n]+)\]\(([^)\s]+)\)/.exec(rest);
            if (match) {
                const [, label, href] = match;
                if (isSafeWikiHref(href)) {
                    nodes.push({
                        type: "link",
                        label,
                        href,
                        isExternal: /^https?:\/\//i.test(href),
                    });
                } else {
                    pushText(label);
                }
                pos += match[0].length;
                continue;
            }
        }

        // 4. Bold: **...**
        if (rest.startsWith("**")) {
            const endIdx = rest.indexOf("**", 2);
            if (endIdx > 2) {
                nodes.push({
                    type: "strong",
                    children: parseInlineMarkdown(rest.slice(2, endIdx)),
                });
                pos += endIdx + 2;
                continue;
            }
        }

        // 5. Strikethrough: ~~...~~
        if (rest.startsWith("~~")) {
            const endIdx = rest.indexOf("~~", 2);
            if (endIdx > 2) {
                nodes.push({
                    type: "del",
                    children: parseInlineMarkdown(rest.slice(2, endIdx)),
                });
                pos += endIdx + 2;
                continue;
            }
        }

        // 6. Italic: *...* (non-space boundary)
        if (rest.startsWith("*") && !rest.startsWith("* ")) {
            const endIdx = rest.indexOf("*", 1);
            if (endIdx > 1) {
                nodes.push({
                    type: "em",
                    children: parseInlineMarkdown(rest.slice(1, endIdx)),
                });
                pos += endIdx + 1;
                continue;
            }
        }

        // Consume plain text up to the next special marker
        const nextSpecial = rest.slice(1).search(/[`[*~]/);
        if (nextSpecial === -1) {
            pushText(rest);
            break;
        } else {
            pushText(rest.slice(0, nextSpecial + 1));
            pos += nextSpecial + 1;
        }
    }

    return nodes;
}

function parseWikiBracketToken(token: string): WikiInlineNode | null {
    if (!token) return null;

    // [[route:32020:30]] or [[route:30]]
    if (token.startsWith("route:")) {
        const parts = token.slice("route:".length).split(":").map((s) => s.trim());
        if (parts.length === 1 && parts[0]) {
            return {
                type: "routelink",
                cityCode: "32020",
                routeNo: parts[0],
                label: `${parts[0]}번 실시간`,
            };
        }
        if (parts.length >= 2 && parts[0] && parts[1]) {
            return {
                type: "routelink",
                cityCode: parts[0],
                routeNo: parts[1],
                label: parts[2] || `${parts[1]}번 실시간`,
            };
        }
        return null;
    }

    // [[roadview:37.2834,127.9006,미래관 승강장]]
    if (token.startsWith("roadview:")) {
        const raw = token.slice("roadview:".length);
        const [latStr, lngStr, ...labelParts] = raw.split(",");
        const lat = Number(latStr);
        const lng = Number(lngStr);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            return {
                type: "roadview",
                lat,
                lng,
                label: labelParts.join(",").trim() || "로드뷰",
            };
        }
        return null;
    }

    // [[slug]] or [[slug|표시명]]
    const [rawSlug, rawLabel] = token.split("|");
    const slug = rawSlug.trim().toLowerCase();
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

        // 1. Fenced code block ```
        if (trimmed.startsWith("```")) {
            const lang = trimmed.slice(3).trim();
            const codeLines: string[] = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith("```")) {
                codeLines.push(lines[i]);
                i++;
            }
            if (i < lines.length) i++;
            blocks.push({type: "code", lang, code: codeLines.join("\n")});
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
