import {describe, expect, it} from "vitest";
import {getRouteVariations} from "./api";

describe("getRouteVariations", () => {
    it("returns empty array for non-existent route", async () => {
        const variations = await getRouteVariations("INVALID_ROUTE_9999");
        expect(variations).toEqual([]);
    });

    it("loads single variation route (Route 4) with correct sequence", async () => {
        const variations = await getRouteVariations("4");
        expect(variations.length).toBe(1);
        const v = variations[0];
        expect(v.label).toBe("기본 노선");
        expect(v.stops.length).toBeGreaterThan(0);

        // Sequence must be strictly sorted by nodeord
        for (let i = 0; i < v.stops.length - 1; i++) {
            expect(v.stops[i].nodeord).toBeLessThan(v.stops[i + 1].nodeord);
        }
    });

    it("loads multi-variation route (Route 30) with distinct, non-corrupted variations", async () => {
        const variations = await getRouteVariations("30");
        expect(variations.length).toBeGreaterThan(1);

        // First variation must be the base route
        const base = variations[0];
        expect(base.label).toBe("기본 노선");
        expect(base.turningStop).not.toBeNull();
        expect(base.turningStop?.nodenm).toContain("연세대");

        // Every variation's stops must be monotonically ordered by nodeord without duplicates
        for (const variant of variations) {
            expect(variant.stops.length).toBeGreaterThan(0);
            const ords = variant.stops.map((s) => s.nodeord);
            const uniqueOrds = new Set(ords);
            expect(uniqueOrds.size).toBe(ords.length);

            for (let i = 0; i < variant.stops.length - 1; i++) {
                expect(variant.stops[i].nodeord).toBeLessThan(variant.stops[i + 1].nodeord);
            }
        }

        // Turning stop in base route transitions from ud=0 to ud=1
        if (base.turningStop) {
            const turnIndex = base.stops.findIndex((s) => s.nodeid === base.turningStop?.nodeid && s.nodeord === base.turningStop?.nodeord);
            expect(turnIndex).toBeGreaterThan(-1);
            expect(base.stops[turnIndex].updowncd).toBe(0);
            if (turnIndex < base.stops.length - 1) {
                expect(base.stops[turnIndex + 1].updowncd).toBe(1);
            }
        }
    });

    it("loads multi-variation route (Route 2) with friendly Korean labels and turning point", async () => {
        const variations = await getRouteVariations("2");
        expect(variations.length).toBeGreaterThanOrEqual(4);

        const labels = variations.map((v) => v.label);
        expect(labels[0]).toBe("기본 노선");

        // Turning stop in Route 2 base route
        const base = variations[0];
        expect(base.turningStop).not.toBeNull();
        expect(base.turningStop?.nodenm).toBe("삼일광장");

        // All variations must have valid labels and positive stop counts
        for (const v of variations) {
            expect(v.label.length).toBeGreaterThan(0);
            expect(v.stopCount).toBe(v.stops.length);
        }
    });
});
