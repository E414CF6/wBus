import {describe, expect, it} from "vitest";
import {classifyRouteType, getBusMarkerColor, ROUTE_TYPE_COLORS} from "./routeColor";
import {getRouteMeta} from "./routeMetadata";

describe("routeColor & data-driven classifyRouteType", () => {
    describe("Data-driven route classification based on routetp / routeType", () => {
        it("classifies village buses (마을버스, 마을) as VILLAGE (마을 - 연두)", () => {
            expect(classifyRouteType("종로01", "마을버스")).toBe("VILLAGE");
            expect(classifyRouteType("종로01", "마을")).toBe("VILLAGE");
            expect(classifyRouteType("강남01", "마을버스")).toBe("VILLAGE");
            expect(classifyRouteType("누리1", "마을/공영")).toBe("VILLAGE");
        });

        it("classifies branch & feeder & circular routes as BRANCH (지선 - 초록)", () => {
            expect(classifyRouteType("7016", "지선버스")).toBe("BRANCH");
            expect(classifyRouteType("7016", "지선")).toBe("BRANCH");
            expect(classifyRouteType("01", "순환버스")).toBe("BRANCH");
            expect(classifyRouteType("01", "순환")).toBe("BRANCH");
            expect(classifyRouteType("공영1", "공영버스")).toBe("BRANCH");
            expect(classifyRouteType("맞춤1", "맞춤형버스")).toBe("BRANCH");
            expect(classifyRouteType("농어촌1", "농어촌버스")).toBe("BRANCH");
        });

        it("classifies trunk & general city routes as MAIN (간선 - 파랑)", () => {
            expect(classifyRouteType("150", "간선버스")).toBe("MAIN");
            expect(classifyRouteType("150", "간선")).toBe("MAIN");
            expect(classifyRouteType("30", "일반버스")).toBe("MAIN");
            expect(classifyRouteType("30", "일반")).toBe("MAIN");
            expect(classifyRouteType("100", "시내버스")).toBe("MAIN");
        });

        it("classifies express, wide-area & night routes as EXPRESS (광역/급행 - 빨강)", () => {
            expect(classifyRouteType("9401", "광역버스")).toBe("EXPRESS");
            expect(classifyRouteType("9401", "광역")).toBe("EXPRESS");
            expect(classifyRouteType("급행1", "급행버스")).toBe("EXPRESS");
            expect(classifyRouteType("5002", "직행좌석버스")).toBe("EXPRESS");
            expect(classifyRouteType("3000", "좌석버스")).toBe("EXPRESS");
            expect(classifyRouteType("N13", "심야")).toBe("EXPRESS");
            expect(classifyRouteType("6001", "공항버스")).toBe("EXPRESS");
        });

        it("defaults cleanly to MAIN when routeTp is unspecified without number-based guessing", () => {
            expect(classifyRouteType("150")).toBe("MAIN");
            expect(classifyRouteType("7016")).toBe("MAIN");
            expect(classifyRouteType("9401")).toBe("MAIN");
            expect(classifyRouteType("01")).toBe("MAIN");
            expect(classifyRouteType("N13")).toBe("MAIN");
            expect(classifyRouteType("종로01")).toBe("MAIN");
        });
    });

    describe("Wonju static route metadata data-driven classification", () => {
        it("classifies Wonju general routes (30, 34, 34-1, 2) as MAIN via static routeType", () => {
            expect(getRouteMeta("30", "32020").genericType).toBe("MAIN");
            expect(getRouteMeta("30", "32020").routeType).toBe("일반버스");
            expect(getRouteMeta("34", "32020").genericType).toBe("MAIN");
            expect(getRouteMeta("2", "32020").genericType).toBe("MAIN");
        });

        it("classifies Wonju circular routes (3, 4, 16) as BRANCH via static routeType", () => {
            expect(getRouteMeta("3", "32020").genericType).toBe("BRANCH");
            expect(getRouteMeta("3", "32020").routeType).toBe("순환버스");
            expect(getRouteMeta("4-1", "32020").genericType).toBe("BRANCH");
            expect(getRouteMeta("16", "32020").genericType).toBe("BRANCH");
        });
    });

    describe("getBusMarkerColor", () => {
        it("returns blue for trunk route (MAIN)", () => {
            const colorUp = getBusMarkerColor("150", 1, undefined, undefined, undefined, undefined, "간선버스");
            expect(colorUp).toBe(ROUTE_TYPE_COLORS.MAIN.main);

            const colorDown = getBusMarkerColor("150", 0, undefined, undefined, undefined, undefined, "간선버스");
            expect(colorDown).toBe(ROUTE_TYPE_COLORS.MAIN.downMain);
        });

        it("returns green for branch route (BRANCH)", () => {
            const colorUp = getBusMarkerColor("7016", 1, undefined, undefined, undefined, undefined, "지선버스");
            expect(colorUp).toBe(ROUTE_TYPE_COLORS.BRANCH.main);

            const colorDown = getBusMarkerColor("7016", 0, undefined, undefined, undefined, undefined, "지선버스");
            expect(colorDown).toBe(ROUTE_TYPE_COLORS.BRANCH.downMain);
        });

        it("returns red for express route (EXPRESS)", () => {
            const colorUp = getBusMarkerColor("9401", 1, undefined, undefined, undefined, undefined, "광역버스");
            expect(colorUp).toBe(ROUTE_TYPE_COLORS.EXPRESS.main);

            const colorDown = getBusMarkerColor("9401", 0, undefined, undefined, undefined, undefined, "광역버스");
            expect(colorDown).toBe(ROUTE_TYPE_COLORS.EXPRESS.downMain);
        });

        it("returns lime for village bus (VILLAGE)", () => {
            const colorUp = getBusMarkerColor("종로01", 1, undefined, undefined, undefined, undefined, "마을");
            expect(colorUp).toBe(ROUTE_TYPE_COLORS.VILLAGE.main);

            const colorDown = getBusMarkerColor("종로01", 0, undefined, undefined, undefined, undefined, "마을");
            expect(colorDown).toBe(ROUTE_TYPE_COLORS.VILLAGE.downMain);
        });
    });
});
