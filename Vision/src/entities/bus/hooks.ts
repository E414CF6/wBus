import { APP_CONFIG } from "@core/constants/env";
import { getRouteMap } from "@entities/route/api";
import { useEffect, useRef, useState } from "react";

/**
 * Get (routeName) -> routeIds[] mapping for bus routes.
 * Example: { "30": ["30100123", "30100124"] }
 */
export function useBusRouteMap(): Record<string, string[]> | null {
    const [data, setData] = useState<Record<string, string[]> | null>(null);
    const hasFetched = useRef(false);

    useEffect(() => {
        if (hasFetched.current) return;
        hasFetched.current = true;

        getRouteMap()
            .then((map) => {
                setData(map);
            })
            .catch((err) => {
                if (APP_CONFIG.IS_DEV)
                    console.error("[useBusRouteMap] Error fetching route map", err);
            });
    }, []);

    return data;
}
