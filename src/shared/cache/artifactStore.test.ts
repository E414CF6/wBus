import {afterEach, describe, expect, it, vi} from "vitest";
import {artifactStore} from "./artifactStore";

const {mockBlobGet, mockBlobHead, mockBlobPut, mockFs} = vi.hoisted(() => ({
    mockBlobGet: vi.fn(),
    mockBlobHead: vi.fn(),
    mockBlobPut: vi.fn(),
    mockFs: {
        existsSync: vi.fn(),
        statSync: vi.fn(),
        readFileSync: vi.fn(),
        mkdirSync: vi.fn(),
        writeFileSync: vi.fn(),
    },
}));

vi.mock("@vercel/blob", () => ({
    get: mockBlobGet,
    head: mockBlobHead,
    put: mockBlobPut,
}));

vi.mock("fs", () => ({
    default: mockFs,
    ...mockFs,
}));

describe("artifactStore durability and /tmp freshness", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.clearAllMocks();
    });

    it("re-validates against Vercel Blob when /tmp mtime exceeds tmpMaxAgeMs", async () => {
        vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-blob-token");
        mockFs.existsSync.mockImplementation((p: string) => p === "/tmp/schedule.json");
        mockFs.statSync.mockReturnValue({mtimeMs: Date.now() - 10 * 60 * 1000});
        mockFs.readFileSync.mockReturnValue(JSON.stringify({version: "stale-tmp"}));

        const stream = new ReadableStream({
            start(controller) {
                controller.enqueue(new TextEncoder().encode(JSON.stringify({version: "fresh-blob"})));
                controller.close();
            },
        });
        mockBlobGet.mockResolvedValueOnce({statusCode: 200, stream});

        const res = await artifactStore.getJson<{ version: string }>("schedule.json", {tmpMaxAgeMs: 60_000});
        expect(res).toEqual({data: {version: "fresh-blob"}, source: "blob"});
        expect(mockBlobGet).toHaveBeenCalledWith("schedule.json", {access: "private"});
        expect(mockFs.writeFileSync).toHaveBeenCalled();
    });

    it("falls back to expired /tmp when Vercel Blob throws a transient error", async () => {
        vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-blob-token");
        mockFs.existsSync.mockImplementation((p: string) => p === "/tmp/schedule.json");
        mockFs.statSync.mockReturnValue({mtimeMs: Date.now() - 10 * 60 * 1000});
        mockFs.readFileSync.mockReturnValue(JSON.stringify({version: "stale-tmp"}));
        mockBlobGet.mockRejectedValueOnce(new Error("Blob network error"));

        const res = await artifactStore.getJson<{ version: string }>("schedule.json", {tmpMaxAgeMs: 60_000});
        expect(res).toEqual({data: {version: "stale-tmp"}, source: "tmp"});
    });

    it("reports checkHealth as ok even when Blob returns 404 not found, and unhealthy on auth errors", async () => {
        vi.stubEnv("BLOB_READ_WRITE_TOKEN", "test-blob-token");
        mockBlobHead.mockRejectedValueOnce(new Error("BlobNotFoundError: 404 Not Found"));
        const notFoundHealth = await artifactStore.checkHealth();
        expect(notFoundHealth.ok).toBe(true);
        expect(notFoundHealth.backend).toBe("vercel-blob");

        mockBlobHead.mockRejectedValueOnce(new Error("401 Unauthorized"));
        const authErrHealth = await artifactStore.checkHealth();
        expect(authErrHealth.ok).toBe(false);
    });
});
