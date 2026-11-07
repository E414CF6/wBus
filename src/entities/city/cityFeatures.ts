import {useMemo} from "react";
import type {CityFeatures} from "./types";
import {useCityContext} from "./context/CityContext";

const WONJU_CITY_CODE = "32020";

/**
 * Returns functional policy features for a given city code.
 */
export function getCityFeatures(cityCode?: string | null): CityFeatures {
    const isWonju = cityCode === WONJU_CITY_CODE;

    return {
        hasDetailedTimetable: isWonju,
        hasUniversityShuttle: isWonju,
        hasRouteVariations: isWonju,
        defaultQuickRoutes: isWonju ? ["30", "34", "34-1"] : [],
        defaultRoute: isWonju ? "30" : null,
    };
}

/**
 * Hook to access current city feature flags in React components.
 */
export function useCityFeatures(): CityFeatures {
    const {currentCity} = useCityContext();
    return useMemo(() => getCityFeatures(currentCity?.code), [currentCity?.code]);
}
