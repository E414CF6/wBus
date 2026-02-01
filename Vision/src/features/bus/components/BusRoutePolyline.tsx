"use client";

import { Polyline } from "react-leaflet";
import { memo, useEffect, useMemo, useRef, useState } from "react";

import { APP_CONFIG, MAP_SETTINGS } from "@core/config/env";

import { useBusContext } from "@map/context/MapContext";

import { getRouteInfo } from "@bus/api/getStaticData";

import { useBusLocationData } from "@bus/hooks/useBusLocation";
import { useMultiPolyline } from "@bus/hooks/useBusMultiPolyline";

import type { PathOptions } from "leaflet";

import type { PolylineSegment } from "@bus/hooks/useBusMultiPolyline";

// ----------------------------------------------------------------------
// Constants
// ----------------------------------------------------------------------

const COLORS = {
  ACTIVE_UP: "#3b82f6",     // Blue-500
  ACTIVE_DOWN: "#ef4444",   // Red-500
  INACTIVE_UP: "#93c5fd",   // Blue-300
  INACTIVE_DOWN: "#fca5a5", // Red-300
} as const;

const BASE_OPTIONS: PathOptions = {
  lineCap: "round",
  lineJoin: "round",
};

// ----------------------------------------------------------------------
// Helper Hook: useRouteIds
// ----------------------------------------------------------------------

function useRouteIds(routeName: string) {
  const [routeIds, setRouteIds] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;

    const fetchRouteIds = async () => {
      try {
        const info = await getRouteInfo(routeName);
        if (isMounted) {
          setRouteIds(info?.vehicleRouteIds ?? []);
        }
      } catch (error) {
        if (APP_CONFIG.IS_DEV) console.error(error);
      }
    };

    fetchRouteIds();

    return () => {
      isMounted = false;
    };
  }, [routeName]);

  return routeIds;
}

// ----------------------------------------------------------------------
// Sub-Component: PolylineLayer
// ----------------------------------------------------------------------

interface PolylineLayerProps {
  segments: PolylineSegment[];
  color: string;
  isDashed?: boolean;
  opacity?: number;
  useGradient?: boolean; // If true, fades out segments sequentially
}

const PolylineLayer = memo(({
  segments,
  color,
  isDashed,
  opacity = 1.0,
  useGradient = false
}: PolylineLayerProps) => {
  const pathOptions = useMemo<PathOptions>(() => ({
    ...BASE_OPTIONS,
    color,
    weight: isDashed ? 3 : 6,
    dashArray: isDashed ? "6, 6" : undefined,
  }), [color, isDashed]);

  if (segments.length === 0) return null;

  return (
    <>
      {segments.map((segment, idx) => {
        // Unique key generation using routeIds and index
        const key = `${segment.direction}-${segment.routeIds.join("_")}-${idx}`;

        // Calculate gradient opacity if enabled, otherwise use fixed opacity
        const segmentOpacity = useGradient
          ? Math.max(1 - idx / segments.length, 0.2)
          : opacity;

        return (
          <Polyline
            key={key}
            positions={segment.coords}
            pathOptions={{
              ...pathOptions,
              opacity: segmentOpacity,
            }}
          />
        );
      })}
    </>
  );
});

PolylineLayer.displayName = "PolylineLayer";

// ----------------------------------------------------------------------
// Main Component
// ----------------------------------------------------------------------

export default function BusRoutePolyline({ routeName }: { routeName: string }) {
  // Data Fetching
  const { map } = useBusContext();
  const routeIds = useRouteIds(routeName);
  const { data: busList } = useBusLocationData(routeName);
  const lastBoundsKeyRef = useRef<string | null>(null);

  // Determine Logic
  const activeRouteIds = useMemo(() => {
    const set = new Set(busList.map((bus) => bus.routeid).filter(Boolean));
    return Array.from(set);
  }, [busList]);

  const {
    activeUpSegments,
    inactiveUpSegments,
    activeDownSegments,
    inactiveDownSegments,
    bounds,
  } = useMultiPolyline(routeName, routeIds, activeRouteIds);

  // Styling Logic
  const hasActiveSegments = activeUpSegments.length > 0 || activeDownSegments.length > 0;
  const showInactiveSegments = hasActiveSegments;
  const isNoBusRunning = busList.length === 0;

  const displayActiveUpSegments = hasActiveSegments ? activeUpSegments : inactiveUpSegments;
  const displayActiveDownSegments = hasActiveSegments ? activeDownSegments : inactiveDownSegments;

  useEffect(() => {
    if (!map || !bounds) return;

    const key = bounds.flat().join(",");
    if (lastBoundsKeyRef.current === key) return;
    lastBoundsKeyRef.current = key;

    map.fitBounds(bounds, {
      padding: [32, 32],
      animate: true,
      duration: MAP_SETTINGS.ANIMATION.FLY_TO_MS / 1000,
    });
  }, [map, bounds]);

  return (
    <>
      {/* Background Layers (Inactive Routes) */}
      {showInactiveSegments && (
        <PolylineLayer
          segments={inactiveUpSegments}
          color={COLORS.INACTIVE_UP}
          isDashed={true}
          opacity={0.25}
        />
      )}
      {showInactiveSegments && (
        <PolylineLayer
          segments={inactiveDownSegments}
          color={COLORS.INACTIVE_DOWN}
          isDashed={true}
          opacity={0.25}
        />
      )}

      {/* Foreground Layers (Active Routes) */}
      <PolylineLayer
        segments={displayActiveUpSegments}
        color={COLORS.ACTIVE_UP}
        isDashed={isNoBusRunning} // Dash active route if no bus is running
        useGradient={!isNoBusRunning} // Apply gradient only when buses are active
        opacity={isNoBusRunning ? 0.5 : 1.0}
      />
      <PolylineLayer
        segments={displayActiveDownSegments}
        color={COLORS.ACTIVE_DOWN}
        isDashed={isNoBusRunning}
        useGradient={!isNoBusRunning}
        opacity={isNoBusRunning ? 0.5 : 1.0}
      />
    </>
  );
}
