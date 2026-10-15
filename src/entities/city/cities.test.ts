import {describe, expect, it} from "vitest";
import {
    DEFAULT_CITY,
    findNearestCity,
    findNearestCityWithDistance,
    getCityByCode,
    NATIONWIDE_CITIES,
    searchCities,
} from "./cities";

describe("cities entity & nearest city resolution", () => {
    it("contains 138 nationwide cities/counties", () => {
        expect(NATIONWIDE_CITIES.length).toBe(138);
    });

    describe("getCityByCode", () => {
        it("returns Wonju for code 32020", () => {
            const city = getCityByCode("32020");
            expect(city.name).toBe("원주시/횡성군");
            expect(city.code).toBe("32020");
        });

        it("returns Busan for code 21", () => {
            const city = getCityByCode("21");
            expect(city.name).toBe("부산광역시");
            expect(city.code).toBe("21");
        });

        it("falls back to DEFAULT_CITY for unknown code", () => {
            const city = getCityByCode("99999");
            expect(city.code).toBe(DEFAULT_CITY.code);
        });
    });

    describe("findNearestCity", () => {
        it("identifies Wonju from Wonju coordinates", () => {
            // Wonju City Hall area
            const city = findNearestCity(37.3422, 127.9202);
            expect(city.code).toBe("32020");
            expect(city.name).toBe("원주시/횡성군");
        });

        it("identifies Chuncheon from Chuncheon coordinates", () => {
            // Chuncheon Station area
            const city = findNearestCity(37.8813, 127.7298);
            expect(city.code).toBe("32010");
            expect(city.name).toBe("춘천시");
        });

        it("identifies Busan from Haeundae/Busan coordinates", () => {
            const city = findNearestCity(35.1796, 129.0756);
            expect(city.code).toBe("21");
            expect(city.name).toBe("부산광역시");
        });

        it("identifies Jeju from Jeju City coordinates", () => {
            const city = findNearestCity(33.4996, 126.5312);
            expect(city.code).toBe("39");
            expect(city.name).toBe("제주도");
        });
    });

    describe("findNearestCityWithDistance", () => {
        it("calculates accurate distance in km", () => {
            // Exactly at Wonju center coordinates
            const result = findNearestCityWithDistance(37.3422, 127.9202);
            expect(result.city.code).toBe("32020");
            expect(result.distanceKm).toBeLessThan(1.0);
        });

        it("returns realistic distance when a few km away from center", () => {
            // Near Wonju Innovation City (~6km away)
            const result = findNearestCityWithDistance(37.3200, 127.9800);
            expect(result.city.code).toBe("32020");
            expect(result.distanceKm).toBeGreaterThan(4.0);
            expect(result.distanceKm).toBeLessThan(10.0);
        });
    });

    describe("searchCities", () => {
        it("finds city by exact or partial name", () => {
            const results = searchCities("원주");
            expect(results.some((c) => c.code === "32020")).toBe(true);
        });

        it("finds cities by province", () => {
            const results = searchCities("강원");
            expect(results.length).toBe(6);
            expect(results.every((c) => c.province.includes("강원"))).toBe(true);
        });

        it("returns all cities for empty query", () => {
            const results = searchCities("");
            expect(results.length).toBe(NATIONWIDE_CITIES.length);
        });
    });
});
