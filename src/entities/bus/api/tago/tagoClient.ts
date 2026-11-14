import {computeBackoffDelayMs, SharedCircuitBreaker} from "@shared/api/upstreamClient";
import {API_PRIORITY, TaskQueue} from "@shared/utils/concurrency";
import {keyManager} from "./serviceKeyManager";
import {CITY_CODE, PublicApiError, type PublicApiResponseEnvelope} from "./tagoTypes";

const PUBLIC_API_BASE = "https://apis.data.go.kr/1613000";
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 300;
const CIRCUIT_COOLDOWN_MS = 15 * 1000;
const DEFAULT_PARAMS = {
    numOfRows: "1024",
    pageNo: "1",
    _type: "json",
    cityCode: CITY_CODE,
};

export const circuitBreaker = new SharedCircuitBreaker("PublicAPI", 5, CIRCUIT_COOLDOWN_MS);

export const publicApiQueue = new TaskQueue({
    concurrency: 3,
    staggerMs: 30,
    maxRps: 8,
});

export const pendingInflightRequests = new Map<string, Promise<unknown>>();

function buildUrl(path: string, params: Record<string, string>, serviceKey: string): string {
    const url = new URL(`${PUBLIC_API_BASE}${path}`);
    url.searchParams.set("serviceKey", serviceKey);
    for (const [k, v] of Object.entries({...DEFAULT_PARAMS, ...params})) {
        url.searchParams.set(k, v);
    }
    return url.toString();
}

function isQuotaOrKeyCodeOrMsg(code: string, msg: string): boolean {
    const upperMsg = msg.toUpperCase();
    return (
        code === "22" ||
        code === "30" ||
        code === "31" ||
        code === "20" ||
        code === "429" ||
        upperMsg.includes("LIMITED") ||
        upperMsg.includes("TRAFFIC") ||
        upperMsg.includes("EXCEED") ||
        upperMsg.includes("KEY") ||
        upperMsg.includes("REGISTERED")
    );
}

function parseXmlErrors(xmlText: string): {
    isError: boolean;
    isQuotaOrKeyError: boolean;
    message: string;
    code: string;
} {
    if (!xmlText || !xmlText.includes("<")) {
        return {isError: false, isQuotaOrKeyError: false, message: "", code: ""};
    }
    const codeMatch = xmlText.match(/<(?:returnReasonCode|resultCode)>([^<]+)<\/(?:returnReasonCode|resultCode)>/i);
    const msgMatch = xmlText.match(/<(?:errMsg|resultMsg)>([^<]+)<\/(?:errMsg|resultMsg)>/i);
    const code = codeMatch ? codeMatch[1].trim() : "";
    const msg = msgMatch ? msgMatch[1].trim() : "OpenAPI XML Error";

    if (code || msgMatch) {
        return {
            isError: true,
            isQuotaOrKeyError: isQuotaOrKeyCodeOrMsg(code, msg),
            message: msg,
            code: code || "XML_ERROR",
        };
    }
    return {isError: false, isQuotaOrKeyError: false, message: "", code: ""};
}

function inspectResponseForErrors(data: unknown): {
    isError: boolean;
    isQuotaOrKeyError: boolean;
    message: string;
    code: string;
} {
    if (!data || typeof data !== "object") {
        return {isError: false, isQuotaOrKeyError: false, message: "", code: ""};
    }

    const obj = data as Record<string, unknown>;
    const xmlError = (obj.OpenAPI_ServiceResponse as Record<string, unknown> | undefined)?.cmmMsgHeader as Record<string, unknown> | undefined;
    if (xmlError) {
        const code = String(xmlError.returnReasonCode ?? "").trim();
        const msg = String(xmlError.errMsg ?? "OpenAPI Error").trim();
        return {isError: true, isQuotaOrKeyError: isQuotaOrKeyCodeOrMsg(code, msg), message: msg, code};
    }

    const header = (obj.response as Record<string, unknown> | undefined)?.header as Record<string, unknown> | undefined;
    if (header && header.resultCode !== undefined) {
        const code = String(header.resultCode).trim();
        const msg = String(header.resultMsg ?? "API Error").trim();
        if (code !== "00" && code !== "0" && code !== "0000") {
            return {isError: true, isQuotaOrKeyError: isQuotaOrKeyCodeOrMsg(code, msg), message: msg, code};
        }
    }

    return {isError: false, isQuotaOrKeyError: false, message: "", code: ""};
}

function isRetryableStatus(status: number): boolean {
    return status === 429 || status >= 500;
}

function delay(attempt: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, computeBackoffDelayMs(attempt, RETRY_BASE_DELAY_MS, 100));
    });
}

async function rawFetchPublicApi<T>(path: string, params: Record<string, string>): Promise<T> {
    if (!circuitBreaker.canRequest()) {
        throw new PublicApiError("[PublicAPI] Circuit Breaker is OPEN due to upstream failure.", 503, path);
    }

    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt++) {
        const {key: serviceKey, index: keyIndex} = keyManager.getKey();
        const url = buildUrl(path, params, serviceKey);
        const safeUrl = url.replace(/serviceKey=[^&]+/, "serviceKey=***");

        try {
            const res = await fetch(url, {
                headers: {
                    Client: "wBus",
                    Connection: "keep-alive",
                },
                signal: AbortSignal.timeout(4000),
                cache: "no-store",
            });

            if (res.ok) {
                const text = await res.text();
                let data: T;

                try {
                    data = JSON.parse(text) as T;
                } catch {
                    const xmlErr = parseXmlErrors(text);
                    if (xmlErr.isError) {
                        if (xmlErr.isQuotaOrKeyError) {
                            keyManager.markCooldown(keyIndex);
                        }
                        console.warn(
                            `[PublicAPI] Key #${keyIndex + 1} returned XML upstream error: ${xmlErr.message} (Code: ${xmlErr.code}, Quota/Key: ${xmlErr.isQuotaOrKeyError}). Attempt ${attempt}/${MAX_RETRY_ATTEMPTS}`
                        );
                        if (attempt < MAX_RETRY_ATTEMPTS) {
                            await delay(attempt);
                            continue;
                        }
                        throw new PublicApiError(
                            `[PublicAPI] ${xmlErr.message} (Code: ${xmlErr.code})`,
                            xmlErr.isQuotaOrKeyError ? 429 : 502,
                            safeUrl
                        );
                    }
                    throw new Error(`Invalid JSON response from upstream: ${text.slice(0, 120)}`);
                }

                const errCheck = inspectResponseForErrors(data);
                if (errCheck.isError) {
                    if (errCheck.isQuotaOrKeyError) {
                        keyManager.markCooldown(keyIndex);
                    }
                    console.warn(
                        `[PublicAPI] Key #${keyIndex + 1} returned upstream API error: ${errCheck.message} (Code: ${errCheck.code}, Quota/Key Error: ${errCheck.isQuotaOrKeyError}). Attempt ${attempt}/${MAX_RETRY_ATTEMPTS}`
                    );
                    if (attempt < MAX_RETRY_ATTEMPTS) {
                        await delay(attempt);
                        continue;
                    }
                    throw new PublicApiError(
                        `[PublicAPI] ${errCheck.message} (Code: ${errCheck.code})`,
                        errCheck.isQuotaOrKeyError ? 429 : 502,
                        safeUrl
                    );
                }

                circuitBreaker.recordSuccess();
                return data;
            }

            if (res.status === 429) {
                keyManager.markCooldown(keyIndex);
            }

            if (!isRetryableStatus(res.status) || attempt === MAX_RETRY_ATTEMPTS) {
                throw new PublicApiError(`[PublicAPI] ${res.status} ${res.statusText}`, res.status, safeUrl);
            }
        } catch (err) {
            lastError = err;
            if (err instanceof PublicApiError && err.status === 429) {
                keyManager.markCooldown(keyIndex);
            }

            if (attempt === MAX_RETRY_ATTEMPTS) {
                circuitBreaker.recordFailure();
                if (err instanceof PublicApiError) throw err;
                const message = err instanceof Error ? err.message : String(err);
                throw new PublicApiError(`[PublicAPI] Network/Timeout error: ${message}`, 502, safeUrl);
            }
        }

        await delay(attempt);
    }

    circuitBreaker.recordFailure();
    throw lastError instanceof Error ? lastError : new PublicApiError("[PublicAPI] Retry failed", 500, path);
}

export async function fetchPublicApi<T>(
    path: string,
    params: Record<string, string>,
    options?: { priority?: number }
): Promise<T> {
    const dedupeKey = `${path}:${JSON.stringify(params)}`;
    if (pendingInflightRequests.has(dedupeKey)) {
        return pendingInflightRequests.get(dedupeKey) as Promise<T>;
    }

    const priority = options?.priority ?? API_PRIORITY.USER_INTERACTIVE;
    const promise = publicApiQueue.enqueue(() => rawFetchPublicApi<T>(path, params), {priority}).finally(() => {
        pendingInflightRequests.delete(dedupeKey);
    });

    pendingInflightRequests.set(dedupeKey, promise);
    return promise;
}

export function extractItems<T>(data: PublicApiResponseEnvelope<T>, urlHint = "apis.data.go.kr"): T[] {
    if (!data) return [];

    const errCheck = inspectResponseForErrors(data);
    if (errCheck.isError) {
        throw new PublicApiError(
            `[PublicAPI] ${errCheck.message} (Code: ${errCheck.code})`,
            errCheck.isQuotaOrKeyError ? 429 : 502,
            urlHint
        );
    }

    const raw = data.response?.body?.items?.item;
    if (!raw) return [];
    return Array.isArray(raw) ? raw : [raw];
}

export async function fetchAllPublicApiPages<T>(
    path: string,
    params: Record<string, string>,
    priority: number,
    urlHint: string,
    maxPages = 4
): Promise<T[]> {
    const firstPage = await fetchPublicApi<PublicApiResponseEnvelope<T>>(path, {...params, pageNo: "1"}, {priority});
    const collected = extractItems(firstPage, urlHint);
    const totalCount = Number(firstPage.response?.body?.totalCount ?? collected.length);
    const pageSize = Number(params.numOfRows ?? firstPage.response?.body?.numOfRows ?? 1024);

    if (!Number.isFinite(totalCount) || totalCount <= collected.length || pageSize <= 0) {
        return collected;
    }

    const totalPages = Math.min(maxPages, Math.ceil(totalCount / pageSize));
    if (totalPages <= 1) return collected;

    for (let page = 2; page <= totalPages; page++) {
        const nextPage = await fetchPublicApi<PublicApiResponseEnvelope<T>>(
            path,
            {...params, pageNo: String(page)},
            {priority}
        );
        const pageItems = extractItems(nextPage, `${urlHint}:p${page}`);
        if (pageItems.length === 0) break;
        collected.push(...pageItems);
    }

    return collected;
}
