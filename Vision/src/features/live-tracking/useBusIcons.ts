"use client";

import { MAP_SETTINGS } from "@core/constants/env";
import L from "@shared/lib/leafletSetup";
import { useMemo } from "react";

// Check if we are in a client environment
const isClient = typeof window !== "undefined";

type IconMap = {
    busIcon: L.Icon;
    busStopIcon: L.Icon;
};

export function useIcons(): Partial<IconMap> {
    return useMemo(() => {
        if (!isClient) return {};

        const createIcon = (
            url: string,
            size: [number, number],
            anchor: [number, number],
            popup: [number, number]
        ) =>
            new L.Icon({
                iconUrl: url,
                iconSize: size,
                iconAnchor: anchor,
                popupAnchor: popup,
            });

        const busMarkerSettings = MAP_SETTINGS.MARKERS.BUS;

        return {
            busIcon: createIcon(
                "/icons/bus-icon.png",
                busMarkerSettings.ICON_SIZE,
                busMarkerSettings.ICON_ANCHOR,
                busMarkerSettings.POPUP_ANCHOR
            ),
            busStopIcon: createIcon(
                "/icons/bus-stop-icon.png",
                [16, 16],
                [8, 16],
                [0, -14]
            )
        };
    }, []);
}
