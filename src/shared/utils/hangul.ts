/**
 * Hangul (Korean) Choseong (initial consonant) decomposition and fuzzy matching utility.
 */

// 19 Korean initial consonants (초성)
export const CHOSEONG_LIST: readonly string[] = ["ㄱ", "ㄲ", "ㄴ", "ㄷ", "ㄸ", "ㄹ", "ㅁ", "ㅂ", "ㅃ", "ㅅ", "ㅆ", "ㅇ", "ㅈ", "ㅉ", "ㅊ", "ㅋ", "ㅌ", "ㅍ", "ㅎ",] as const;

const HANGUL_START_CODE = 0xac00; // '가'
const HANGUL_END_CODE = 0xd7a3;   // '힣'
const CHOSEONG_CYCLE = 21 * 28;   // 588

const CHOSEONG_SET = new Set(CHOSEONG_LIST);

/**
 * Checks whether a character is a Korean initial consonant (자음/초성 단독 문자).
 */
export function isChoseongChar(char: string): boolean {
    return CHOSEONG_SET.has(char);
}

/**
 * Checks whether a query consists only of Choseong characters and whitespace/numbers.
 */
export function isPureChoseongQuery(query: string): boolean {
    const trimmed = query.trim();
    if (!trimmed) return false;
    for (const ch of trimmed) {
        if (!isChoseongChar(ch) && ch !== " " && !/[0-9]/.test(ch)) {
            return false;
        }
    }
    return true;
}

/**
 * Extracts the initial consonant of a character if it is a Hangul syllable.
 * If it's already an initial consonant, returns it.
 * Otherwise returns the character itself (lowercased for ASCII).
 */
export function getChoseongChar(char: string): string {
    const code = char.charCodeAt(0);
    if (code >= HANGUL_START_CODE && code <= HANGUL_END_CODE) {
        const choseongIdx = Math.floor((code - HANGUL_START_CODE) / CHOSEONG_CYCLE);
        return CHOSEONG_LIST[choseongIdx] ?? char;
    }
    return char.toLowerCase();
}

/**
 * Extracts the full Choseong sequence from a target string.
 * Example: "원주시" -> "ㅇㅈㅅ", "30번 버스" -> "30ㅂ ㅂㅅ"
 */
export function extractChoseong(text: string): string {
    let result = "";
    for (let i = 0; i < text.length; i++) {
        result += getChoseongChar(text[i]);
    }
    return result;
}

/**
 * Matches target string against query with Hangul Choseong support.
 *
 * 1. Returns true if target naturally contains query (case-insensitive substring match).
 * 2. If query contains Choseong characters, tests if target's Choseong sequence contains the query.
 *
 * Examples:
 * - matchesHangul("원주시", "원주") -> true
 * - matchesHangul("원주시", "ㅇㅈ") -> true
 * - matchesHangul("급행1번", "ㄱㅎ") -> true
 * - matchesHangul("상지대학교", "ㅅㅈㄷ") -> true
 */
export function matchesHangul(target: string, query: string): boolean {
    if (!target) return false;
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) return true;

    const lowerTarget = target.toLowerCase();

    // 1. Standard substring match
    if (lowerTarget.includes(cleanQuery)) {
        return true;
    }

    // Also check with spaces removed (e.g. "원주 시" vs "원주시")
    const targetNoSpace = lowerTarget.replace(/\s+/g, "");
    const queryNoSpace = cleanQuery.replace(/\s+/g, "");
    if (targetNoSpace.includes(queryNoSpace)) {
        return true;
    }

    // 2. Choseong matching
    const targetChoseong = extractChoseong(lowerTarget);
    if (targetChoseong.includes(cleanQuery)) {
        return true;
    }

    const targetChoseongNoSpace = targetChoseong.replace(/\s+/g, "");
    if (targetChoseongNoSpace.includes(queryNoSpace)) {
        return true;
    }

    return false;
}
