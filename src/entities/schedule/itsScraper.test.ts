import {describe, expect, it} from "vitest";
import {parseItsDetailHtml, parseItsListHtml} from "./itsScraper";

describe("itsScraper DOM parser", () => {
    it("extracts CSRF token, station normalization, and filters Yonsei routes cleanly", () => {
        const html = `
        <form>
            <input type="hidden" name="CSRFToken" value="csrf-abc-123" />
            <table>
                <tr>
                    <td><a href="#" onclick="goDetail('R30')">30</a></td>
                    <td>장양리시내버스공영정류장</td>
                    <td>연세대(매지리)</td>
                    <td>06:00</td>
                    <td>22:10</td>
                    <td>40</td>
                    <td>20분</td>
                </tr>
                <tr>
                    <td><a href="#" onclick="goDetail('R100')">100(평일)</a></td>
                    <td>관설동</td>
                    <td>만종역</td>
                    <td>06:30</td>
                    <td>22:00</td>
                    <td>15</td>
                    <td>50분</td>
                </tr>
            </table>
        </form>`;

        const all = parseItsListHtml(html, false);
        expect(all.csrfToken).toBe("csrf-abc-123");
        expect(all.routes).toHaveLength(2);
        expect(all.routes[0].origin).toBe("장양리");
        expect(all.routes[1]).toMatchObject({id: "R100", routeNo: "100", dayType: "평일"});

        const yonseiOnly = parseItsListHtml(html, true);
        expect(yonseiOnly.routes).toHaveLength(1);
        expect(yonseiOnly.routes[0].id).toBe("R30");
    });

    it("parses detail timetable rows and ignores header rows", () => {
        const html = `
        <table>
            <tr><th>순번</th><th>기점</th><th>종점</th><th>유형</th><th>비고</th></tr>
            <tr><td>1</td><td>06:00</td><td>06:45</td><td>저상</td><td>첫차</td></tr>
            <tr><td>2</td><td>06:30</td><td>07:15</td><td>일반</td><td></td></tr>
        </table>`;

        const entries = parseItsDetailHtml(html);
        expect(entries).toEqual([
            {seq: 1, originDepTime: "06:00", destDepTime: "06:45", type: "저상", notes: "첫차"},
            {seq: 2, originDepTime: "06:30", destDepTime: "07:15", type: "일반", notes: ""},
        ]);
    });
});
