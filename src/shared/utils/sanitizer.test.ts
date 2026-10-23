import {describe, expect, it} from "vitest";
import {sanitizeHtml} from "./sanitizer";

describe("sanitizeHtml", () => {
    it("handles null, undefined, and empty string safely", () => {
        expect(sanitizeHtml(null)).toBe("");
        expect(sanitizeHtml(undefined)).toBe("");
        expect(sanitizeHtml("")).toBe("");
    });

    it("strips executable script tags and contents", () => {
        const dirty = "<p>Notice text</p><script>alert('xss');</script>";
        expect(sanitizeHtml(dirty)).toBe("<p>Notice text</p>");
    });

    it("strips malicious inline event handlers (onerror, onclick, onload)", () => {
        const dirty = '<img src="https://example.com/bus.jpg" onerror="alert(1)" onclick="evil()" />';
        const clean = sanitizeHtml(dirty);
        expect(clean).not.toContain("onerror");
        expect(clean).not.toContain("onclick");
        expect(clean).toContain('src="https://example.com/bus.jpg"');
    });

    it("strips javascript: pseudo-protocol in links and images", () => {
        const dirty = '<a href="javascript:alert(document.cookie)">Click here</a>';
        const clean = sanitizeHtml(dirty);
        expect(clean).not.toContain("javascript:");
        expect(clean).toContain('rel="noopener noreferrer"');
    });

    it("strips iframe, embed, object, and svg elements", () => {
        const dirty = '<div>Before<iframe src="http://attacker.com"></iframe><svg><circle /></svg>After</div>';
        const clean = sanitizeHtml(dirty);
        expect(clean).toBe("<div>BeforeAfter</div>");
    });

    it("preserves legitimate HTML tables, formatting tags, and styles", () => {
        const legitimate = `
            <table class="notice-table" border="1">
                <thead>
                    <tr><th>노선</th><th>시간</th></tr>
                </thead>
                <tbody>
                    <tr><td><strong>30번</strong></td><td>07:30</td></tr>
                </tbody>
            </table>
            <p style="color: blue; font-weight: bold;">정상 운행 안내</p>
        `;
        const clean = sanitizeHtml(legitimate);
        expect(clean).toContain("<table");
        expect(clean).toContain("<th>노선</th>");
        expect(clean).toContain("<strong>30번</strong>");
        expect(clean).toContain("style=\"color: blue; font-weight: bold;\"");
    });

    it("neutralizes CSS expression attacks in style attributes", () => {
        const dirty = '<p style="color: red; background-image: url(javascript:alert(1)); width: expression(alert(1));">Text</p>';
        const clean = sanitizeHtml(dirty);
        expect(clean).not.toContain("javascript:");
        expect(clean).not.toContain("expression");
        expect(clean).not.toContain("url(");
    });
});
