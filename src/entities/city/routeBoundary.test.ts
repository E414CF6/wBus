import {describe, expect, it} from "vitest";
import {
    filterRouteIdsByCity,
    filterRouteNumbersMapByCity,
    filterRoutesByCity,
    getCityBoundaryErrorMessage,
    isRouteAllowedInCity,
} from "./routeBoundary";

describe("routeBoundary", () => {
    it("isolates Wonju (32020) and Hoengseong (32320) route IDs", () => {
        expect(isRouteAllowedInCity("32020", "WJB251000030")).toBe(true);
        expect(isRouteAllowedInCity("32020", "WJB258002001")).toBe(false);
        expect(isRouteAllowedInCity("32320", "WJB258002001")).toBe(true);
        expect(isRouteAllowedInCity("32320", "WJB251000030")).toBe(false);
        expect(isRouteAllowedInCity("11", "100100118")).toBe(true);
    });

    it("filters routeId lists and route objects by cityCode", () => {
        const ids = ["WJB251000030", "WJB258002001"];
        expect(filterRouteIdsByCity("32020", ids)).toEqual(["WJB251000030"]);
        expect(filterRouteIdsByCity("32320", ids)).toEqual(["WJB258002001"]);
        expect(filterRouteIdsByCity("32010", ids)).toEqual(ids);

        const routes = [{routeid: "WJB251000030"}, {routeid: "WJB258002001"}];
        expect(filterRoutesByCity("32020", routes)).toEqual([{routeid: "WJB251000030"}]);
        expect(filterRoutesByCity("32320", routes)).toEqual([{routeid: "WJB258002001"}]);
    });

    it("cleans route_numbers map and detects contamination", () => {
        const {cleaned, hadContamination} = filterRouteNumbersMapByCity("32020", {
            "30": ["WJB251000030"],
            "2": ["WJB258002001"],
        });
        expect(hadContamination).toBe(true);
        expect(cleaned).toEqual({"30": ["WJB251000030"]});
    });

    it("returns descriptive boundary error messages", () => {
        expect(getCityBoundaryErrorMessage("32020", "WJB258002001")).toContain("Hoengseong");
        expect(getCityBoundaryErrorMessage("32320", "WJB251000036")).toContain("Wonju");
        expect(getCityBoundaryErrorMessage("32020", "WJB251000036")).toBeNull();
    });
});
