import {describe, expect, it} from "vitest";
import {resolveTurnaroundStop} from "./TimetablePinMarker";
import type {RouteVariation, RouteVariationStop} from "@entities/route";

describe("resolveTurnaroundStop", () => {
    const makeStop = (
        id: string,
        name: string,
        ord: number,
        ud: number,
        lat: number = 37.35,
        lon: number = 127.95
    ): RouteVariationStop => ({
        nodeid: id,
        nodenm: name,
        nodeord: ord,
        updowncd: ud,
        gpslati: lat,
        gpslong: lon,
        nodeno: id,
    });

    it("prioritizes variant.turningStop when valid coordinates exist", () => {
        const turning = makeStop("S2", "연세대 회차지", 2, 0, 37.28, 127.90);
        const stops = [
            makeStop("S1", "관설동 종점", 1, 0),
            turning,
            makeStop("S3", "관설동 종점", 3, 1),
        ];
        const variant: RouteVariation = {
            routeId: "R1",
            label: "기본 노선",
            stops,
            stopCount: 3,
            turningStop: turning,
        };

        const result = resolveTurnaroundStop(variant, stops);
        expect(result).toBe(turning);
    });

    it("falls back to explicit stop with '회차' in station name", () => {
        const stops = [
            makeStop("S1", "장양리 차고지", 1, 0),
            makeStop("S2", "원주역", 2, 0),
            makeStop("S3", "연세대 회차지", 3, 0, 37.28, 127.91),
            makeStop("S4", "장양리 차고지", 4, 0),
        ];
        const variant: RouteVariation = {
            routeId: "R2",
            label: "기본 노선",
            stops,
            stopCount: 4,
            turningStop: null,
        };

        const result = resolveTurnaroundStop(variant, stops);
        expect(result).not.toBeNull();
        expect(result?.nodenm).toBe("연세대 회차지");
    });

    it("detects transition from outbound (ud 0) to inbound (ud 1)", () => {
        const turnaround = makeStop("S3", "삼일광장", 3, 0, 37.33, 127.93);
        const stops = [
            makeStop("S1", "관설동 종점", 1, 0),
            makeStop("S2", "남부시장", 2, 0),
            turnaround,
            makeStop("S4", "원주중학교", 4, 1),
            makeStop("S5", "관설동 종점", 5, 1),
        ];
        const variant: RouteVariation = {
            routeId: "R3",
            label: "기본 노선",
            stops,
            stopCount: 5,
            turningStop: null,
        };

        const result = resolveTurnaroundStop(variant, stops);
        expect(result).toBe(turnaround);
    });

    it("matches destination hint from timetable when available", () => {
        const stops = [
            makeStop("S1", "장양리 차고지", 1, 0),
            makeStop("S2", "시외버스터미널", 2, 0),
            makeStop("S3", "횡성축협", 3, 0, 37.49, 127.98),
            makeStop("S4", "장양리 차고지", 4, 0),
        ];
        const variant: RouteVariation = {
            routeId: "R4",
            label: "기본 노선",
            stops,
            stopCount: 4,
            turningStop: null,
        };

        const result = resolveTurnaroundStop(variant, stops, "횡성");
        expect(result).not.toBeNull();
        expect(result?.nodenm).toBe("횡성축협");
    });

    it("falls back to middle stop for loop routes with all identical ud", () => {
        const mid = makeStop("S2", "명륜2동주민센터", 2, 0, 37.34, 127.94);
        const stops = [
            makeStop("S1", "장양리 차고지", 1, 0),
            mid,
            makeStop("S3", "장양리 차고지", 3, 0),
        ];
        const variant: RouteVariation = {
            routeId: "R5",
            label: "기본 노선",
            stops,
            stopCount: 3,
            turningStop: null,
        };

        const result = resolveTurnaroundStop(variant, stops);
        expect(result).toBe(mid);
    });
});
