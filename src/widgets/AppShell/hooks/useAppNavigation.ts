"use client";

import {useCallback, useEffect, useState} from "react";
import {usePathname, useSearchParams} from "next/navigation";
import {APP_CONFIG, MAP_SETTINGS, STORAGE_KEYS} from "@shared/config/env";
import {useCityContext} from "@entities/city";
import type {DayMode, NavTab, TimetableSubTab} from "@shared/types/navigation";

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

export function useAppNavigation() {
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const {currentCity} = useCityContext();

    // Derive active tab with client-side state preservation across tab switches (Map-first default)
    const [activeTab, setActiveTab] = useState<NavTab>(() => resolveTabFromPathname(pathname));
    const [prevPathname, setPrevPathname] = useState(pathname);
    if (pathname !== prevPathname) {
        setPrevPathname(pathname);
        setActiveTab(resolveTabFromPathname(pathname));
    }

    // Timetable Sub-tab & Day Mode
    const [timetableSubTab, setTimetableSubTab] = useState<TimetableSubTab>(() => {
        const querySubTab = searchParams.get("subTab");
        if (querySubTab === "yonsei" || querySubTab === "all") return querySubTab;
        return "yonsei";
    });
    const [dayMode, setDayMode] = useState<DayMode>("AUTO");

    // Route & Map Activation State
    const [selectedRoute, setSelectedRoute] = useState<string>(() => {
        const queryRoute = searchParams.get("route");
        if (queryRoute !== null && queryRoute !== "") return queryRoute;
        return MAP_SETTINGS.DEFAULT_ROUTE;
    });

    const isMapActive = activeTab === "map";
    // In map-centric architecture, map is always mounted and ready
    const hasVisitedMap = true;

    // Synchronize route & timetable subtab when searchParams change
    const [prevSearchParams, setPrevSearchParams] = useState(searchParams);
    if (searchParams !== prevSearchParams) {
        setPrevSearchParams(searchParams);
        const queryRoute = searchParams.get("route");
        if (queryRoute !== null && queryRoute !== "" && queryRoute !== selectedRoute) {
            setSelectedRoute(queryRoute);
        }
        const querySubTab = searchParams.get("subTab");
        if (querySubTab === "yonsei" || querySubTab === "all") {
            setTimetableSubTab(querySubTab);
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
            const querySubTab = search.get("subTab");
            if (querySubTab === "yonsei" || querySubTab === "all") {
                setTimetableSubTab(querySubTab);
            }
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

    // Restore saved preferences on initial client mount if not in URL
    useEffect(() => {
        requestAnimationFrame(() => {
            try {
                const savedSubTab = localStorage.getItem(
                    STORAGE_KEYS.TIMETABLE_SUBTAB
                ) as TimetableSubTab | null;
                if (savedSubTab && !searchParams.get("subTab")) {
                    if (savedSubTab === "yonsei" || savedSubTab === "all") {
                        setTimetableSubTab(savedSubTab);
                    }
                }

                const savedRoute = localStorage.getItem(STORAGE_KEYS.ROUTE_ID);
                if (savedRoute && !searchParams.get("route")) {
                    setSelectedRoute(savedRoute);
                }
            } catch (e) {
                if (APP_CONFIG.IS_DEV) {
                    console.warn("[AppShell] Failed to load preferences from localStorage", e);
                }
            }
        });
    }, [searchParams]);

    const handleScheduleSubTabChange = useCallback(
        (subTab: TimetableSubTab) => {
            setTimetableSubTab(subTab);
            try {
                localStorage.setItem(STORAGE_KEYS.TIMETABLE_SUBTAB, subTab);
            } catch (e) {
                if (APP_CONFIG.IS_DEV) {
                    console.warn("[handleScheduleSubTabChange] Failed to save subtab preference", e);
                }
            }
            if (typeof window !== "undefined" && activeTab === "schedule") {
                const query = subTab === "yonsei" ? "/" : "/?subTab=all";
                window.history.replaceState(null, "", query);
            }
        },
        [activeTab]
    );

    const handleTabChange = useCallback(
        (tab: NavTab) => {
            setActiveTab(tab);
            let targetUrl: string;
            if (tab === "map") {
                targetUrl = buildMapUrl(selectedRoute, currentCity?.code);
            } else {
                const params = new URLSearchParams();
                if (currentCity?.code && currentCity.code !== "32020") {
                    params.set("cityCode", currentCity.code);
                }
                if (timetableSubTab === "all") {
                    params.set("subTab", "all");
                }
                const qs = params.toString();
                targetUrl = qs ? `/schedule?${qs}` : "/schedule";
            }

            if (typeof window !== "undefined") {
                window.history.pushState(null, "", targetUrl);
            }

            try {
                localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tab);
            } catch {
                // Ignore
            }
        },
        [selectedRoute, timetableSubTab, currentCity?.code]
    );

    const handleRouteChange = useCallback(
        (route: string, cityCode?: string) => {
            setSelectedRoute(route);
            const targetCityCode = cityCode || currentCity?.code;
            try {
                const recentKey = targetCityCode === "32020" ? "wbus_recent_map_routes" : `wbus_recent_routes_${targetCityCode}`;
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
        [activeTab, currentCity?.code]
    );

    const handleSelectMapRoute = useCallback(
        (routeName: string, cityCode?: string) => {
            const targetCityCode = cityCode || currentCity?.code;
            handleRouteChange(routeName, targetCityCode);
            setActiveTab("map");
            if (typeof window !== "undefined") {
                const targetUrl = buildMapUrl(routeName, targetCityCode);
                window.history.pushState(null, "", targetUrl);
            }
        },
        [handleRouteChange, currentCity?.code]
    );

    return {
        activeTab,
        timetableSubTab,
        dayMode,
        setDayMode,
        selectedRoute,
        setSelectedRoute,
        isMapActive,
        hasVisitedMap,
        handleTabChange,
        handleScheduleSubTabChange,
        handleRouteChange,
        handleSelectMapRoute,
    };
}
