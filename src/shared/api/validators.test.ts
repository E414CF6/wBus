import {describe, expect, it} from "vitest";
import {ApiValidators} from "./validators";

describe("ApiValidators", () => {
    describe("isValidRouteId", () => {
        it("accepts valid route IDs", () => {
            expect(ApiValidators.isValidRouteId("WJB251000068")).toBe(true);
            expect(ApiValidators.isValidRouteId("30")).toBe(true);
            expect(ApiValidators.isValidRouteId("GWB320200030")).toBe(true);
            expect(ApiValidators.isValidRouteId("route_123-abc")).toBe(true);
        });

        it("rejects malicious or invalid route IDs", () => {
            expect(ApiValidators.isValidRouteId("")).toBe(false);
            expect(ApiValidators.isValidRouteId(null)).toBe(false);
            expect(ApiValidators.isValidRouteId("route/../../etc")).toBe(false);
            expect(ApiValidators.isValidRouteId("route; DROP TABLE")).toBe(false);
            expect(ApiValidators.isValidRouteId("a".repeat(51))).toBe(false);
        });
    });

    describe("isValidCityCode", () => {
        it("accepts valid MOLIT city codes", () => {
            expect(ApiValidators.isValidCityCode("32020")).toBe(true); // Wonju
            expect(ApiValidators.isValidCityCode("11")).toBe(true);    // Seoul
            expect(ApiValidators.isValidCityCode("21")).toBe(true);    // Busan
            expect(ApiValidators.isValidCityCode("39")).toBe(true);    // Jeju
        });

        it("rejects non-numeric, too short or too long city codes", () => {
            expect(ApiValidators.isValidCityCode("1")).toBe(false);
            expect(ApiValidators.isValidCityCode("wonju")).toBe(false);
            expect(ApiValidators.isValidCityCode("32020; injection")).toBe(false);
            expect(ApiValidators.isValidCityCode("")).toBe(false);
            expect(ApiValidators.isValidCityCode(null)).toBe(false);
        });
    });

    describe("resolveCityCode", () => {
        it("returns the sanitized valid city code", () => {
            expect(ApiValidators.resolveCityCode("32020")).toBe("32020");
            expect(ApiValidators.resolveCityCode(" 11 ")).toBe("11");
            expect(ApiValidators.resolveCityCode("25")).toBe("25");
        });

        it("falls back to default fallback (32020) for invalid inputs", () => {
            expect(ApiValidators.resolveCityCode("malicious-code")).toBe("32020");
            expect(ApiValidators.resolveCityCode("")).toBe("32020");
            expect(ApiValidators.resolveCityCode(null)).toBe("32020");
            expect(ApiValidators.resolveCityCode(undefined)).toBe("32020");
            expect(ApiValidators.resolveCityCode("malicious", "21")).toBe("21");
        });
    });
});
