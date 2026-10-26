"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {usePathname, useSearchParams} from "next/navigation";
import {APP_CONFIG, getRecentRoutesStorageKey, MAP_SETTINGS, STORAGE_KEYS} from "@shared/config/env";
import {useCityContext} from "@entities/city";
import type {DayMode, NavTab} from "@shared/types/navigation";

export function resolveTabFromPathname(path: string): NavTab {
    if (path.startsWith("/schedule")) return "schedule";
    return "map";
}

export function buildMapUrl(route: string | null | undefined, cityCode?: string): string {
    const params = new URLSearchParams();
    if (cityCode) {
        params.set("cityCode", cityCode);
    }
    if (route !== null && route !== undefined && route !== "") {
        params.set("route", route);
    }
    const qs = params.toString();
    return qs ? `/?${qs}` : "/";
}

export function buildScheduleUrl(cityCode?: string): string {
    const params = new URLSearchParams();
    if (cityCode && cityCode !== "32020") {
        params.set("cityCode", cityCode);
    }
    const qs = params.toString();
    return qs ? `/schedule?${qs}` : "/schedule";
}

export function useAppNavigation() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const {currentCity} = useCityContext();
    const currentCityCode = currentCity.code;

    // Derive active tab with client-side state preservation across tab switches (Map-first default)
    const [activeTab, setActiveTab] = useState<NavTab>(() => resolveTabFromPathname(pathname));
    const [prevPathname, setPrevPathname] = useState(pathname);
    if (pathname !== prevPathname) {
        setPrevPathname(pathname);
        setActiveTab(resolveTabFromPathname(pathname));
    }

    const [dayMode, setDayMode] = useState<DayMode>("AUTO");

    // Route & Map Activation State
    const [selectedRoute, setSelectedRoute] = useState<string>(() => {
        const queryRoute = searchParams.get("route");
        if (queryRoute !== null && queryRoute !== "") return queryRoute;
        return MAP_SETTINGS.DEFAULT_ROUTE;
    });

    const isMapActive = activeTab === "map";
    const hasVisitedMap = true;

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
            const nextTab = resolveTabFromPathname(window.location.pathname);
            setActiveTab(nextTab);
            const search = new URLSearchParams(window.location.search);
            const queryRoute = search.get("route");
            if (queryRoute !== null && queryRoute !== "") setSelectedRoute(queryRoute);
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, []);

    // Scroll to top when changing tabs
    useEffect(() => {
        if (typeof window !== "undefined") {
            window.scrollTo({top: 0, left: 0, behavior: "instant"});
        }
    }, [activeTab]);

    // Restore saved preferences once on initial client mount if not in URL
    const hasRestoredRef = useRef(false);
    useEffect(() => {
        if (hasRestoredRef.current) return;
        hasRestoredRef.current = true;
        const frameId = requestAnimationFrame(() => {
            try {
                const search = new URLSearchParams(window.location.search);
                const savedRoute = localStorage.getItem(STORAGE_KEYS.ROUTE_ID);
                if (savedRoute && !search.get("route")) {
                    setSelectedRoute(savedRoute);
                }
            } catch (e) {
                if (APP_CONFIG.IS_DEV) {
                    console.warn("[AppShell] Failed to load preferences from localStorage", e);
                }
            }
        });
        return () => cancelAnimationFrame(frameId);
    }, []);

    const handleTabChange = useCallback(
        (tab: NavTab) => {
            setActiveTab(tab);
            const targetUrl =
                tab === "map"
                    ? buildMapUrl(selectedRoute, currentCityCode)
                    : buildScheduleUrl(currentCityCode);

            if (typeof window !== "undefined") {
                window.history.pushState(null, "", targetUrl);
            }

            try {
                localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tab);
            } catch {
                // Ignore
            }
        },
        [selectedRoute, currentCityCode]
    );

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
            if (typeof window !== "undefined" && activeTab === "map") {
                const targetUrl = buildMapUrl(route, targetCityCode);
                window.history.replaceState(null, "", targetUrl);
            }
        },
        [activeTab, currentCityCode]
    );

    const handleSelectMapRoute = useCallback(
        (routeName: string, cityCode?: string) => {
            const targetCityCode = cityCode || currentCityCode;
            handleRouteChange(routeName, targetCityCode);
            setActiveTab("map");
            if (typeof window !== "undefined") {
                const targetUrl = buildMapUrl(routeName, targetCityCode);
                window.history.pushState(null, "", targetUrl);
            }
        },
        [handleRouteChange, currentCityCode]
    );

    return {
        activeTab,
        dayMode,
        setDayMode,
        selectedRoute,
        setSelectedRoute,
        isMapActive,
        hasVisitedMap,
        handleTabChange,
        handleRouteChange,
        handleSelectMapRoute,
    };
}
