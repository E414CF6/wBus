import {APP_CONFIG} from "@shared/config/env";

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

export async function fetchAPI<T = unknown>(url: string, options: FetchApiOptions = {}): Promise<T> {
    const {retries = 3, retryDelay = 1000, ...init} = options;

    for (let i = 0; i < retries; i++) {
        try {
            const isExternal = url.startsWith("http");
            const response = await fetch(url, {
                ...init, method: init.method ?? "GET", headers: {
                    ...(isExternal ? {} : {Client: APP_CONFIG.NAME}), ...(init.headers ?? {}),
                },
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => "");
                throw new HttpError(`[fetchAPI] Fetch failed for ${url} with status ${response.status}: ${errorText}`, response.status);
            }

            return (await response.json()) as T;
        } catch (error) {
            const isLast = i === retries - 1;

            if (isLast) {
                if (error instanceof HttpError) {
                    throw error;
                }
                const message = error instanceof Error ? error.message : String(error);
                throw new Error(`[fetchAPI] Fetch failed for ${url}: ${message}`);
            }

            await delay(retryDelay);
        }
    }

    throw new Error("[fetchAPI] Unhandled exception occurred.");
}
