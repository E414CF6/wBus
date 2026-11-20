import {describe, expect, it} from "vitest";
import {NextRequest} from "next/server";
import {dynamic, GET} from "./route";

describe("GET /api/cities", () => {
    it("is configured as force-dynamic so query parameters are evaluated per request", () => {
        expect(dynamic).toBe("force-dynamic");
    });

    it("filters cities by query string", async () => {
        const req = new NextRequest("http://localhost:3000/api/cities?query=원주");
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.success).toBe(true);
        expect(body.cities.some((c: { code: string }) => c.code === "32020")).toBe(true);
        expect(body.cities.length).toBeLessThan(10);
    });

    it("looks up a single city by code", async () => {
        const req = new NextRequest("http://localhost:3000/api/cities?code=32020");
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.city?.code).toBe("32020");
    });

    it("resolves nearest city from GPS coordinates", async () => {
        const req = new NextRequest("http://localhost:3000/api/cities?lat=37.3421&lng=127.91976");
        const res = await GET(req);
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.nearest?.code).toBe("32020");
    });
});
