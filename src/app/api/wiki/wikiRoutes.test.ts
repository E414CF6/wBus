import {beforeEach, describe, expect, it, vi} from "vitest";
import {NextRequest} from "next/server";
import {GET as listWikiGET, POST as createWikiPOST} from "./route";
import {GET as getWikiGET, PATCH as patchWikiPATCH, PUT as updateWikiPUT} from "./[slug]/route";
import {PATCH as patchWikiPinPATCH} from "./[slug]/pin/route";
import {POST as revertWikiPOST} from "./[slug]/revert/route";
import {GET as listDiscussionsGET, POST as createDiscussionPOST} from "./[slug]/discussions/route";
import {PATCH as patchDiscussionPATCH} from "./[slug]/discussions/[threadId]/route";
import {POST as createDiscussionCommentPOST} from "./[slug]/discussions/[threadId]/comments/route";

const mockWikiServer = vi.hoisted(() => ({
    listWikiPages: vi.fn(),
    createWikiPage: vi.fn(),
    getWikiPage: vi.fn(),
    saveWikiPageEdit: vi.fn(),
    updateWikiPinMeta: vi.fn(),
    setWikiPageProtection: vi.fn(),
    deleteWikiPage: vi.fn(),
    getWikiRevisionList: vi.fn(),
    getWikiRevision: vi.fn(),
    revertWikiPage: vi.fn(),
    listWikiDiscussions: vi.fn(),
    createWikiDiscussionThread: vi.fn(),
    addWikiDiscussionComment: vi.fn(),
    updateWikiDiscussionStatus: vi.fn(),
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

        const req = new NextRequest("http://localhost/api/wiki?q=원주&offset=24");
        const res = await listWikiGET(req);
        expect(res.status).toBe(200);
        expect(mockWikiServer.listWikiPages).toHaveBeenCalledWith({
            query: "원주",
            limit: undefined,
            offset: 24,
        });
    });

    it("forwards pinsOnly filter on GET /api/wiki", async () => {
        mockWikiServer.listWikiPages.mockResolvedValue({
            updatedAt: "2026-03-01T00:00:00.000Z",
            pages: [],
            recentChanges: [],
        });

        const req = new NextRequest("http://localhost/api/wiki?pinsOnly=true&limit=100");
        const res = await listWikiGET(req);
        expect(res.status).toBe(200);
        expect(mockWikiServer.listWikiPages).toHaveBeenCalledWith({
            query: undefined,
            limit: 100,
            offset: undefined,
            pinsOnly: true,
        });
    });

    it("passes lat/lng map pin coordinates and pinColor on POST /api/wiki", async () => {
        mockWikiServer.createWikiPage.mockResolvedValue({
            slug: "원주역 광장 핀",
            title: "원주역 광장 핀",
            subtitle: "",
            pinColor: "emerald",
            lat: 37.3152,
            lng: 127.9222,
            tags: ["원주역"],
            version: 1,
            createdAt: "2026-03-01T00:00:00.000Z",
            updatedAt: "2026-03-01T00:00:00.000Z",
            lastEditor: {nickname: "익명 버스러", editorId: "ed-test"},
            markdownBody: "",
        });

        const req = new NextRequest("http://localhost/api/wiki", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                title: "원주역 광장 핀",
                pinColor: "emerald",
                lat: 37.3152,
                lng: 127.9222,
                tags: ["원주역"],
            }),
        });

        const res = await createWikiPOST(req);
        expect(res.status).toBe(201);
        expect(mockWikiServer.createWikiPage).toHaveBeenCalledWith(
            expect.objectContaining({
                title: "원주역 광장 핀",
                pinColor: "emerald",
                lat: 37.3152,
                lng: 127.9222,
            }),
        );
    });

    it("rejects honeypot spam submissions with 400 on POST /api/wiki", async () => {
        const req = new NextRequest("http://localhost/api/wiki", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                slug: "spam-test",
                title: "스팸 테스트",
                pinColor: "navy",
                website: "https://spam.example.com",
            }),
        });

        const res = await createWikiPOST(req);
        expect(res.status).toBe(400);
        expect(mockWikiServer.createWikiPage).not.toHaveBeenCalled();
    });

    it("forwards 409 conflict payload on PUT /api/wiki/[slug]", async () => {
        mockWikiServer.saveWikiPageEdit.mockRejectedValue(
            new mockWikiServer.WikiServiceError("편집 충돌", 409, {currentVersion: 5}),
        );

        const req = new NextRequest("http://localhost/api/wiki/테스트-문서", {
            method: "PUT",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                baseVersion: 2,
                title: "테스트 문서",
                pinColor: "blue",
                markdownBody: "수정본",
            }),
        });

        const res = await updateWikiPUT(req, {params: Promise.resolve({slug: "테스트 문서"})});
        const body = await res.json();
        expect(res.status).toBe(409);
        expect(body.currentVersion).toBe(5);
    });

    it("updates pin location and color on PATCH /api/wiki/[slug]/pin", async () => {
        mockWikiServer.updateWikiPinMeta.mockResolvedValue({
            document: {
                slug: "테스트 문서",
                pinColor: "violet",
                lat: 37.35,
                lng: 127.95,
                version: 3,
            },
            revision: {version: 3},
        });

        const req = new NextRequest("http://localhost/api/wiki/테스트 문서/pin", {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                baseVersion: 2,
                pinColor: "violet",
                lat: 37.35,
                lng: 127.95,
                nickname: "편집자",
            }),
        });

        const res = await patchWikiPinPATCH(req, {
            params: Promise.resolve({slug: encodeURIComponent("테스트 문서")}),
        });
        expect(res.status).toBe(200);
        expect(mockWikiServer.updateWikiPinMeta).toHaveBeenCalledWith(
            expect.objectContaining({
                slug: "테스트 문서",
                baseVersion: 2,
                pinColor: "violet",
                lat: 37.35,
                lng: 127.95,
            }),
        );
    });

    it("returns 400 when PATCH /api/wiki/[slug]/pin omits both pinColor and coords", async () => {
        const req = new NextRequest("http://localhost/api/wiki/테스트 문서/pin", {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({baseVersion: 1}),
        });

        const res = await patchWikiPinPATCH(req, {
            params: Promise.resolve({slug: encodeURIComponent("테스트 문서")}),
        });
        expect(res.status).toBe(400);
        expect(mockWikiServer.updateWikiPinMeta).not.toHaveBeenCalled();
    });

    it("returns 400 for invalid slug on GET /api/wiki/[slug]", async () => {
        const req = new NextRequest("http://localhost/api/wiki/edit");
        const res = await getWikiGET(req, {params: Promise.resolve({slug: "edit"})});
        expect(res.status).toBe(400);
    });

    it("requires admin bearer token for PATCH protection lock", async () => {
        const req = new NextRequest("http://localhost/api/wiki/테스트 문서", {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({isProtected: true}),
        });
        const res = await patchWikiPATCH(req, {params: Promise.resolve({slug: "테스트 문서"})});
        expect(res.status).toBe(401);
    });

    it("reverts wiki page on POST /api/wiki/[slug]/revert", async () => {
        mockWikiServer.revertWikiPage.mockResolvedValue({
            document: {slug: "테스트 문서", version: 4},
            revision: {version: 4},
        });

        const req = new NextRequest("http://localhost/api/wiki/테스트 문서/revert", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                targetVersion: 2,
                baseVersion: 3,
                nickname: "복구자",
            }),
        });
        const res = await revertWikiPOST(req, {params: Promise.resolve({slug: "테스트 문서"})});
        expect(res.status).toBe(200);
        expect(mockWikiServer.revertWikiPage).toHaveBeenCalledWith(
            expect.objectContaining({
                slug: "테스트 문서",
                targetVersion: 2,
                baseVersion: 3,
            }),
        );
    });

    it("lists discussions via GET /api/wiki/[slug]/discussions", async () => {
        mockWikiServer.listWikiDiscussions.mockResolvedValue({
            slug: "원주역",
            openCount: 1,
            resolvedCount: 0,
            threads: [],
        });

        const req = new NextRequest("http://localhost/api/wiki/원주역/discussions?status=open");
        const res = await listDiscussionsGET(req, {
            params: Promise.resolve({slug: encodeURIComponent("원주역")}),
        });
        expect(res.status).toBe(200);
        expect(mockWikiServer.listWikiDiscussions).toHaveBeenCalledWith("원주역", "open");
    });

    it("creates discussion thread via POST and rejects honeypot", async () => {
        mockWikiServer.createWikiDiscussionThread.mockResolvedValue({
            id: 1,
            slug: "원주역",
            title: "막차 시간 확인",
            status: "open",
            author: {nickname: "익명 버스러", editorId: "ed-test"},
            commentCount: 1,
            lastCommentAt: "2026-11-19T00:00:00.000Z",
            createdAt: "2026-11-19T00:00:00.000Z",
            comments: [],
        });

        const spamReq = new NextRequest("http://localhost/api/wiki/원주역/discussions", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                title: "스팸",
                body: "내용입니다",
                website: "https://spam.example",
            }),
        });
        const spamRes = await createDiscussionPOST(spamReq, {
            params: Promise.resolve({slug: encodeURIComponent("원주역")}),
        });
        expect(spamRes.status).toBe(400);

        const okReq = new NextRequest("http://localhost/api/wiki/원주역/discussions", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({
                title: "막차 시간 확인",
                body: "30번 막차가 22:30으로 바뀐 것 같습니다.",
                nickname: "제보자",
            }),
        });
        const okRes = await createDiscussionPOST(okReq, {
            params: Promise.resolve({slug: encodeURIComponent("원주역")}),
        });
        expect(okRes.status).toBe(201);
        expect(mockWikiServer.enforceWikiRateLimit).toHaveBeenCalledWith("ed-test", "discussion");
        expect(mockWikiServer.createWikiDiscussionThread).toHaveBeenCalledWith(
            expect.objectContaining({
                slug: "원주역",
                title: "막차 시간 확인",
            }),
        );
    });

    it("adds reply comment and updates thread status", async () => {
        mockWikiServer.addWikiDiscussionComment.mockResolvedValue({
            comment: {
                id: 2,
                threadId: 1,
                body: "확인했습니다.",
                author: {nickname: "버스러", editorId: "ed-test"},
                createdAt: "2026-11-19T00:01:00.000Z",
            },
            commentCount: 2,
            lastCommentAt: "2026-11-19T00:01:00.000Z",
        });

        const commentReq = new NextRequest("http://localhost/api/wiki/원주역/discussions/1/comments", {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({body: "확인했습니다."}),
        });
        const commentRes = await createDiscussionCommentPOST(commentReq, {
            params: Promise.resolve({slug: encodeURIComponent("원주역"), threadId: "1"}),
        });
        expect(commentRes.status).toBe(201);

        mockWikiServer.updateWikiDiscussionStatus.mockResolvedValue({
            id: 1,
            slug: "원주역",
            title: "막차 시간 확인",
            status: "resolved",
        });

        const patchReq = new NextRequest("http://localhost/api/wiki/원주역/discussions/1", {
            method: "PATCH",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify({status: "resolved", nickname: "정리자"}),
        });
        const patchRes = await patchDiscussionPATCH(patchReq, {
            params: Promise.resolve({slug: encodeURIComponent("원주역"), threadId: "1"}),
        });
        expect(patchRes.status).toBe(200);
        expect(mockWikiServer.updateWikiDiscussionStatus).toHaveBeenCalledWith(
            expect.objectContaining({slug: "원주역", threadId: 1, status: "resolved"}),
        );
    });
});
