import {describe, expect, it} from "vitest";
import {parseNoticeDetailHtml, parseNoticeListHtml} from "./noticeScraper";

describe("noticeScraper DOM parser", () => {
    it("parses notice table rows, pinned notices, and pagination from HTML", () => {
        const html = `
        <html><body>
            <table><tbody>
                <tr>
                    <td><span class="notice">공지</span></td>
                    <td><a href="/center/noticeView.do?bdIdx=1001">연세대학교 방학 시간표 안내</a></td>
                    <td class="file">첨부</td>
                    <td>2026-11-01</td>
                    <td>421</td>
                </tr>
                <tr>
                    <td>214</td>
                    <td><a href="#" onclick="detailView('998')">30번 노선 우회 운행 알림</a></td>
                    <td></td>
                    <td>2026-11-10</td>
                    <td>87</td>
                </tr>
            </tbody></table>
            <div class="paginate">
                <strong>1</strong>
                <a href="#" onclick="goSearch(2)">2</a>
                <a href="#" onclick="goSearch(5)">5</a>
            </div>
        </body></html>`;

        const res = parseNoticeListHtml(html, 1, "");
        expect(res.notices).toHaveLength(2);
        expect(res.notices[0]).toMatchObject({
            id: "1001",
            isNotice: true,
            title: "연세대학교 방학 시간표 안내",
            hasFile: true,
        });
        expect(res.notices[1]).toMatchObject({
            id: "998",
            num: "214",
            isNotice: false,
            title: "30번 노선 우회 운행 알림",
        });
        expect(res.totalPages).toBe(5);
        expect(res.totalCount).toBe(214);
    });

    it("preserves full nested div structure inside .cont_area without lazy-regex truncation and sanitizes scripts", () => {
        const html = `
        <div class="view_wrap">
            <p class="title">시내버스 개편 안내</p>
            <span class="date">2026-11-12</span>
            <span class="writer">원주시청</span>
            <span class="hit">155</span>
            <div class="cont_area">
                <div class="inner_box"><p>첫 번째 문단</p></div>
                <div class="second_box"><p>중요 안내 본문</p><img src="/upload/route.png" /><script>alert(1)</script></div>
            </div>
            <a href="/center/noticeAttach.do?file=1">시간표.pdf</a>
            <dl class="prev"><a href="/center/noticeView.do?bdIdx=99">이전 공지</a></dl>
            <dl class="next"><a href="/center/noticeView.do?bdIdx=101">다음 공지</a></dl>
        </div>`;

        const detail = parseNoticeDetailHtml(html, "100");
        expect(detail.title).toBe("시내버스 개편 안내");
        expect(detail.date).toBe("2026-11-12");
        expect(detail.content).toContain("첫 번째 문단");
        expect(detail.content).toContain("중요 안내 본문");
        expect(detail.content).toContain("http://its.wonju.go.kr/upload/route.png");
        expect(detail.content).not.toContain("<script>");
        expect(detail.files).toEqual([
            {name: "시간표.pdf", url: "http://its.wonju.go.kr/center/noticeAttach.do?file=1"},
        ]);
        expect(detail.prevId).toBe("99");
        expect(detail.nextId).toBe("101");
    });
});
