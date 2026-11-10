"use client";

import {useCallback, useEffect, useState} from "react";
import {getBookmarkStorageKey, getRecentRoutesStorageKey} from "@shared/config/env";
import {triggerHaptic} from "@shared/utils/haptics";

export const WONJU_DEFAULT_BOOKMARKS = ["30", "34", "34-1"];
export const EMPTY_DEFAULT_BOOKMARKS: string[] = [];

export const BOOKMARKS_SYNC_EVENT = "wbus:bookmarks-updated";
export const RECENT_ROUTES_SYNC_EVENT = "wbus:recent-routes-updated";

/**
 * Pure storage helpers for bookmarks
 */
export function loadBookmarksFromStorage(storageKey: string, fallback: string[]): string[] {
    if (typeof window === "undefined") return fallback;
    try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed;
            }
        }
        return fallback;
    } catch {
        return fallback;
    }
}

export function toggleBookmarkInList(current: string[], routeName: string): string[] {
    const exists = current.includes(routeName);
    return exists ? current.filter((r) => r !== routeName) : [...current, routeName];
}

/**
 * Pure storage helpers for recent routes
 */
export function loadRecentRoutesFromStorage(storageKey: string): string[] {
    if (typeof window === "undefined") return [];
    try {
        const raw = localStorage.getItem(storageKey);
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

export function updateRecentRoutesList(current: string[], routeName: string, maxCount: number = 6): string[] {
    if (!routeName) return current;
    const filtered = current.filter((r) => r !== routeName);
    return [routeName, ...filtered].slice(0, maxCount);
}

/**
 * Hook to manage city-scoped bookmarked bus routes with multi-tab & cross-component sync.
 */
export function useRouteBookmarks(cityCode: string = "32020") {
    const storageKey = getBookmarkStorageKey(cityCode);
    const defaultBookmarks = cityCode === "32020" ? WONJU_DEFAULT_BOOKMARKS : EMPTY_DEFAULT_BOOKMARKS;

    const [bookmarks, setBookmarks] = useState<string[]>(defaultBookmarks);

    const syncBookmarks = useCallback(() => {
        setBookmarks(loadBookmarksFromStorage(storageKey, defaultBookmarks));
    }, [storageKey, defaultBookmarks]);

    useEffect(() => {
        const frameId = requestAnimationFrame(() => {
            syncBookmarks();
        });
        const handleSync = () => syncBookmarks();
        window.addEventListener(BOOKMARKS_SYNC_EVENT, handleSync);
        window.addEventListener("storage", handleSync);
        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener(BOOKMARKS_SYNC_EVENT, handleSync);
            window.removeEventListener("storage", handleSync);
        };
    }, [syncBookmarks]);

    const isBookmarked = useCallback(
        (routeName: string) => bookmarks.includes(routeName),
        [bookmarks]
    );

    const toggleBookmark = useCallback(
        (routeName: string) => {
            if (typeof window === "undefined") return;
            const current = loadBookmarksFromStorage(storageKey, bookmarks);
            const next = toggleBookmarkInList(current, routeName);

            setBookmarks(next);
            triggerHaptic(current.includes(routeName) ? "light" : "medium");
            try {
                localStorage.setItem(storageKey, JSON.stringify(next));
                window.dispatchEvent(new CustomEvent(BOOKMARKS_SYNC_EVENT));
            } catch {
                // Ignore storage error
            }
        },
        [bookmarks, storageKey]
    );

    return {
        bookmarks,
        isBookmarked,
        toggleBookmark,
    };
}

/**
 * Hook to manage city-scoped recently viewed routes with multi-tab sync.
 */
export function useRecentRoutes(cityCode: string = "32020", maxCount: number = 6) {
    const storageKey = getRecentRoutesStorageKey(cityCode);
    const [recentRoutes, setRecentRoutes] = useState<string[]>([]);

    const syncRecents = useCallback(() => {
        setRecentRoutes(loadRecentRoutesFromStorage(storageKey));
    }, [storageKey]);

    useEffect(() => {
        const frameId = requestAnimationFrame(() => {
            syncRecents();
        });
        const handleSync = () => syncRecents();
        window.addEventListener(RECENT_ROUTES_SYNC_EVENT, handleSync);
        window.addEventListener("storage", handleSync);
        return () => {
            cancelAnimationFrame(frameId);
            window.removeEventListener(RECENT_ROUTES_SYNC_EVENT, handleSync);
            window.removeEventListener("storage", handleSync);
        };
    }, [syncRecents]);

    const addRecentRoute = useCallback(
        (routeName: string) => {
            if (typeof window === "undefined" || !routeName) return;
            const current = loadRecentRoutesFromStorage(storageKey);
            const next = updateRecentRoutesList(current, routeName, maxCount);

            setRecentRoutes(next);
            try {
                localStorage.setItem(storageKey, JSON.stringify(next));
                window.dispatchEvent(new CustomEvent(RECENT_ROUTES_SYNC_EVENT));
            } catch {
                // Ignore
            }
        },
        [maxCount, storageKey]
    );

    return {
        recentRoutes,
        addRecentRoute,
    };
}
