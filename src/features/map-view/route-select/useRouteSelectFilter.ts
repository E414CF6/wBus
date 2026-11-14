"use client";

import {useMemo} from "react";
import {
    getRouteMeta,
    resolveRouteCategory,
    type RouteCategoryInfo,
    type RouteMeta,
    YONSEI_ROUTE_SET,
} from "@entities/route";
import type {RawCityRoute} from "@entities/bus/api/publicApi";
import type {BusStop, FavoriteStop} from "@entities/station/types";
import {UI_TEXT} from "@shared/config/locale";
import {matchesHangul} from "@shared/utils/hangul";
import {GraduationCap, MapPin, Star} from "lucide-react";

function sortRoutes(routes: string[]): string[] {
    return [...routes].sort((a, b) =>
        a.localeCompare(b, undefined, {numeric: true, sensitivity: "base"})
    );
}

export interface CategoryChip {
    id: string;
    label: string;
    icon?: React.ComponentType<{ className?: string }>;
    dotClass?: string;
    activeClass?: string;
}

interface UseRouteSelectFilterParams {
    allRoutes: string[];
    cityRoutes: RawCityRoute[];
    cityCode: string;
    bookmarks: string[];
    favoriteStops: FavoriteStop[];
    currentRouteStops: BusStop[];
    hasUniversityShuttle: boolean;
    showYonseiFeatures: boolean;
    searchQuery: string;
    selectedCategory: string;
}

export function useRouteSelectFilter({
    allRoutes,
    cityRoutes,
    cityCode,
    bookmarks,
    favoriteStops,
    currentRouteStops,
    hasUniversityShuttle,
    showYonseiFeatures,
    searchQuery,
    selectedCategory,
}: UseRouteSelectFilterParams) {
    const sortedAllRoutes = useMemo(() => {
        const effective =
            cityRoutes && cityRoutes.length > 0
                ? Array.from(new Set(cityRoutes.map((r) => String(r.routeno))))
                : allRoutes.filter(Boolean);
        return sortRoutes(effective);
    }, [cityRoutes, allRoutes]);

    const routeMetaMap = useMemo(() => {
        const map = new Map<string, RouteMeta>();
        for (const route of sortedAllRoutes) {
            map.set(route, getRouteMeta(route, cityCode));
        }
        return map;
    }, [sortedAllRoutes, cityCode]);

    const rawTypeMap = useMemo(() => {
        const map = new Map<string, string>();
        for (const r of cityRoutes) {
            const no = String(r.routeno);
            if (r.routetp && !map.has(no)) {
                map.set(no, r.routetp);
            }
        }
        return map;
    }, [cityRoutes]);

    const routeCategoryMap = useMemo(() => {
        const map = new Map<string, RouteCategoryInfo>();
        for (const route of sortedAllRoutes) {
            const rawType = rawTypeMap.get(route) || routeMetaMap.get(route)?.routeType;
            map.set(route, resolveRouteCategory(rawType));
        }
        return map;
    }, [sortedAllRoutes, rawTypeMap, routeMetaMap]);

    const dynamicCategories = useMemo(() => {
        const counts = new Map<string, { info: RouteCategoryInfo; count: number }>();
        for (const r of sortedAllRoutes) {
            const cat = routeCategoryMap.get(r);
            if (!cat) continue;
            const existing = counts.get(cat.id);
            if (existing) {
                existing.count += 1;
            } else {
                counts.set(cat.id, {info: cat, count: 1});
            }
        }

        return Array.from(counts.values())
            .sort((a, b) => a.info.order - b.info.order)
            .map(({info, count}) => ({
                id: info.id,
                label: `${info.label} (${count})`,
                dotClass: info.dotClass,
                activeClass: info.activeClass,
            }));
    }, [sortedAllRoutes, routeCategoryMap]);

    const categories = useMemo<CategoryChip[]>(() => {
        const bookmarkedCount = sortedAllRoutes.filter((r) => bookmarks.includes(r)).length;

        const list: CategoryChip[] = [
            {
                id: "ALL",
                label: UI_TEXT.ROUTE_SELECT.CATEGORY_ALL(sortedAllRoutes.length),
                activeClass:
                    "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md shadow-black/10 dark:shadow-white/10 scale-[1.02]",
            },
            {
                id: "BOOKMARKS",
                label: UI_TEXT.ROUTE_SELECT.CATEGORY_BOOKMARKS(bookmarkedCount),
                icon: Star,
                activeClass: "bg-amber-500 text-white shadow-md shadow-amber-500/30 scale-[1.02]",
            },
        ];

        if (favoriteStops.length > 0) {
            list.push({
                id: "FAV_STOPS",
                label: `정류장 즐겨찾기 (${favoriteStops.length})`,
                icon: MapPin,
                activeClass: "bg-amber-500 text-white shadow-md shadow-amber-500/30 scale-[1.02]",
            });
        }

        if (hasUniversityShuttle && showYonseiFeatures) {
            list.push({
                id: "YONSEI",
                label: UI_TEXT.ROUTE_SELECT.CATEGORY_YONSEI,
                icon: GraduationCap,
                activeClass: "bg-[#003876] text-white shadow-md shadow-[#003876]/30 scale-[1.02]",
            });
        }

        for (const cat of dynamicCategories) {
            list.push(cat);
        }

        return list;
    }, [hasUniversityShuttle, showYonseiFeatures, sortedAllRoutes, bookmarks, favoriteStops.length, dynamicCategories]);

    const effectiveCategory = useMemo(() => {
        if (selectedCategory !== "ALL" && !categories.some((c) => c.id === selectedCategory)) {
            return "ALL";
        }
        return selectedCategory;
    }, [categories, selectedCategory]);

    const matchedStops = useMemo<BusStop[]>(() => {
        const q = searchQuery.trim();
        if (!q && effectiveCategory !== "FAV_STOPS") return [];

        const deduped = new Map<string, BusStop>();
        for (const fav of favoriteStops) {
            deduped.set(fav.nodeid, {
                nodeid: fav.nodeid,
                nodenm: fav.nodenm,
                nodeno: fav.nodeno,
                gpslati: fav.gpslati,
                gpslong: fav.gpslong,
            });
        }

        if (effectiveCategory !== "FAV_STOPS") {
            for (const s of currentRouteStops) {
                if (!deduped.has(s.nodeid)) {
                    deduped.set(s.nodeid, s);
                }
            }
        }

        const allCandidateStops = Array.from(deduped.values());
        if (!q) return allCandidateStops;

        return allCandidateStops
            .filter(
                (s) =>
                    matchesHangul(s.nodenm, q) ||
                    String(s.nodeno ?? "").toLowerCase().includes(q.toLowerCase())
            )
            .slice(0, 12);
    }, [searchQuery, effectiveCategory, favoriteStops, currentRouteStops]);

    const filteredRoutes = useMemo(() => {
        if (effectiveCategory === "FAV_STOPS" && !searchQuery.trim()) {
            return [];
        }

        let list = sortedAllRoutes;

        if (effectiveCategory === "BOOKMARKS") {
            list = list.filter((r) => bookmarks.includes(r));
        } else if (effectiveCategory === "YONSEI") {
            list = list.filter((r) => YONSEI_ROUTE_SET.has(r));
        } else if (effectiveCategory !== "ALL" && effectiveCategory !== "FAV_STOPS") {
            list = list.filter((r) => routeCategoryMap.get(r)?.id === effectiveCategory);
        }

        const q = searchQuery.trim();
        if (q) {
            list = list.filter((r) => {
                const meta = routeMetaMap.get(r);
                const category = routeCategoryMap.get(r);
                return (
                    matchesHangul(r, q) ||
                    (meta ? matchesHangul(meta.origin, q) : false) ||
                    (meta ? matchesHangul(meta.destination, q) : false) ||
                    (meta?.description ? matchesHangul(meta.description, q) : false) ||
                    (meta?.routeType ? matchesHangul(meta.routeType, q) : false) ||
                    (category ? matchesHangul(category.label, q) : false)
                );
            });
        }

        return list;
    }, [sortedAllRoutes, effectiveCategory, searchQuery, bookmarks, routeCategoryMap, routeMetaMap]);

    return {
        sortedAllRoutes,
        routeMetaMap,
        routeCategoryMap,
        categories,
        effectiveCategory,
        matchedStops,
        filteredRoutes,
    };
}
