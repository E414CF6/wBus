"use client";

import {useCallback, useEffect, useState} from "react";
import {STORAGE_KEYS} from "@shared/config/env";
import {triggerHaptic} from "@shared/utils/haptics";

export const FAVORITE_CITIES_SYNC_EVENT = "wbus:favorite-cities-updated";

function getSafeStorage(): Storage | null {
    try {
        if (typeof window !== "undefined" && window.localStorage) {
            return window.localStorage;
        }
        if (typeof globalThis !== "undefined" && globalThis.localStorage) {
            return globalThis.localStorage;
        }
    } catch {
        // Ignore environments where storage access throws
    }
    return null;
}

/**
 * Pure helper to read favorite city codes from localStorage.
 */
export function getFavoriteCityCodesFromStorage(): string[] {
    try {
        const storage = getSafeStorage();
        if (!storage) return [];
        const raw = storage.getItem(STORAGE_KEYS.FAVORITE_CITIES);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        }
        return [];
    } catch {
        return [];
    }
}

/**
 * Pure helper to persist favorite city codes to localStorage.
 */
export function saveFavoriteCityCodesToStorage(codes: string[]): void {
    try {
        const storage = getSafeStorage();
        if (!storage) return;
        storage.setItem(STORAGE_KEYS.FAVORITE_CITIES, JSON.stringify(codes));
    } catch {
        // Ignore storage write errors
    }
}

/**
 * Pure helper to toggle a city code within an array of city codes.
 */
export function toggleCityCodeInList(current: string[], code: string): string[] {
    return current.includes(code)
        ? current.filter((c) => c !== code)
        : [...current, code];
}

/**
 * Hook for managing user's bookmarked / favorite cities stored in localStorage.
 */
export function useFavoriteCities() {
    const [favoriteCityCodes, setFavoriteCityCodes] = useState<string[]>([]);

    const loadFavorites = useCallback(() => {
        setFavoriteCityCodes(getFavoriteCityCodesFromStorage());
    }, []);

    useEffect(() => {
        const frameId = requestAnimationFrame(() => {
            loadFavorites();
        });
        const handleSync = () => loadFavorites();
        window.addEventListener(FAVORITE_CITIES_SYNC_EVENT, handleSync);
        window.addEventListener("storage", handleSync);
        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener(FAVORITE_CITIES_SYNC_EVENT, handleSync);
            window.removeEventListener("storage", handleSync);
        };
    }, [loadFavorites]);

    const isFavoriteCity = useCallback(
        (code: string) => favoriteCityCodes.includes(code),
        [favoriteCityCodes]
    );

    const toggleFavoriteCity = useCallback(
        (code: string) => {
            if (typeof window === "undefined") return;
            const current = getFavoriteCityCodesFromStorage();
            const next = toggleCityCodeInList(current, code);

            setFavoriteCityCodes(next);
            saveFavoriteCityCodesToStorage(next);
            triggerHaptic(current.includes(code) ? "light" : "medium");
            try {
                window.dispatchEvent(new CustomEvent(FAVORITE_CITIES_SYNC_EVENT));
            } catch {
                // Ignore event dispatch failure
            }
        },
        []
    );

    return {
        favoriteCityCodes,
        isFavoriteCity,
        toggleFavoriteCity,
    };
}
