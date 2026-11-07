import {useMemo, useState} from "react";
import type {RouteVariationStop} from "@entities/route/types";

export type DirectionFilter = "all" | "up" | "down" | "fav";

export function filterStops(
    stops: RouteVariationStop[],
    directionFilter: DirectionFilter,
    hasDirections: boolean,
    searchQuery: string,
    isFavoriteStop: (nodeid: string) => boolean
): RouteVariationStop[] {
    let list = stops;

    if (directionFilter === "fav") {
        list = list.filter((s) => isFavoriteStop(s.nodeid));
    } else if (directionFilter !== "all" && hasDirections) {
        const targetUd = directionFilter === "up" ? 0 : 1;
        list = list.filter((s) => s.updowncd === targetUd);
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
        list = list.filter(
            (s) =>
                s.nodenm.toLowerCase().includes(q) ||
                String(s.nodeno ?? "").toLowerCase().includes(q)
        );
    }

    return list;
}

export interface UseStopSearchFilterProps {
    currentStops: RouteVariationStop[];
    isFavoriteStop: (nodeid: string) => boolean;
}

export function useStopSearchFilter({currentStops, isFavoriteStop}: UseStopSearchFilterProps) {
    const [directionFilter, setDirectionFilter] = useState<DirectionFilter>("all");
    const [stopSearchQuery, setStopSearchQuery] = useState("");

    const hasDirections = useMemo(() => {
        const uds = new Set(
            currentStops
                .map((s) => s.updowncd)
                .filter((u): u is number => u !== undefined && u !== null)
        );
        return uds.size > 1;
    }, [currentStops]);

    const favoriteStopsCountInRoute = useMemo(() => {
        return currentStops.filter((s) => isFavoriteStop(s.nodeid)).length;
    }, [currentStops, isFavoriteStop]);

    const filteredStops = useMemo(() => {
        return filterStops(currentStops, directionFilter, hasDirections, stopSearchQuery, isFavoriteStop);
    }, [currentStops, directionFilter, hasDirections, stopSearchQuery, isFavoriteStop]);

    const resetFilters = () => {
        setDirectionFilter("all");
        setStopSearchQuery("");
    };

    return {
        directionFilter,
        setDirectionFilter,
        stopSearchQuery,
        setStopSearchQuery,
        hasDirections,
        favoriteStopsCountInRoute,
        filteredStops,
        resetFilters,
    };
}
