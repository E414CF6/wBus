/**
 * @fileoverview Safe, lightweight HTML sanitizer for transit notices and external municipal contents.
 * Prevents Cross-Site Scripting (XSS) while preserving standard text styling, tables, images, and links.
 */

// Tags explicitly permitted in municipal transit announcements
const ALLOWED_TAGS = new Set([
    "a", "b", "blockquote", "br", "caption", "code", "col", "colgroup", "del", "div",
    "em", "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "li", "ol", "p",
    "pre", "s", "small", "span", "strike", "strong", "sub", "sup", "table", "tbody",
    "td", "tfoot", "th", "thead", "tr", "u", "ul",
]);

// Attributes permitted on allowed tags
const ALLOWED_ATTRIBUTES = new Set([
    "align", "alt", "border", "cellpadding", "cellspacing", "class", "colspan",
    "dir", "height", "href", "id", "rowspan", "src", "style", "target", "title", "width",
]);

// Dangerous schemes for URLs
const DANGEROUS_SCHEMES = /^(javascript|vbscript|data(?!\s*:\s*image\/)|file):/i;

/**
 * Strips script tags, iframe, object, embed, all on* event handlers, and dangerous URL schemes.
 */
export function sanitizeHtml(html?: string | null): string {
    if (!html || typeof html !== "string") return "";

    // 1. Remove dangerous script, iframe, object, embed, style, svg, math tags entirely along with their inner contents
    let sanitized = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
        .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
        .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "")
        .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "");

    // 2. Tokenize tags and strip disallowed tags and attributes
    sanitized = sanitized.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (fullMatch, rawTagName: string, rawAttrs: string) => {
        const tagName = rawTagName.toLowerCase();

        // Disallowed tag -> strip tag completely
        if (!ALLOWED_TAGS.has(tagName)) {
            return "";
        }

        // Closing tag -> keep clean
        if (fullMatch.startsWith("</")) {
            return `</${tagName}>`;
        }

        // Parse attributes
        const attrRegex = /([a-zA-Z0-9_-]+)(?:\s*=\s*(?:'([^']*)'|"([^"]*)"|([^\s>]+)))?/g;
        const cleanAttrs: string[] = [];
        let attrMatch: RegExpExecArray | null;

        while ((attrMatch = attrRegex.exec(rawAttrs)) !== null) {
            const attrName = attrMatch[1].toLowerCase();
            const attrVal = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? "";

            // Disallow all event handlers (on*)
            if (attrName.startsWith("on")) {
                continue;
            }

            // Check attribute whitelist
            if (!ALLOWED_ATTRIBUTES.has(attrName)) {
                continue;
            }

            // Inspect URL attributes for dangerous schemes (javascript:, etc.)
            if (attrName === "href" || attrName === "src") {
                const trimmed = attrVal.trim();
                if (DANGEROUS_SCHEMES.test(trimmed)) {
                    continue;
                }
            }

            // Sanitize style attribute: block expression(), javascript:, url(), behavior:
            if (attrName === "style") {
                const lowerStyle = attrVal.toLowerCase();
                if (
                    lowerStyle.includes("expression") ||
                    lowerStyle.includes("javascript:") ||
                    lowerStyle.includes("behavior:") ||
                    lowerStyle.includes("url(")
                ) {
                    continue;
                }
            }

            // Safe attribute
            cleanAttrs.push(`${attrName}="${escapeAttributeValue(attrVal)}"`);
        }

        // If tag is an anchor, ensure secure rel attributes
        if (tagName === "a") {
            const hasRel = cleanAttrs.some((a) => a.startsWith("rel="));
            if (!hasRel) {
                cleanAttrs.push('rel="noopener noreferrer"');
            }
        }

        const attrString = cleanAttrs.length > 0 ? " " + cleanAttrs.join(" ") : "";
        const isSelfClosing = fullMatch.endsWith("/>") || tagName === "br" || tagName === "hr" || tagName === "img";
        return isSelfClosing ? `<${tagName}${attrString} />` : `<${tagName}${attrString}>`;
    });

    return sanitized;
}

function escapeAttributeValue(val: string): string {
    return val
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}
