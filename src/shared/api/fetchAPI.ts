import {APP_CONFIG, SITE_CONFIG} from "@shared/config/env";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class HttpError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "HttpError";
        this.status = status;
    }
}

export interface FetchApiOptions extends RequestInit {
    retries?: number;
    retryDelay?: number;
}

function isRetryableStatus(status: number): boolean {
    return status === 429 || status >= 500;
}

export async function fetchAPI<T = unknown>(url: string, options: FetchApiOptions = {}): Promise<T> {
    const {retries = 3, retryDelay = 1000, ...init} = options;

    let targetUrl = url;
    if (!targetUrl.startsWith("http") && typeof window === "undefined") {
        const port = process.env.PORT || "3000";
        const base =
            process.env.NEXT_PUBLIC_SITE_BASE_URL ||
            SITE_CONFIG.METADATA.BASE_URL ||
            `http://localhost:${port}`;
        try {
            targetUrl = new URL(targetUrl.startsWith("/") ? targetUrl : `/${targetUrl}`, base).toString();
        } catch {
            targetUrl = `http://localhost:${port}${targetUrl.startsWith("/") ? targetUrl : `/${targetUrl}`}`;
        }
    }

    for (let i = 0; i < retries; i++) {
        try {
            const isExternal = targetUrl.startsWith("http");
            const response = await fetch(targetUrl, {
                ...init,
                method: init.method ?? "GET",
                headers: {
                    ...(isExternal ? {} : {Client: APP_CONFIG.NAME}),
                    ...(init.headers ?? {}),
                },
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => "");
                throw new HttpError(
                    `[fetchAPI] Fetch failed for ${targetUrl} with status ${response.status}: ${errorText}`,
                    response.status
                );
            }

            return (await response.json()) as T;
        } catch (error) {
            const isNonRetryableHttpError = error instanceof HttpError && !isRetryableStatus(error.status);
            const isLast = i === retries - 1;

            if (isLast || isNonRetryableHttpError) {
                throw error;
            }

            await delay(retryDelay);
        }
    }

    throw new Error("[fetchAPI] Unhandled exception occurred.");
}
