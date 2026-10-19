import {describe, expect, it} from "vitest";
import {getWikiBreadcrumbs, resolveWikiDoc, searchWikiDocs} from "./wikiRouter";
import type {BusRoute} from "@entities/schedule";

describe("resolveWikiDoc", () => {
    it("resolves 'all' or empty string to the current city root wiki document", () => {
        const doc = resolveWikiDoc("all", "32020");
        expect(doc.type).toBe("city");
        expect(doc.docId).toBe("city:32020");
        expect(doc.title).toBe("원주시 시내버스");
        expect(doc.parentDocId).toBeNull();
    });

    it("resolves 'yonsei' to the Yonsei Mirae Campus transit wiki document", () => {
        const doc = resolveWikiDoc("yonsei", "32020");
        expect(doc.type).toBe("yonsei");
        expect(doc.docId).toBe("yonsei");
        expect(doc.title).toBe("연세대학교 미래캠퍼스/교통");
        expect(doc.parentDocId).toBe("city:32020");
    });

    it("resolves 'yonsei-shuttle' to the Shuttle Bus wiki sub-document under Yonsei", () => {
        const doc = resolveWikiDoc("yonsei-shuttle", "32020");
        expect(doc.type).toBe("yonsei-shuttle");
        expect(doc.docId).toBe("yonsei-shuttle");
        expect(doc.title).toBe("연세대학교 미래캠퍼스/셔틀버스");
        expect(doc.parentDocId).toBe("yonsei");
        expect(doc.secondaryParentDocId).toBe("city:32020");
    });

    it("resolves 'route:34' with both Wonju city parent and Yonsei secondary parent", () => {
        const doc = resolveWikiDoc("route:34", "32020");
        expect(doc.type).toBe("route");
        expect(doc.routeNo).toBe("34");
        expect(doc.title).toBe("원주시 시내버스/34번");
        expect(doc.parentDocId).toBe("city:32020");
        expect(doc.secondaryParentDocId).toBe("yonsei");
    });

    it("resolves non-Yonsei route without secondaryParentDocId", () => {
        const doc = resolveWikiDoc("route:51", "32020");
        expect(doc.type).toBe("route");
        expect(doc.routeNo).toBe("51");
        expect(doc.title).toBe("원주시 시내버스/51번");
        expect(doc.parentDocId).toBe("city:32020");
        expect(doc.secondaryParentDocId).toBeNull();
    });

    it("resolves 'notices' and 'notice:123' hierarchy cleanly", () => {
        const listDoc = resolveWikiDoc("notices", "32020");
        expect(listDoc.type).toBe("notices");
        expect(listDoc.parentDocId).toBe("city:32020");

        const detailDoc = resolveWikiDoc("notice:123", "32020");
        expect(detailDoc.type).toBe("notice-detail");
        expect(detailDoc.noticeId).toBe("123");
        expect(detailDoc.parentDocId).toBe("notices");
    });
});

describe("getWikiBreadcrumbs", () => {
    it("builds hierarchical breadcrumbs for Yonsei shuttle article", () => {
        const crumbs = getWikiBreadcrumbs("yonsei-shuttle", "32020");
        expect(crumbs.map((c) => c.docId)).toEqual([
            "city:32020",
            "yonsei",
            "yonsei-shuttle",
        ]);
    });

    it("includes Yonsei hub in breadcrumbs for route:30", () => {
        const crumbs = getWikiBreadcrumbs("route:30", "32020");
        expect(crumbs.map((c) => c.docId)).toEqual([
            "city:32020",
            "yonsei",
            "route:30",
        ]);
    });
});

describe("searchWikiDocs", () => {
    const sampleRoutes: BusRoute[] = [
        {
            id: "34(평일)",
            rawNo: "34(평일)",
            routeNo: "34",
            dayType: "평일",
            origin: "장양리",
            destination: "연세대",
            firstBus: "06:05",
            lastBus: "22:05",
            runCount: "25",
            interval: "40",
            timetable: [],
        },
    ];

    it("finds route and campus wiki documents matching query", () => {
        const res = searchWikiDocs("연세대", sampleRoutes, ["34"], "32020");
        expect(res.some((r) => r.docId === "yonsei")).toBe(true);
        expect(res.some((r) => r.docId === "yonsei-shuttle")).toBe(true);
        expect(res.some((r) => r.docId === "route:34")).toBe(true);
    });
});
