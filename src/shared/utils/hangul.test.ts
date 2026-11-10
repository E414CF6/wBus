import {describe, expect, it} from "vitest";
import {extractChoseong, getChoseongChar, isChoseongChar, isPureChoseongQuery, matchesHangul,} from "./hangul";

describe("hangul utility", () => {
    describe("isChoseongChar", () => {
        it("identifies valid choseong characters", () => {
            expect(isChoseongChar("ㄱ")).toBe(true);
            expect(isChoseongChar("ㅇ")).toBe(true);
            expect(isChoseongChar("ㅎ")).toBe(true);
            expect(isChoseongChar("ㅃ")).toBe(true);
        });

        it("rejects non-choseong characters", () => {
            expect(isChoseongChar("가")).toBe(false);
            expect(isChoseongChar("a")).toBe(false);
            expect(isChoseongChar("1")).toBe(false);
            expect(isChoseongChar("ㅏ")).toBe(false); // vowel
        });
    });

    describe("isPureChoseongQuery", () => {
        it("returns true for queries consisting solely of consonants and numbers", () => {
            expect(isPureChoseongQuery("ㅇㅈ")).toBe(true);
            expect(isPureChoseongQuery("30 ㅂ")).toBe(true);
            expect(isPureChoseongQuery("ㄱㅎ")).toBe(true);
        });

        it("returns false when containing syllables or English letters", () => {
            expect(isPureChoseongQuery("원주")).toBe(false);
            expect(isPureChoseongQuery("bus")).toBe(false);
            expect(isPureChoseongQuery("")).toBe(false);
        });
    });

    describe("getChoseongChar", () => {
        it("extracts choseong for complete hangul syllables", () => {
            expect(getChoseongChar("원")).toBe("ㅇ");
            expect(getChoseongChar("주")).toBe("ㅈ");
            expect(getChoseongChar("시")).toBe("ㅅ");
            expect(getChoseongChar("급")).toBe("ㄱ");
            expect(getChoseongChar("행")).toBe("ㅎ");
        });

        it("preserves non-hangul or standalone consonants", () => {
            expect(getChoseongChar("A")).toBe("a");
            expect(getChoseongChar("3")).toBe("3");
            expect(getChoseongChar("ㄱ")).toBe("ㄱ");
        });
    });

    describe("extractChoseong", () => {
        it("extracts full consonant string", () => {
            expect(extractChoseong("원주시")).toBe("ㅇㅈㅅ");
            expect(extractChoseong("30번 버스")).toBe("30ㅂ ㅂㅅ");
            expect(extractChoseong("Seoul TOPIS")).toBe("seoul topis");
        });
    });

    describe("matchesHangul", () => {
        it("performs exact and substring matching", () => {
            expect(matchesHangul("원주시", "원주")).toBe(true);
            expect(matchesHangul("원주시", "주시")).toBe(true);
            expect(matchesHangul("원주시", "춘천")).toBe(false);
        });

        it("matches by Choseong (initial consonants)", () => {
            expect(matchesHangul("원주시", "ㅇㅈ")).toBe(true);
            expect(matchesHangul("원주시", "ㅇㅈㅅ")).toBe(true);
            expect(matchesHangul("급행버스", "ㄱㅎ")).toBe(true);
            expect(matchesHangul("상지대학교", "ㅅㅈㄷ")).toBe(true);
            expect(matchesHangul("서울특별시", "ㅅㅇ")).toBe(true);
            expect(matchesHangul("수원시", "ㅅㅇ")).toBe(true);
            expect(matchesHangul("부산광역시", "ㅂㅅ")).toBe(true);
        });

        it("handles spaces gracefully", () => {
            expect(matchesHangul("원주 시", "원주시")).toBe(true);
            expect(matchesHangul("원주시", "ㅇ ㅈ")).toBe(true);
        });

        it("handles case insensitivity for English", () => {
            expect(matchesHangul("Seoul", "se")).toBe(true);
            expect(matchesHangul("Busan", "BUS")).toBe(true);
        });

        it("returns true for empty query and false for empty target", () => {
            expect(matchesHangul("원주", "")).toBe(true);
            expect(matchesHangul("", "원주")).toBe(false);
        });
    });
});
