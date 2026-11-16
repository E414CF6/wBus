"use client";

import {useEffect, useSyncExternalStore} from "react";

export interface RegisteredMapPin {
    id: string;
    lng: number;
    lat: number;
    width: number;
    height: number;
}

const registry = new Map<string, RegisteredMapPin[]>();
const listeners = new Set<() => void>();
let snapshotVersion = 0;

function notify() {
    snapshotVersion++;
    for (const listener of listeners) {
        listener();
    }
}

export function setMapPinObstacles(source: string, pins: RegisteredMapPin[]): void {
    const prev = registry.get(source);
    if (
        prev &&
        prev.length === pins.length &&
        prev.every(
            (p, idx) =>
                p.id === pins[idx].id &&
                p.lng === pins[idx].lng &&
                p.lat === pins[idx].lat &&
                p.width === pins[idx].width &&
                p.height === pins[idx].height,
        )
    ) {
        return;
    }
    if (pins.length === 0) {
        registry.delete(source);
    } else {
        registry.set(source, pins);
    }
    notify();
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function getSnapshot(): number {
    return snapshotVersion;
}

export function useMapPinObstacles(excludeSource?: string): RegisteredMapPin[] {
    useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    const all: RegisteredMapPin[] = [];
    for (const [source, list] of registry.entries()) {
        if (excludeSource && source === excludeSource) continue;
        for (const item of list) {
            all.push(item);
        }
    }
    return all;
}

/**
 * Helper hook for marker layers to publish their active fixed pins as obstacles.
 */
export function usePublishMapPinObstacles(source: string, pins: RegisteredMapPin[]): void {
    useEffect(() => {
        setMapPinObstacles(source, pins);
    }, [source, pins]);

    useEffect(() => {
        return () => setMapPinObstacles(source, []);
    }, [source]);
}

export interface ViewportBoundsBox {
    west: number;
    east: number;
    south: number;
    north: number;
}

export const MIN_WIKI_PIN_ZOOM = 10.5;
export const COMPACT_WIKI_PIN_ZOOM = 12.2;
export const MAX_RENDERED_WIKI_PINS_COMPACT = 40;
export const MAX_RENDERED_WIKI_PINS_FULL = 60;

export interface GeoPinLike {
    slug: string;
    lat?: number;
    lng?: number;
    pinned?: boolean;
}

export function filterPinsByViewportAndZoom<T extends GeoPinLike>(
    pins: readonly T[],
    zoom: number,
    bounds: ViewportBoundsBox | null,
    selectedSlug?: string | null,
): {
    visiblePins: T[];
    displayMode: "hidden" | "compact" | "full";
} {
    if (zoom < MIN_WIKI_PIN_ZOOM) {
        const selectedOnly =
            zoom >= 9 && selectedSlug
                ? pins.filter(
                      (p) =>
                          p.slug === selectedSlug &&
                          typeof p.lat === "number" &&
                          typeof p.lng === "number" &&
                          isInsideBufferedBounds(p.lat, p.lng, bounds, 0.2),
                  )
                : [];
        return {
            visiblePins: selectedOnly,
            displayMode: selectedOnly.length > 0 ? "compact" : "hidden",
        };
    }

    const displayMode = zoom >= COMPACT_WIKI_PIN_ZOOM ? "full" : "compact";
    const maxCount =
        displayMode === "full" ? MAX_RENDERED_WIKI_PINS_FULL : MAX_RENDERED_WIKI_PINS_COMPACT;

    const inViewport = pins.filter((p): p is T & {lat: number; lng: number} => {
        if (typeof p.lat !== "number" || typeof p.lng !== "number") return false;
        return isInsideBufferedBounds(p.lat, p.lng, bounds, 0.18);
    });

    if (inViewport.length <= maxCount) {
        return {visiblePins: inViewport, displayMode};
    }

    const centerLat = bounds ? (bounds.south + bounds.north) / 2 : 37.34;
    const centerLng = bounds ? (bounds.west + bounds.east) / 2 : 127.92;

    const sorted = inViewport.slice().sort((a, b) => {
        const aSelected = a.slug === selectedSlug ? 1 : 0;
        const bSelected = b.slug === selectedSlug ? 1 : 0;
        if (aSelected !== bSelected) return bSelected - aSelected;

        const aPinned = a.pinned ? 1 : 0;
        const bPinned = b.pinned ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;

        const distA = (a.lat - centerLat) ** 2 + (a.lng - centerLng) ** 2;
        const distB = (b.lat - centerLat) ** 2 + (b.lng - centerLng) ** 2;
        return distA - distB;
    });

    return {visiblePins: sorted.slice(0, maxCount), displayMode};
}

function isInsideBufferedBounds(
    lat: number,
    lng: number,
    bounds: ViewportBoundsBox | null,
    padRatio: number,
): boolean {
    if (!bounds) return true;
    const lngSpan = Math.max(0.01, bounds.east - bounds.west);
    const latSpan = Math.max(0.01, bounds.north - bounds.south);
    const west = bounds.west - lngSpan * padRatio;
    const east = bounds.east + lngSpan * padRatio;
    const south = bounds.south - latSpan * padRatio;
    const north = bounds.north + latSpan * padRatio;
    return lng >= west && lng <= east && lat >= south && lat <= north;
}

export interface ScreenBoxInput {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    priority: number;
}

export interface FixedObstacleBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface Rect {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

const PIN_STEM_HEIGHT = 10;
const BOX_MARGIN = 6;

const CANDIDATE_OFFSETS: ReadonlyArray<{dx: number; dy: number}> = [
    {dx: 0, dy: 0},
    {dx: 0, dy: -62},
    {dx: -116, dy: -32},
    {dx: 116, dy: -32},
    {dx: -148, dy: 0},
    {dx: 148, dy: 0},
    {dx: 0, dy: 68},
    {dx: -116, dy: 46},
    {dx: 116, dy: 46},
    {dx: 0, dy: -122},
    {dx: -165, dy: -74},
    {dx: 165, dy: -74},
    {dx: -188, dy: 0},
    {dx: 188, dy: 0},
    {dx: 0, dy: 124},
];

function computeAnchoredPillRect(
    x: number,
    y: number,
    width: number,
    height: number,
    dx: number,
    dy: number,
): Rect {
    return {
        left: x + dx - width / 2,
        right: x + dx + width / 2,
        top: y + dy - PIN_STEM_HEIGHT - height,
        bottom: y + dy - PIN_STEM_HEIGHT,
    };
}

function computeOverlapArea(a: Rect, b: Rect, margin: number): number {
    const overlapW = Math.min(a.right + margin, b.right) - Math.max(a.left - margin, b.left);
    if (overlapW <= 0) return 0;
    const overlapH = Math.min(a.bottom + margin, b.bottom) - Math.max(a.top - margin, b.top);
    if (overlapH <= 0) return 0;
    return overlapW * overlapH;
}

/**
 * Dynamically assigns pixel offsets `(dx, dy)` to visible map pins so their pills do not overlap
 * each other or fixed map obstacles (e.g., timetable terminus pins).
 */
export function solvePinOverlapLayout(
    items: readonly ScreenBoxInput[],
    fixedObstacles: readonly FixedObstacleBox[] = [],
): Map<string, {dx: number; dy: number}> {
    const offsets = new Map<string, {dx: number; dy: number}>();
    if (items.length === 0) return offsets;

    const placed: Rect[] = fixedObstacles.map((obs) =>
        computeAnchoredPillRect(obs.x, obs.y, obs.width, obs.height, 0, 0),
    );

    const ordered = items.slice().sort((a, b) => b.priority - a.priority);

    for (const item of ordered) {
        let bestOffset = CANDIDATE_OFFSETS[0];
        let bestRect = computeAnchoredPillRect(
            item.x,
            item.y,
            item.width,
            item.height,
            bestOffset.dx,
            bestOffset.dy,
        );
        let bestScore = Infinity;

        for (const candidate of CANDIDATE_OFFSETS) {
            const rect = computeAnchoredPillRect(
                item.x,
                item.y,
                item.width,
                item.height,
                candidate.dx,
                candidate.dy,
            );
            let overlap = 0;
            for (const existing of placed) {
                overlap += computeOverlapArea(rect, existing, BOX_MARGIN);
            }

            if (overlap === 0) {
                bestOffset = candidate;
                bestRect = rect;
                break;
            }

            const distPenalty = Math.hypot(candidate.dx, candidate.dy) * 0.5;
            const score = overlap + distPenalty;
            if (score < bestScore) {
                bestScore = score;
                bestOffset = candidate;
                bestRect = rect;
            }
        }

        offsets.set(item.id, bestOffset);
        placed.push(bestRect);
    }

    return offsets;
}

/**
 * Estimates screen pill width/height in pixels from pin label text lengths.
 */
export function estimateWikiPinDimensions(
    title: string,
    tagLine: string,
    mode: "compact" | "full",
): {width: number; height: number} {
    const estimateTextPx = (text: string, charPx: number) => {
        let px = 0;
        for (const ch of text) {
            px += /[\u3131-\uD79D]/.test(ch) ? charPx : charPx * 0.62;
        }
        return px;
    };

    if (mode === "compact" || !tagLine) {
        const w = Math.min(182, Math.max(106, Math.ceil(estimateTextPx(title, 10.5)) + 48));
        return {width: w, height: 34};
    }

    const titleW = estimateTextPx(title, 10.5);
    const tagW = estimateTextPx(tagLine, 8.8);
    const w = Math.min(220, Math.max(122, Math.ceil(Math.max(titleW, tagW)) + 52));
    return {width: w, height: 46};
}
