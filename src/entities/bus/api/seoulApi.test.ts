import {describe, expect, it} from "vitest";
import {
    extractSeoulWsItems,
    isWithinSeoulBounds,
    mapSeoulRouteType,
    mapSeoulVehicleType,
    normalizeSeoulBusPosItem,
    parseSeoulXmlItems,
    type SeoulBusPosItem,
} from "./seoulApi";
import {getRouteOperatingWindow, isRouteInServiceWindow} from "./routeWindow";

describe("Seoul Bus OpenAPI (ws.bus.go.kr / TOPIS) parser & normalizer", () => {
    describe("extractSeoulWsItems & parseSeoulXmlItems", () => {
        it("extracts items from JSON ServiceResult / msgBody.itemList", () => {
            const sampleJson = {
                msgHeader: {
                    headerCd: "0",
                    headerMsg: "정상적으로 처리되었습니다.",
                    itemCount: 0,
                },
                msgBody: {
                    itemList: [
                        {
                            vehId: "111033115",
                            plainNo: "서울74사2576",
                            sectOrd: "1",
                            gpsX: "126.910807",
                            gpsY: "37.614178",
                            lastStnId: "111000055",
                            busType: "1",
                            isrunyn: "1",
                        },
                    ],
                },
            };

            const items = extractSeoulWsItems<SeoulBusPosItem>(sampleJson);
            expect(items).toHaveLength(1);
            expect(items[0].plainNo).toBe("서울74사2576");
            expect(items[0].gpsX).toBe("126.910807");
        });

        it("returns empty array when headerCd is 4 (결과가 없습니다)", () => {
            const emptyJson = {
                msgHeader: {
                    headerCd: "4",
                    headerMsg: "결과가 없습니다.",
                    itemCount: 0,
                },
                msgBody: {
                    itemList: null,
                },
            };

            expect(extractSeoulWsItems(emptyJson)).toEqual([]);
        });

        it("parses XML <ServiceResult> responses from ws.bus.go.kr", () => {
            const sampleXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<ServiceResult>
    <msgHeader>
        <headerCd>0</headerCd>
        <headerMsg>정상적으로 처리되었습니다.</headerMsg>
        <itemCount>0</itemCount>
    </msgHeader>
    <msgBody>
        <itemList>
            <busType>1</busType>
            <congetion>3</congetion>
            <dataTm>20230525134334</dataTm>
            <gpsX>126.910807</gpsX>
            <gpsY>37.614178</gpsY>
            <isFullFlag>0</isFullFlag>
            <islastyn>0</islastyn>
            <isrunyn>1</isrunyn>
            <lastStnId>111000055</lastStnId>
            <plainNo>서울74사2576</plainNo>
            <sectOrd>1</sectOrd>
            <stopFlag>0</stopFlag>
            <trnstnid>119000077</trnstnid>
            <vehId>111033115</vehId>
        </itemList>
    </msgBody>
</ServiceResult>`;

            const parsed = parseSeoulXmlItems<SeoulBusPosItem>(sampleXml);
            expect(parsed.headerCd).toBe("0");
            expect(parsed.items).toHaveLength(1);
            expect(parsed.items[0].plainNo).toBe("서울74사2576");

            const extracted = extractSeoulWsItems<SeoulBusPosItem>(sampleXml);
            expect(extracted).toHaveLength(1);
            expect(extracted[0].vehId).toBe("111033115");
        });
    });

    describe("normalizeSeoulBusPosItem", () => {
        it("maps gpsX/gpsY from getBusPosByRtid to gpslong/gpslati and enriches stop name", () => {
            const stopLookup = new Map([
                [5, {nodeid: "111000184", nodenm: "갈현동성당앞", routenm: "753"}],
            ]);

            const normalized = normalizeSeoulBusPosItem(
                {
                    vehId: "111033182",
                    plainNo: "서울74사4510",
                    sectOrd: "5",
                    gpsX: "126.919052",
                    gpsY: "37.623334",
                    lastStnId: "111000184",
                    isrunyn: "1",
                },
                "100100118",
                stopLookup
            );

            expect(normalized).toEqual({
                routeid: "100100118",
                routenm: "753",
                gpslati: 37.623334,
                gpslong: 126.919052,
                vehicleno: "서울74사4510",
                nodeid: "111000184",
                nodenm: "갈현동성당앞",
                nodeord: 5,
            });
        });

        it("supports tmX/tmY fallback for getBusPosByRouteSt and getLowBusPosByRtid", () => {
            const normalized = normalizeSeoulBusPosItem(
                {
                    vehId: "111033115",
                    plainNo: "서울74사2576",
                    sectOrd: "10",
                    gpsX: null,
                    gpsY: null,
                    tmX: "126.9780",
                    tmY: "37.5665",
                    lastStnId: "101000290",
                    isrunyn: "1",
                },
                "100100118"
            );

            expect(normalized).not.toBeNull();
            expect(normalized?.gpslati).toBe(37.5665);
            expect(normalized?.gpslong).toBe(126.978);
            expect(normalized?.nodeord).toBe(10);
        });

        it("filters out non-running vehicles (isrunyn === '0')", () => {
            const normalized = normalizeSeoulBusPosItem(
                {
                    vehId: "111033115",
                    plainNo: "서울74사2576",
                    sectOrd: "1",
                    gpsX: "126.9780",
                    gpsY: "37.5665",
                    isrunyn: "0",
                },
                "100100118"
            );
            expect(normalized).toBeNull();
        });

        it("populates routenm directly from resolved routeName parameter", () => {
            const normalized = normalizeSeoulBusPosItem(
                {
                    vehId: "111033668",
                    plainNo: "서울75사2646",
                    sectOrd: "8",
                    gpsX: "126.919635",
                    gpsY: "37.617730",
                    lastStnId: "111000115",
                    isrunyn: "1",
                },
                "100100118",
                undefined,
                "753"
            );
            expect(normalized).not.toBeNull();
            expect(normalized?.routenm).toBe("753");
            expect(normalized?.vehicleno).toBe("서울75사2646");
        });

        it("matches stop by lastStnId string key in stopLookup", () => {
            const stopLookup = new Map<number | string, { nodeid: string; nodenm: string; routenm?: string }>([
                ["111000115", {nodeid: "111000115", nodenm: "구산역", routenm: "753"}],
            ]);

            const normalized = normalizeSeoulBusPosItem(
                {
                    vehId: "111033668",
                    plainNo: "서울75사2646",
                    sectOrd: "99",
                    gpsX: "126.919635",
                    gpsY: "37.617730",
                    lastStnId: "111000115",
                    isrunyn: "1",
                },
                "100100118",
                stopLookup
            );
            expect(normalized).not.toBeNull();
            expect(normalized?.nodenm).toBe("구산역");
            expect(normalized?.routenm).toBe("753");
        });
    });

    describe("route & vehicle type mappers and bounds", () => {
        it("maps Seoul route type codes to Korean labels", () => {
            expect(mapSeoulRouteType("1")).toBe("공항");
            expect(mapSeoulRouteType("2")).toBe("마을");
            expect(mapSeoulRouteType("3")).toBe("간선");
            expect(mapSeoulRouteType("4")).toBe("지선");
            expect(mapSeoulRouteType("5")).toBe("순환");
            expect(mapSeoulRouteType("6")).toBe("광역");
            expect(mapSeoulRouteType("15")).toBe("심야");
        });

        it("maps Seoul busType codes to Korean vehicle types", () => {
            expect(mapSeoulVehicleType("0")).toBe("일반버스");
            expect(mapSeoulVehicleType("1")).toBe("저상버스");
            expect(mapSeoulVehicleType("2")).toBe("굴절버스");
        });

        it("checks Seoul geographic bounding box", () => {
            expect(isWithinSeoulBounds(37.5665, 126.978)).toBe(true); // Seoul City Hall
            expect(isWithinSeoulBounds(37.3421, 127.9198)).toBe(false); // Wonju
        });
    });

    describe("Seoul & Owl bus operating windows", () => {
        it("keeps Owl (N-bus) and autonomous dawn buses active at 02:30 AM KST", () => {
            // 02:30 KST = 17:30 UTC previous day
            const nightDate = new Date(Date.UTC(2026, 9, 18, 17, 30, 0));
            const owlStatus = isRouteInServiceWindow("N13", nightDate, "11");
            const dawnStatus = isRouteInServiceWindow("새벽A160", nightDate, "11");

            expect(owlStatus.inService).toBe(true);
            expect(dawnStatus.inService).toBe(true);
        });

        it("uses extended operating window (03:40 ~ 01:30) for Seoul (11) routes", () => {
            const seoulWindow = getRouteOperatingWindow("100100118", "11");
            expect(seoulWindow.firstBus).toBe("04:00");
            // 00:45 KST = 15:45 UTC previous day (still in service in Seoul)
            const afterMidnight = new Date(Date.UTC(2026, 9, 18, 15, 45, 0));
            expect(isRouteInServiceWindow("100100118", afterMidnight, "11").inService).toBe(true);
        });

        it("parses Seoul city routes from TOPIS selectVApiTotalstr payload", async () => {
            const { fetchSeoulCityRoutes } = await import("./seoulApi");
            const originalFetch = global.fetch;
            global.fetch = async () =>
                new Response(
                    JSON.stringify({
                        ResponseVO: {
                            code: 0,
                            data: {
                                resultList: [
                                    {
                                        strdiv: "1",
                                        strid: "100100022",
                                        strnm: "143",
                                        strtp: "3",
                                        strkey: "정릉 - 개포동",
                                    },
                                    {
                                        strdiv: "1",
                                        strid: "101000009",
                                        strnm: "새벽A148(자율주행)",
                                        strtp: "3",
                                        strkey: "상계역 - 고속터미널",
                                    },
                                    {
                                        strdiv: "2", // Not a bus route
                                        strid: "9999",
                                        strnm: "테스트정류장",
                                    },
                                ],
                            },
                        },
                    }),
                    { status: 200, headers: { "Content-Type": "application/json" } }
                );

            try {
                const routes = await fetchSeoulCityRoutes();
                expect(routes).toHaveLength(2);
                expect(routes[0].routeid).toBe("100100022");
                expect(routes[0].routeno).toBe("143");
                expect(routes[0].routetp).toBe("간선");
                expect(routes[1].routeno).toBe("새벽A148");
            } finally {
                global.fetch = originalFetch;
            }
        });
    });
});
