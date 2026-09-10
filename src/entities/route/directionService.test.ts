import {describe, expect, it} from "vitest";
import {buildDirectionLookup, type DirectionResolverState, resolveDirection} from "./directionService";
import {Direction} from "./types";

describe("directionService", () => {
    const mockState: DirectionResolverState = {
        routeIdOrder: ["ROUTE_UP", "ROUTE_DOWN"],
        sequences: [
            {
                routeid: "ROUTE_UP",
                sequence: [
                    {nodeid: "STOP_1", nodeord: 1, updowncd: 1},
                    {nodeid: "STOP_2", nodeord: 2, updowncd: 1},
                    {nodeid: "STOP_TURN_UP", nodeord: 3, updowncd: 1},
                ],
            },
            {
                routeid: "ROUTE_DOWN",
                sequence: [
                    {nodeid: "STOP_TURN_UP", nodeord: 1, updowncd: 0},
                    {nodeid: "STOP_3", nodeord: 2, updowncd: 0},
                    {nodeid: "STOP_TURN_DOWN", nodeord: 3, updowncd: 0},
                ],
            },
        ],
    };

    const lookup = buildDirectionLookup(mockState);

    it("correctly identifies UP direction for outbound stops", () => {
        const dir = resolveDirection(lookup, "STOP_1", 1, "ROUTE_UP");
        expect(dir).toBe(Direction.UP);
    });

    it("correctly identifies DOWN direction for inbound stops", () => {
        const dir = resolveDirection(lookup, "STOP_3", 2, "ROUTE_DOWN");
        expect(dir).toBe(Direction.DOWN);
    });

    it("switches direction at UP turning point", () => {
        // Turning point of UP route switches to DOWN
        const dir = resolveDirection(lookup, "STOP_TURN_UP", 3, "ROUTE_UP");
        expect(dir).toBe(Direction.DOWN);
    });

    it("switches direction at DOWN turning point", () => {
        // Turning point of DOWN route switches to UP
        const dir = resolveDirection(lookup, "STOP_TURN_DOWN", 3, "ROUTE_DOWN");
        expect(dir).toBe(Direction.UP);
    });

    it("returns null for non-existent or invalid stop inputs", () => {
        expect(resolveDirection(lookup, null, 1)).toBeNull();
        expect(resolveDirection(lookup, "", 1)).toBeNull();
        expect(resolveDirection(lookup, "NON_EXISTENT", Number.NaN)).toBeNull();
    });

    it("matches closest nodeord when exact match is missing", () => {
        // STOP_2 exists with nodeord 2; query with nodeord 5 should match closest candidate
        const dir = resolveDirection(lookup, "STOP_2", 5, "ROUTE_UP");
        expect(dir).toBe(Direction.UP);
    });
});
