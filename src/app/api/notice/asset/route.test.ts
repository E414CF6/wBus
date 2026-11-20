import {afterEach, describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";
import {GET} from "./route";

describe("GET /api/notice/asset", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("rejects missing, protocol-relative, or traversal paths with 400", async () => {
        for (const badPath of ["", "//evil.com/x.png", "/../etc/passwd", "http://evil.com/x.png"]) {
            const url = badPath
                ? `http://localhost:3000/api/notice/asset?path=${encodeURIComponent(badPath)}`
                : "http://localhost:3000/api/notice/asset";
            const res = await GET(new NextRequest(url));
            expect(res.status).toBe(400);
        }
    });

    it("rejects non-image upstream responses with 415", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response("<html>not image</html>", {
                status: 200,
                headers: {"Content-Type": "text/html"},
            })
        );

        const res = await GET(new NextRequest("http://localhost:3000/api/notice/asset?path=%2Fupload%2Fdoc.html"));
        expect(res.status).toBe(415);
    });

    it("proxies valid image responses from Wonju ITS with cache headers", async () => {
        const bytes = new Uint8Array([137, 80, 78, 71]);
        const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response(bytes, {
                status: 200,
                headers: {"Content-Type": "image/png"},
            })
        );

        const res = await GET(new NextRequest("http://localhost:3000/api/notice/asset?path=%2Fupload%2Froute.png"));
        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toBe("image/png");
        expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
        expect(fetchSpy).toHaveBeenCalledWith(
            "http://its.wonju.go.kr/upload/route.png",
            expect.objectContaining({redirect: "error"})
        );
    });
});
