import {afterEach, describe, expect, it, vi} from "vitest";
import {API_PRIORITY} from "@shared/utils/concurrency";
import {fetchAllPublicApiPages} from "./tagoClient";

describe("tagoClient pagination", () => {
    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllEnvs();
    });

    it("uses upstream effective page size when server clamps numOfRows below requested value", async () => {
        vi.stubEnv("DATA_GO_KR_SERVICE_KEY", "test-key");
        const requestedPages: string[] = [];

        vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
            const url = new URL(String(input));
            const pageNo = url.searchParams.get("pageNo") || "1";
            requestedPages.push(pageNo);

            const pageMap: Record<string, Array<{ routeid: string; routeno: string }>> = {
                "1": [
                    {routeid: "R1", routeno: "1"},
                    {routeid: "R2", routeno: "2"},
                ],
                "2": [
                    {routeid: "R3", routeno: "3"},
                    {routeid: "R4", routeno: "4"},
                ],
                "3": [{routeid: "R5", routeno: "5"}],
            };

            return new Response(
                JSON.stringify({
                    response: {
                        header: {resultCode: "00", resultMsg: "NORMAL SERVICE"},
                        body: {
                            totalCount: 5,
                            numOfRows: 2,
                            pageNo: Number(pageNo),
                            items: {item: pageMap[pageNo] || []},
                        },
                    },
                }),
                {status: 200, headers: {"Content-Type": "application/json"}}
            );
        });

        const items = await fetchAllPublicApiPages<{ routeid: string; routeno: string }>(
            "/BusRouteInfoInqireService/getRouteNoList",
            {cityCode: "32020", numOfRows: "2048"},
            API_PRIORITY.USER_INTERACTIVE,
            "test-pagination"
        );

        expect(requestedPages).toEqual(["1", "2", "3"]);
        expect(items.map((i) => i.routeid)).toEqual(["R1", "R2", "R3", "R4", "R5"]);
    });
});
