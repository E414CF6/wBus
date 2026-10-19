"use client";

import {useCallback, useEffect, useRef, useState} from "react";
import {usePathname, useSearchParams} from "next/navigation";
import {APP_CONFIG, getRecentRoutesStorageKey, MAP_SETTINGS, STORAGE_KEYS} from "@shared/config/env";
import {useCityContext} from "@entities/city";
import type {DayMode, NavTab, TimetableSubTab} from "@shared/types/navigation";

export function resolveTabFromPathname(path: string): NavTab {
    if (path.startsWith("/schedule") || path.startsWith("/wiki")) return "schedule";
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

export function buildScheduleUrl(
    subTab: TimetableSubTab,
    cityCode?: string,
    docId?: string
): string {
    const params = new URLSearchParams();
    if (cityCode && cityCode !== "32020") {
        params.set("cityCode", cityCode);
    }
    if (subTab === "all") {
        params.set("subTab", "all");
    }
    if (docId && docId !== "yonsei" && docId !== "all" && docId !== `city:${cityCode || "32020"}`) {
        params.set("doc", docId);
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

    // Timetable Sub-tab, Wiki Document ID & Day Mode
    const [timetableSubTab, setTimetableSubTab] = useState<TimetableSubTab>(() => {
        const querySubTab = searchParams.get("subTab");
        if (querySubTab === "yonsei" || querySubTab === "all") return querySubTab;
        return "yonsei";
    });

    const [wikiDocId, setWikiDocId] = useState<string>(() => {
        const queryDoc = searchParams.get("doc");
        if (queryDoc) return queryDoc;
        const querySubTab = searchParams.get("subTab");
        if (querySubTab === "all") return `city:${currentCityCode}`;
        return currentCityCode === "32020" ? "yonsei" : `city:${currentCityCode}`;
    });

    const [dayMode, setDayMode] = useState<DayMode>("AUTO");

    // Route & Map Activation State
    const [selectedRoute, setSelectedRoute] = useState<string>(() => {
        const queryRoute = searchParams.get("route");
        if (queryRoute !== null && queryRoute !== "") return queryRoute;
        return MAP_SETTINGS.DEFAULT_ROUTE;
    });

    const isMapActive = activeTab === "map";
    const hasVisitedMap = true;

    // Synchronize route, subTab & doc when searchParams change
    const [prevSearchParams, setPrevSearchParams] = useState(searchParams);
    if (searchParams !== prevSearchParams) {
        setPrevSearchParams(searchParams);
        const queryRoute = searchParams.get("route");
        if (queryRoute !== null && queryRoute !== "" && queryRoute !== selectedRoute) {
            setSelectedRoute(queryRoute);
        }
        const queryDoc = searchParams.get("doc");
        const querySubTab = searchParams.get("subTab");
        if (querySubTab === "yonsei" || querySubTab === "all") {
            setTimetableSubTab(querySubTab);
        }
        if (queryDoc) {
            setWikiDocId(queryDoc);
        } else if (querySubTab === "all") {
            setWikiDocId(`city:${currentCityCode}`);
        } else if (querySubTab === "yonsei") {
            setWikiDocId("yonsei");
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
            const queryDoc = search.get("doc");
            const querySubTab = search.get("subTab");
            if (querySubTab === "yonsei" || querySubTab === "all") {
                setTimetableSubTab(querySubTab);
            }
            if (queryDoc) {
                setWikiDocId(queryDoc);
            } else if (querySubTab === "all") {
                setWikiDocId(`city:${currentCityCode}`);
            } else if (querySubTab === "yonsei") {
                setWikiDocId("yonsei");
            }
        };

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [currentCityCode]);

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
                const savedSubTab = localStorage.getItem(
                    STORAGE_KEYS.TIMETABLE_SUBTAB
                ) as TimetableSubTab | null;
                if (savedSubTab && !search.get("subTab") && !search.get("doc")) {
                    if (savedSubTab === "yonsei" || savedSubTab === "all") {
                        setTimetableSubTab(savedSubTab);
                        setWikiDocId(
                            savedSubTab === "all" ? `city:${currentCityCode}` : "yonsei"
                        );
                    }
                }

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
    }, [currentCityCode]);

    const handleScheduleSubTabChange = useCallback(
        (docOrSubTab: string) => {
            const nextSubTab: TimetableSubTab =
                docOrSubTab === "yonsei" || docOrSubTab === "yonsei-shuttle"
                    ? "yonsei"
                    : "all";
            const nextDocId =
                docOrSubTab === "all" ? `city:${currentCityCode}` : docOrSubTab;

            setTimetableSubTab(nextSubTab);
            setWikiDocId(nextDocId);

            try {
                localStorage.setItem(STORAGE_KEYS.TIMETABLE_SUBTAB, nextSubTab);
            } catch (e) {
                if (APP_CONFIG.IS_DEV) {
                    console.warn("[handleScheduleSubTabChange] Failed to save subtab preference", e);
                }
            }
            if (typeof window !== "undefined" && activeTab === "schedule") {
                const targetUrl = buildScheduleUrl(nextSubTab, currentCityCode, nextDocId);
                window.history.replaceState(null, "", targetUrl);
            }
        },
        [activeTab, currentCityCode]
    );

    const handleTabChange = useCallback(
        (tab: NavTab) => {
            setActiveTab(tab);
            const targetUrl =
                tab === "map"
                    ? buildMapUrl(selectedRoute, currentCityCode)
                    : buildScheduleUrl(timetableSubTab, currentCityCode, wikiDocId);

            if (typeof window !== "undefined") {
                window.history.pushState(null, "", targetUrl);
            }

            try {
                localStorage.setItem(STORAGE_KEYS.ACTIVE_TAB, tab);
            } catch {
                // Ignore
            }
        },
        [selectedRoute, timetableSubTab, wikiDocId, currentCityCode]
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
        timetableSubTab,
        wikiDocId,
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
