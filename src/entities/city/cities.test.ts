import {describe, expect, it} from "vitest";
import {
    DEFAULT_CITY,
    findNearestCity,
    findNearestCityWithDistance,
    getCityByCode,
    NATIONWIDE_CITIES,
    resolveCityRegion,
    searchCities,
    sortCitiesByMajor,
} from "./cities";

describe("cities entity & nearest city resolution", () => {
    it("contains 140 nationwide cities/counties including Seoul", () => {
        expect(NATIONWIDE_CITIES.length).toBe(140);
    });

    describe("getCityByCode", () => {
        it("returns Seoul for code 11", () => {
            const city = getCityByCode("11");
            expect(city.name).toBe("서울특별시");
            expect(city.code).toBe("11");
        });

        it("returns Wonju for code 32020", () => {
            const city = getCityByCode("32020");
            expect(city.name).toBe("원주시");
            expect(city.code).toBe("32020");
        });

        it("returns Hoengseong for code 32320", () => {
            const city = getCityByCode("32320");
            expect(city.name).toBe("횡성군");
            expect(city.code).toBe("32320");
        });

        it("returns Busan for code 21", () => {
            const city = getCityByCode("21");
            expect(city.name).toBe("부산광역시");
            expect(city.code).toBe("21");
        });

        it("returns Seongju for code 37380", () => {
            const city = getCityByCode("37380");
            expect(city.name).toBe("성주군");
            expect(city.code).toBe("37380");
        });

        it("falls back to DEFAULT_CITY for unknown code", () => {
            const city = getCityByCode("99999");
            expect(city.code).toBe(DEFAULT_CITY.code);
        });
    });

    describe("findNearestCity", () => {
        it("identifies Seoul from Seoul City Hall coordinates", () => {
            const city = findNearestCity(37.5665, 126.9780);
            expect(city.code).toBe("11");
            expect(city.name).toBe("서울특별시");
        });

        it("identifies Wonju from Wonju coordinates", () => {
            // Wonju City Hall area
            const city = findNearestCity(37.3422, 127.9202);
            expect(city.code).toBe("32020");
            expect(city.name).toBe("원주시");
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
            expect(results.length).toBe(7);
            expect(results.every((c) => c.province.includes("강원"))).toBe(true);
        });

        it("returns all cities for empty query", () => {
            const results = searchCities("");
            expect(results.length).toBe(NATIONWIDE_CITIES.length);
        });
    });

    describe("sortCitiesByMajor", () => {
        it("places major metropolitan cities at the top (Seoul 1st)", () => {
            const sorted = sortCitiesByMajor(NATIONWIDE_CITIES);
            expect(sorted[0].name).toBe("서울특별시");
            expect(sorted[0].code).toBe("11");
            expect(sorted[1].name).toBe("부산광역시");
            expect(sorted[1].code).toBe("21");
            expect(sorted[2].name).toBe("인천광역시");
            expect(sorted[2].code).toBe("23");
        });

        it("does not force Wonju to the first position", () => {
            const sorted = sortCitiesByMajor(NATIONWIDE_CITIES);
            expect(sorted[0].code).not.toBe("32020");
            const wonjuIndex = sorted.findIndex((c) => c.code === "32020");
            expect(wonjuIndex).toBeGreaterThan(0);
        });

        it("places municipal cities before county ('군') areas", () => {
            const sorted = sortCitiesByMajor(NATIONWIDE_CITIES);
            const seoulIdx = sorted.findIndex((c) => c.code === "11");
            const suwonIdx = sorted.findIndex((c) => c.code === "31010");
            const hoengseongIdx = sorted.findIndex((c) => c.code === "32320"); // 횡성군

            expect(seoulIdx).toBeLessThan(suwonIdx);
            expect(suwonIdx).toBeLessThan(hoengseongIdx);
        });
    });

    describe("resolveCityRegion", () => {
        it("accurately classifies cities by geographic region", () => {
            const seoul = getCityByCode("11");
            const wonju = getCityByCode("32020");
            const daejeon = getCityByCode("25");
            const gwangju = getCityByCode("24");
            const busan = getCityByCode("21");
            const jeju = getCityByCode("39");

            expect(resolveCityRegion(seoul)).toBe("CAPITAL");
            expect(resolveCityRegion(wonju)).toBe("GANGWON");
            expect(resolveCityRegion(daejeon)).toBe("CHUNGCHEONG");
            expect(resolveCityRegion(gwangju)).toBe("JEOLLA");
            expect(resolveCityRegion(busan)).toBe("GYEONGSANG");
            expect(resolveCityRegion(jeju)).toBe("JEJU");
        });
    });
});
