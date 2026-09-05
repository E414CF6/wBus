import {describe, expect, it} from "vitest";
import {checkLikeRateLimit, checkPostRateLimit, hashClientIp, validateAndSanitizeContent,} from "./security";

describe("security utils", () => {
    describe("hashClientIp", () => {
        it("consistently produces deterministic, non-empty sha256 hashes", () => {
            const hash1 = hashClientIp("1.2.3.4");
            const hash2 = hashClientIp("1.2.3.4");
            const hash3 = hashClientIp("5.6.7.8");

            expect(hash1).toBe(hash2);
            expect(hash1).not.toBe(hash3);
            expect(hash1).toMatch(/^[a-f0-9]{64}$/);
        });
    });

    describe("validateAndSanitizeContent", () => {
        it("strips harmful script and HTML tags", () => {
            const raw = "<script>alert('xss')</script>안녕하세요! <b onclick='hack()'>버스</b> 정보 공유해요.";
            const res = validateAndSanitizeContent(raw);

            expect(res.isValid).toBe(true);
            expect(res.sanitizedContent).not.toContain("<script>");
            expect(res.sanitizedContent).not.toContain("</script>");
            expect(res.sanitizedContent).not.toContain("<b>");
            expect(res.sanitizedContent).toContain("안녕하세요! 버스 정보 공유해요.");
        });

        it("rejects excessively short content", () => {
            const res = validateAndSanitizeContent("a");
            expect(res.isValid).toBe(false);
            expect(res.error).toBe("내용을 최소 2자 이상 입력해주세요.");
        });

        it("detects and blocks banned spam/gambling keywords", () => {
            const res = validateAndSanitizeContent("꽁머니 지급 토토사이트 바로가기");
            expect(res.isValid).toBe(false);
            expect(res.error).toContain("스팸, 광고 또는 부적절한 링크");
        });

        it("detects and blocks severe profanity", () => {
            const res = validateAndSanitizeContent("이런 시발 버스가 안와요");
            expect(res.isValid).toBe(false);
            expect(res.error).toContain("비속어 및 타인에게 불쾌감");
        });
    });

    describe("checkPostRateLimit", () => {
        it("allows valid posts with cooldown interval", () => {
            const ipHash = "test-user-ip-hash-1";
            const first = checkPostRateLimit(ipHash, "첫 번째 정상 글입니다.");
            expect(first.allowed).toBe(true);

            // Immediate second post must be blocked by cooldown (3 seconds)
            const second = checkPostRateLimit(ipHash, "두 번째 즉시 글입니다.");
            expect(second.allowed).toBe(false);
            expect(second.retryAfterSec).toBeGreaterThan(0);
        });

        it("blocks duplicate content from same user within cooldown", async () => {
            const ipHash = "test-user-ip-hash-duplicate";
            checkPostRateLimit(ipHash, "중복 방지 테스트 문장입니다.");

            // Even if cooldown passed, same content is blocked
            const duplicateCheck = checkPostRateLimit(ipHash, "중복 방지 테스트 문장입니다.");
            expect(duplicateCheck.allowed).toBe(false);
        });
    });

    describe("checkLikeRateLimit", () => {
        it("permits likes within normal rate limit threshold", () => {
            const ipHash = "test-like-ip-hash";
            const res = checkLikeRateLimit(ipHash);
            expect(res.allowed).toBe(true);
        });
    });
});
