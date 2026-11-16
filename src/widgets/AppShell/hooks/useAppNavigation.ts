"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {useSearchParams} from "next/navigation";
import {APP_CONFIG, getRecentRoutesStorageKey, MAP_SETTINGS, STORAGE_KEYS} from "@shared/config/env";
import {useAppSettings} from "@shared/context/AppSettingsContext";
import {useCityContext} from "@entities/city";
import type {DayMode} from "@shared/types/navigation";

export function buildMapUrl(
    route: string | null | undefined,
    cityCode?: string,
    wikiSlug?: string | null
): string {
    const params = new URLSearchParams();
    if (cityCode) {
        params.set("cityCode", cityCode);
    }
    if (route !== null && route !== undefined && route !== "") {
        params.set("route", route);
    }
    if (wikiSlug && wikiSlug.trim()) {
        params.set("wiki", wikiSlug.trim());
    }
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
}

export function useAppNavigation() {
    const searchParams = useSearchParams();
    const {currentCity, isCityReady} = useCityContext();
    const currentCityCode = currentCity.code;

    const {settings} = useAppSettings();
    const [dayMode, setDayMode] = useState<DayMode>(settings.defaultDayMode);
    const [prevDefaultDayMode, setPrevDefaultDayMode] = useState<DayMode>(settings.defaultDayMode);
    if (settings.defaultDayMode !== prevDefaultDayMode) {
        setPrevDefaultDayMode(settings.defaultDayMode);
        setDayMode(settings.defaultDayMode);
    }

    // Route & Map Activation State
    const [selectedRoute, setSelectedRoute] = useState<string>(() => {
        const queryRoute = searchParams.get("route");
        if (queryRoute !== null && queryRoute !== "") return queryRoute;
        return MAP_SETTINGS.DEFAULT_ROUTE;
    });

    // Clear stale route from the previous city when the user switches cities
    const [prevCityCode, setPrevCityCode] = useState<string | null>(null);
    if (isCityReady && prevCityCode === null) {
        setPrevCityCode(currentCityCode);
    } else if (isCityReady && prevCityCode !== null && prevCityCode !== currentCityCode) {
        setPrevCityCode(currentCityCode);
        const queryRoute = searchParams.get("route");
        if (!queryRoute) {
            setSelectedRoute("");
        }
    }

    // Synchronize route when searchParams change
    const [prevSearchParams, setPrevSearchParams] = useState(searchParams);
    if (searchParams !== prevSearchParams) {
        setPrevSearchParams(searchParams);
        const queryRoute = searchParams.get("route");
        if (queryRoute !== null && queryRoute !== "" && queryRoute !== selectedRoute) {
            setSelectedRoute(queryRoute);
        }
    }

    // Handle browser Back/Forward (popstate) navigation cleanly
    useEffect(() => {
        const handlePopState = () => {
            if (typeof window === "undefined") return;
            const search = new URLSearchParams(window.location.search);
            const queryRoute = search.get("route");
            if (queryRoute !== null && queryRoute !== "") setSelectedRoute(queryRoute);
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    // Restore saved preferences once initial city resolution completes if not in URL
    const hasRestoredRef = useRef(false);
    useEffect(() => {
        if (!isCityReady || hasRestoredRef.current) return;
        hasRestoredRef.current = true;
        const frameId = requestAnimationFrame(() => {
            try {
                const search = new URLSearchParams(window.location.search);
                const savedRoute = localStorage.getItem(STORAGE_KEYS.ROUTE_ID);
                const savedCityCode = localStorage.getItem(STORAGE_KEYS.CITY_CODE);
                const canRestoreSavedRoute = !savedCityCode || savedCityCode === currentCityCode;
                if (savedRoute && !search.get("route") && canRestoreSavedRoute) {
                    setSelectedRoute(savedRoute);
                }
            } catch (e) {
                if (APP_CONFIG.IS_DEV) {
                    console.warn("[AppShell] Failed to load preferences from localStorage", e);
                }
            }
        });
        return () => cancelAnimationFrame(frameId);
    }, [isCityReady, currentCityCode]);

    const handleRouteChange = useCallback(
        (route: string, cityCode?: string) => {
            setSelectedRoute(route);
            const targetCityCode = cityCode || currentCityCode;
            try {
                localStorage.setItem(STORAGE_KEYS.ROUTE_ID, route);
                const recentKey = getRecentRoutesStorageKey(targetCityCode);
                const savedRecent = localStorage.getItem(recentKey);
                const recents: string[] = savedRecent ? JSON.parse(savedRecent) : [];
                const filtered = recents.filter((r) => r !== route);
                filtered.unshift(route);
                localStorage.setItem(
                    recentKey,
                    JSON.stringify(filtered.slice(0, 10))
                );
            } catch {
                // Ignore
            }
            if (typeof window !== "undefined") {
                const targetUrl = buildMapUrl(route, targetCityCode);
                window.history.replaceState(null, "", targetUrl);
            }
        },
        [currentCityCode]
    );

    return {
        dayMode,
        setDayMode,
        selectedRoute,
        setSelectedRoute,
        handleRouteChange,
    };
}
