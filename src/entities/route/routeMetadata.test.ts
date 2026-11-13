import {describe, expect, it} from "vitest";
import {getRouteMeta, registerDynamicRouteMeta} from "./routeMetadata";

describe("registerDynamicRouteMeta", () => {
    it("omits placeholder 00:00 first/last times when both start and end are 0000", () => {
        registerDynamicRouteMeta("32020", [
            {
                routeid: "WJB251000039",
                routeno: "test-3-1",
                routetp: "일반버스",
                startnodenm: "장양리 차고지",
                endnodenm: "장양리 차고지",
                startvehicletime: "0000",
                endvehicletime: "0000",
            },
        ]);

        const meta = getRouteMeta("test-3-1", "32020");
        expect(meta.firstTime).toBeUndefined();
        expect(meta.lastTime).toBeUndefined();
    });

    it("preserves valid first/last times when another variant omits them", () => {
        registerDynamicRouteMeta("32020", [
            {
                routeid: "WJB251000100",
                routeno: "test-30",
                routetp: "일반버스",
                startnodenm: "장양리",
                endnodenm: "연세대",
                startvehicletime: "0540",
                endvehicletime: "2230",
            },
            {
                routeid: "WJB251000101",
                routeno: "test-30",
                routetp: "일반버스",
                startnodenm: "장양리",
                endnodenm: "연세대",
                startvehicletime: "0000",
                endvehicletime: "0000",
            },
        ]);

        const meta = getRouteMeta("test-30", "32020");
        expect(meta.firstTime).toBe("05:40");
        expect(meta.lastTime).toBe("22:30");
    });
});
