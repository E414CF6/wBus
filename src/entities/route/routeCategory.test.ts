import {describe, expect, it} from "vitest";
import {resolveRouteCategory} from "./routeCategory";

describe("resolveRouteCategory", () => {
    it("classifies airport routes as AIRPORT (공항)", () => {
        expect(resolveRouteCategory("공항버스").id).toBe("AIRPORT");
        expect(resolveRouteCategory("공항버스").label).toBe("공항");
        expect(resolveRouteCategory("공항리무진").label).toBe("공항");
        expect(resolveRouteCategory("공항").label).toBe("공항");
    });

    it("classifies seat routes as SEAT (좌석)", () => {
        expect(resolveRouteCategory("좌석버스").id).toBe("SEAT");
        expect(resolveRouteCategory("좌석버스").label).toBe("좌석");
        expect(resolveRouteCategory("직행좌석버스").id).toBe("SEAT");
        expect(resolveRouteCategory("직행좌석버스").label).toBe("좌석");
        expect(resolveRouteCategory("좌석").label).toBe("좌석");
    });

    it("classifies express routes as EXPRESS (급행)", () => {
        expect(resolveRouteCategory("급행버스").id).toBe("EXPRESS");
        expect(resolveRouteCategory("급행버스").label).toBe("급행");
        expect(resolveRouteCategory("급행간선버스").id).toBe("EXPRESS");
    });

    it("classifies circular routes as CIRCULAR (순환)", () => {
        expect(resolveRouteCategory("순환버스").id).toBe("CIRCULAR");
        expect(resolveRouteCategory("순환버스").label).toBe("순환");
        expect(resolveRouteCategory("순환").label).toBe("순환");
    });

    it("classifies general routes as GENERAL (일반)", () => {
        expect(resolveRouteCategory("일반버스").id).toBe("GENERAL");
        expect(resolveRouteCategory("일반버스").label).toBe("일반");
        expect(resolveRouteCategory("시내버스").id).toBe("GENERAL");
        expect(resolveRouteCategory("일반").label).toBe("일반");
    });

    it("classifies trunk routes as MAIN (간선)", () => {
        expect(resolveRouteCategory("간선버스").id).toBe("MAIN");
        expect(resolveRouteCategory("간선버스").label).toBe("간선");
    });

    it("classifies feeder routes as BRANCH (지선)", () => {
        expect(resolveRouteCategory("지선버스").id).toBe("BRANCH");
        expect(resolveRouteCategory("지선버스").label).toBe("지선");
    });

    it("classifies village routes as VILLAGE (마을)", () => {
        expect(resolveRouteCategory("마을버스").id).toBe("VILLAGE");
        expect(resolveRouteCategory("마을버스").label).toBe("마을");
    });

    it("classifies wide-area routes as WIDE_AREA (광역)", () => {
        expect(resolveRouteCategory("광역버스").id).toBe("WIDE_AREA");
        expect(resolveRouteCategory("광역버스").label).toBe("광역");
    });

    it("classifies night routes as NIGHT (심야)", () => {
        expect(resolveRouteCategory("심야버스").id).toBe("NIGHT");
        expect(resolveRouteCategory("심야버스").label).toBe("심야");
    });

    it("classifies rural routes as RURAL (농어촌)", () => {
        expect(resolveRouteCategory("농어촌버스").id).toBe("RURAL");
        expect(resolveRouteCategory("농어촌버스").label).toBe("농어촌");
    });

    it("falls back cleanly to GENERAL when routeType is undefined or empty", () => {
        expect(resolveRouteCategory(undefined).id).toBe("GENERAL");
        expect(resolveRouteCategory("").id).toBe("GENERAL");
    });

    it("extracts cleaned category label for arbitrary custom route type", () => {
        expect(resolveRouteCategory("통학버스").label).toBe("통학");
        expect(resolveRouteCategory("수요응답형시내버스").label).toBe("수요응답");
    });
});
