/**
 * Parse environment variable as string with fallback
 * @param key
 * @param fallback
 * @returns Parsed value
 */

export function getEnv(key: string | undefined, fallback: string): string {
    return key ?? fallback;
}

export function getEnvNumber(key: string | undefined, fallback: number): number {
    const parsed = Number(key);
    return Number.isNaN(parsed) ? fallback : parsed;
}

export function getEnvArray<T = string>(key: string | undefined, separator = ",", fallback: T[] = []): T[] {
    if (!key) return fallback;
    return key.split(separator).map((item) => item.trim()) as unknown as T[];
}

export function getEnvBounds(key: string | undefined, fallbackRaw: string): [[number, number], [number, number]] {
    const raw = key || fallbackRaw;
    const [swLat, swLng, neLat, neLng] = raw.split(",").map(Number);
    return [[swLng, swLat], [neLng, neLat],];
}