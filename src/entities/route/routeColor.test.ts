import {describe, expect, it} from "vitest";
import {classifyRouteType, getBusMarkerColor, ROUTE_TYPE_COLORS} from "./routeColor";

describe("routeColor & classifyRouteType", () => {
    describe("Seoul route classification heuristics", () => {
        it("classifies 3-digit routes as MAIN (간선 - 파랑)", () => {
            expect(classifyRouteType("150")).toBe("MAIN");
            expect(classifyRouteType("753")).toBe("MAIN");
            expect(classifyRouteType("472")).toBe("MAIN");
        });

        it("classifies 4-digit routes starting with 1~8 as BRANCH (지선 - 초록)", () => {
            expect(classifyRouteType("7016")).toBe("BRANCH");
            expect(classifyRouteType("5511")).toBe("BRANCH");
            expect(classifyRouteType("7612")).toBe("BRANCH");
        });

        it("classifies 4-digit routes starting with 9 as EXPRESS (광역 - 빨강)", () => {
            expect(classifyRouteType("9401")).toBe("EXPRESS");
            expect(classifyRouteType("9711")).toBe("EXPRESS");
            expect(classifyRouteType("9701")).toBe("EXPRESS");
        });

        it("classifies 2-digit circular routes starting with 0 as BRANCH (순환 - 초록)", () => {
            expect(classifyRouteType("01")).toBe("BRANCH");
            expect(classifyRouteType("04")).toBe("BRANCH");
        });

        it("classifies N-prefixed night buses as EXPRESS (심야 - 빨강)", () => {
            expect(classifyRouteType("N13")).toBe("EXPRESS");
            expect(classifyRouteType("N16")).toBe("EXPRESS");
            expect(classifyRouteType("N62")).toBe("EXPRESS");
        });

        it("classifies town/village buses (한글 2글자 + 숫자) as BRANCH (마을 - 초록)", () => {
            expect(classifyRouteType("종로01")).toBe("BRANCH");
            expect(classifyRouteType("서초02")).toBe("BRANCH");
            expect(classifyRouteType("마포09")).toBe("BRANCH");
        });
    });

    describe("Wonju & other regions route classification", () => {
        it("classifies Wonju main routes (30, 34, 34-1) as MAIN", () => {
            expect(classifyRouteType("30")).toBe("MAIN");
            expect(classifyRouteType("34")).toBe("MAIN");
            expect(classifyRouteType("34-1")).toBe("MAIN");
        });

        it("classifies Wonju circular/branch routes (3, 4, 16) as BRANCH", () => {
            expect(classifyRouteType("3")).toBe("BRANCH");
            expect(classifyRouteType("4-1")).toBe("BRANCH");
            expect(classifyRouteType("16")).toBe("BRANCH");
        });

        it("respects explicit routeTp string from API", () => {
            expect(classifyRouteType("100", "광역버스")).toBe("EXPRESS");
            expect(classifyRouteType("100", "마을버스")).toBe("BRANCH");
            expect(classifyRouteType("100", "간선버스")).toBe("MAIN");
        });
    });

    describe("getBusMarkerColor", () => {
        it("returns blue for standard 3-digit Seoul trunk route", () => {
            const colorUp = getBusMarkerColor("150", 1);
            expect(colorUp).toBe(ROUTE_TYPE_COLORS.MAIN.main);

            const colorDown = getBusMarkerColor("150", 0);
            expect(colorDown).toBe(ROUTE_TYPE_COLORS.MAIN.downMain);
        });

        it("returns green for 4-digit Seoul branch route (e.g. 7016)", () => {
            const colorUp = getBusMarkerColor("7016", 1);
            expect(colorUp).toBe(ROUTE_TYPE_COLORS.BRANCH.main);

            const colorDown = getBusMarkerColor("7016", 0);
            expect(colorDown).toBe(ROUTE_TYPE_COLORS.BRANCH.downMain);
        });

        it("returns red for 9xxx Seoul express route (e.g. 9401)", () => {
            const colorUp = getBusMarkerColor("9401", 1);
            expect(colorUp).toBe(ROUTE_TYPE_COLORS.EXPRESS.main);
        });
    });
});
