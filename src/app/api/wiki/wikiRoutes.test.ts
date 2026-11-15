import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";

const mockWikiServer = vi.hoisted(() => ({
    listWikiPages: vi.fn(),
    createWikiPage: vi.fn(),
    getWikiPage: vi.fn(),
    saveWikiPageEdit: vi.fn(),
    setWikiPageProtection: vi.fn(),
    deleteWikiPage: vi.fn(),
    getWikiRevisionList: vi.fn(),
    getWikiRevision: vi.fn(),
    revertWikiPage: vi.fn(),
    enforceWikiRateLimit: vi.fn(async () => undefined),
    resolveEditorInfo: vi.fn((nickname: string | undefined) => ({
        nickname: nickname?.trim() || "익명 버스러",
        editorId: "ed-test",
    })),
    isWikiAdminAuthorized: vi.fn(() => false),
    WikiServiceError: class WikiServiceError extends Error {
        status: number;
        payload?: unknown;
        constructor(message: string, status: number, payload?: unknown) {
            super(message);
            this.status = status;
            this.payload = payload;
        }
    },
}));

vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
}));

vi.mock("@entities/wiki/server", () => mockWikiServer);

import {GET as listWikiGET, POST as createWikiPOST} from "./route";
import {GET as getWikiGET, PUT as updateWikiPUT, PATCH as patchWikiPATCH} from "./[slug]/route";
import {POST as revertWikiPOST} from "./[slug]/revert/route";

describe("wiki API routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockWikiServer.isWikiAdminAuthorized.mockReturnValue(false);
    });

    it("lists wiki pages via GET /api/wiki", async () => {
        mockWikiServer.listWikiPages.mockResolvedValue({
            updatedAt: "2026-03-01T00:00:00.000Z",
            pages: [],
            recentChanges: [],
        });

        const req = new NextRequest("http://localhost/api/wiki?category=campus&q=연세&offset=24");
        const res = await listWikiGET(req);
        expect(res.status).toBe(200);
        expect(mockWikiServer.listWikiPages).toHaveBeenCalledWith({
            category: "campus",
            query: "연세",
            limit: undefined,
            offset: 24,
        });
    });

    it("rejects honeypot spam submissions with 400 on POST /api/wiki", async () => {
        const req = new NextRequest("http://localhost/api/wiki", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                slug: "spam-test",
                title: "스팸 테스트",
                category: "guide",
                website: "https://spam.example.com",
            }),
        });

        const res = await createWikiPOST(req);
        expect(res.status).toBe(400);
        expect(mockWikiServer.createWikiPage).not.toHaveBeenCalled();
    });

    it("forwards 409 conflict payload on PUT /api/wiki/[slug]", async () => {
        mockWikiServer.saveWikiPageEdit.mockRejectedValue(
            new mockWikiServer.WikiServiceError("편집 충돌", 409, {currentVersion: 5})
        );

        const req = new NextRequest("http://localhost/api/wiki/yonsei-mirae", {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                baseVersion: 2,
                title: "연세대 미래캠퍼스",
                category: "campus",
                markdownBody: "수정본",
            }),
        });

        const res = await updateWikiPUT(req, {params: Promise.resolve({slug: "yonsei-mirae"})});
        const body = await res.json();
        expect(res.status).toBe(409);
        expect(body.currentVersion).toBe(5);
    });

    it("returns 400 for invalid slug on GET /api/wiki/[slug]", async () => {
        const req = new NextRequest("http://localhost/api/wiki/edit");
        const res = await getWikiGET(req, {params: Promise.resolve({slug: "edit"})});
        expect(res.status).toBe(400);
    });

    it("requires admin bearer token for PATCH protection lock", async () => {
        const req = new NextRequest("http://localhost/api/wiki/yonsei-mirae", {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({isProtected: true}),
        });
        const res = await patchWikiPATCH(req, {params: Promise.resolve({slug: "yonsei-mirae"})});
        expect(res.status).toBe(401);
    });

    it("reverts wiki page on POST /api/wiki/[slug]/revert", async () => {
        mockWikiServer.revertWikiPage.mockResolvedValue({
            document: {slug: "yonsei-mirae", version: 4},
            revision: {version: 4},
        });

        const req = new NextRequest("http://localhost/api/wiki/yonsei-mirae/revert", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                targetVersion: 2,
                baseVersion: 3,
                nickname: "복구자",
            }),
        });
        const res = await revertWikiPOST(req, {params: Promise.resolve({slug: "yonsei-mirae"})});
        expect(res.status).toBe(200);
        expect(mockWikiServer.revertWikiPage).toHaveBeenCalledWith(
            expect.objectContaining({
                slug: "yonsei-mirae",
                targetVersion: 2,
                baseVersion: 3,
            })
        );
    });
});
