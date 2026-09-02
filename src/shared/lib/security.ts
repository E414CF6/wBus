import crypto from "crypto";
import type {NextRequest} from "next/server";

// Secret salt for privacy-preserving salted IP hashing
const IP_SALT =
    process.env.IP_SALT ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 24) ||
    "wbus_secure_community_salt_2026";

/**
 * Extract client IP address accurately from standard reverse-proxy headers
 */
export function getClientIp(req: NextRequest): string {
    const cfConnectingIp = req.headers.get("cf-connecting-ip");
    if (cfConnectingIp) return cfConnectingIp.trim();

    const vercelForwardedFor = req.headers.get("x-vercel-forwarded-for");
    if (vercelForwardedFor) return vercelForwardedFor.split(",")[0].trim();

    const forwardedFor = req.headers.get("x-forwarded-for");
    if (forwardedFor) return forwardedFor.split(",")[0].trim();

    const realIp = req.headers.get("x-real-ip");
    if (realIp) return realIp.trim();

    return "127.0.0.1";
}

/**
 * Generate a deterministic, salted SHA-256 hash from client IP
 * This ensures zero raw PII storage while still allowing abuse tracking and rate limiting.
 */
export function hashClientIp(ip: string): string {
    return crypto
        .createHash("sha256")
        .update(`${ip}:${IP_SALT}`)
        .digest("hex");
}

// ---------------------------------------------------------------------------
// In-Memory Sliding Window Rate Limiting (Serverless-compatible memory cache)
// ---------------------------------------------------------------------------

interface RateLimitRecord {
    lastPostTime: number;
    postTimestamps: number[];
    lastContentHash: string;
    lastContentTime: number;
}

interface LikeLimitRecord {
    likeTimestamps: number[];
}

const postRateLimitMap = new Map<string, RateLimitRecord>();
const likeRateLimitMap = new Map<string, LikeLimitRecord>();

// Clean up memory cache periodically (every 10 minutes)
if (typeof setInterval !== "undefined") {
    setInterval(() => {
        const now = Date.now();
        for (const [key, record] of postRateLimitMap.entries()) {
            if (now - record.lastPostTime > 15 * 60 * 1000) {
                postRateLimitMap.delete(key);
            }
        }
        for (const [key, record] of likeRateLimitMap.entries()) {
            const recent = record.likeTimestamps.filter((t) => now - t < 60 * 1000);
            if (recent.length === 0) {
                likeRateLimitMap.delete(key);
            }
        }
    }, 10 * 60 * 1000);
}

const POST_COOLDOWN_MS = 3000; // 3 seconds between posts
const POST_WINDOW_MS = 3 * 60 * 1000; // 3 minutes window
const MAX_POSTS_PER_WINDOW = 8; // Max 8 posts per 3 minutes
const DUPLICATE_COOLDOWN_MS = 45 * 1000; // 45 seconds duplicate block
const MAX_LIKES_PER_MINUTE = 30; // Max 30 likes per minute

export interface RateLimitResult {
    allowed: boolean;
    reason?: string;
    retryAfterSec?: number;
}

/**
 * Check if the user is exceeding post rate limits or spamming duplicates
 */
export function checkPostRateLimit(ipHash: string, content: string): RateLimitResult {
    const now = Date.now();
    const contentHash = crypto
        .createHash("md5")
        .update(content.trim().toLowerCase())
        .digest("hex");
    let record = postRateLimitMap.get(ipHash);

    if (!record) {
        record = {
            lastPostTime: 0,
            postTimestamps: [],
            lastContentHash: "",
            lastContentTime: 0,
        };
        postRateLimitMap.set(ipHash, record);
    }

    // 1. Cooldown check (minimum 3 seconds between any posts)
    const timeSinceLast = now - record.lastPostTime;
    if (timeSinceLast < POST_COOLDOWN_MS) {
        const waitSec = Math.ceil((POST_COOLDOWN_MS - timeSinceLast) / 1000);
        return {
            allowed: false,
            reason: `너무 빠르게 글을 작성하고 있습니다. ${waitSec}초 후 다시 시도해주세요.`,
            retryAfterSec: waitSec,
        };
    }

    // 2. Duplicate content check within 45 seconds
    if (
        record.lastContentHash === contentHash &&
        now - record.lastContentTime < DUPLICATE_COOLDOWN_MS
    ) {
        return {
            allowed: false,
            reason: "동일한 내용의 글을 연속해서 등록할 수 없습니다.",
            retryAfterSec: Math.ceil(
                (DUPLICATE_COOLDOWN_MS - (now - record.lastContentTime)) / 1000
            ),
        };
    }

    // 3. Sliding window frequency check (max 8 posts per 3 min)
    record.postTimestamps = record.postTimestamps.filter((t) => now - t < POST_WINDOW_MS);
    if (record.postTimestamps.length >= MAX_POSTS_PER_WINDOW) {
        return {
            allowed: false,
            reason: "단시간에 너무 많은 글을 등록했습니다. 잠시 후 다시 이용해주세요.",
            retryAfterSec: 60,
        };
    }

    // Record success
    record.lastPostTime = now;
    record.postTimestamps.push(now);
    record.lastContentHash = contentHash;
    record.lastContentTime = now;

    return {allowed: true};
}

/**
 * Check if user is abusing the like endpoint
 */
export function checkLikeRateLimit(ipHash: string): RateLimitResult {
    const now = Date.now();
    let record = likeRateLimitMap.get(ipHash);

    if (!record) {
        record = {likeTimestamps: []};
        likeRateLimitMap.set(ipHash, record);
    }

    record.likeTimestamps = record.likeTimestamps.filter((t) => now - t < 60 * 1000);
    if (record.likeTimestamps.length >= MAX_LIKES_PER_MINUTE) {
        return {
            allowed: false,
            reason: "좋아요 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
            retryAfterSec: 10,
        };
    }

    record.likeTimestamps.push(now);
    return {allowed: true};
}

// ---------------------------------------------------------------------------
// Profanity & Spam Filter
// ---------------------------------------------------------------------------

// Banned malicious / spam / phishing patterns
const SPAM_PATTERNS: RegExp[] = [
    // Illegal gambling / toto
    /(카지노|바카라|토토사이트|스포츠토토|꽁머니|먹튀검증|롤링|슬롯머신|사설토토|파워볼사이트)/i,
    // Adult spam & illicit services
    /(출장안마|출장마사지|조건만남|섹파|오피스텔걸|성인용품|유흥알바)/i,
    // Phishing / Telegram spam links
    /(t\.me\/[a-zA-Z0-9_]+|telegram\.me\/[a-zA-Z0-9_]+)/i,
    // Suspicious shortened URL spams commonly used in phishing
    /(bit\.ly|tinyurl\.com|is\.gd|cutt\.ly|url\.kr)\/[a-zA-Z0-9_-]+/i,
];

// Slurs & excessive profanity patterns (Regex)
const PROFANITY_PATTERNS: RegExp[] = [
    /(시발|씨발|씨바|시바|병신|븅신|개새끼|개색히|새끼|존나|좆|지랄|느검|애미|애비|느개비|호로|창녀|보지|자지|틀딱|한남충|한녀충|맘충)/i,
];

export interface ContentValidationResult {
    isValid: boolean;
    error?: string;
    sanitizedContent: string;
    sanitizedAuthor: string;
}

/**
 * Sanitize and validate post content and author name against abuse, XSS, and spam
 */
export function validateAndSanitizeContent(
    rawContent: string,
    rawAuthor?: string
): ContentValidationResult {
    // 1. Sanitize text
    let content = (rawContent || "").trim();
    let author = (rawAuthor || "").trim();

    // Strip harmful HTML script/tag injections
    content = content
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
        .replace(/<[^>]+>/g, "")
        .replace(/javascript:/gi, "");

    author = author
        .replace(/<[^>]+>/g, "")
        .replace(/javascript:/gi, "")
        .slice(0, 20);

    // Normalize excessive newlines (max 2 consecutive line breaks)
    content = content.replace(/\n{3,}/g, "\n\n");

    // 2. Length validation
    if (content.length < 2) {
        return {
            isValid: false,
            error: "내용을 최소 2자 이상 입력해주세요.",
            sanitizedContent: content,
            sanitizedAuthor: author,
        };
    }

    if (content.length > 1000) {
        return {
            isValid: false,
            error: "내용은 최대 1000자까지 입력 가능합니다.",
            sanitizedContent: content,
            sanitizedAuthor: author,
        };
    }

    // 3. Spam pattern check
    for (const pattern of SPAM_PATTERNS) {
        if (pattern.test(content) || pattern.test(author)) {
            return {
                isValid: false,
                error: "스팸, 광고 또는 부적절한 링크가 감지되어 등록이 차단되었습니다.",
                sanitizedContent: content,
                sanitizedAuthor: author,
            };
        }
    }

    // 4. Profanity check
    for (const pattern of PROFANITY_PATTERNS) {
        if (pattern.test(content) || pattern.test(author)) {
            return {
                isValid: false,
                error: "비속어 및 타인에게 불쾌감을 주는 표현이 포함되어 있습니다. 건전한 커뮤니티 문화를 함께 만들어가요.",
                sanitizedContent: content,
                sanitizedAuthor: author,
            };
        }
    }

    return {
        isValid: true,
        sanitizedContent: content,
        sanitizedAuthor: author,
    };
}
