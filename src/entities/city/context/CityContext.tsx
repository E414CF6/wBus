"use client";

import React, {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState} from "react";
import type {CityInfo} from "../types";
import {DEFAULT_CITY, findNearestCity, findNearestCityWithDistance, getCityByCode, NATIONWIDE_CITIES} from "../cities";
import {STORAGE_KEYS} from "@shared/config/env";
import {useAppMapContext} from "@shared/context/AppMapContext";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

interface SetCityOptions {
    skipFlyTo?: boolean;
}

interface CityContextType {
    currentCity: CityInfo;
    detectedCity: CityInfo | null;
    confirmDetectedCity: () => void;
    dismissDetectedCity: () => void;
    setCity: (cityOrCode: CityInfo | string, options?: SetCityOptions) => void;
    detectCurrentLocation: () => Promise<CityInfo | null>;
    isDetecting: boolean;
    availableCities: CityInfo[];
    isAutoDetectEnabled: boolean;
    setIsAutoDetectEnabled: (enabled: boolean) => void;
    handleViewportChange: (lat: number, lng: number, zoom: number) => CityInfo | null;
}

interface CityContextProviderProps {
    children: React.ReactNode;
}

// ----------------------------------------------------------------------
// Context
// ----------------------------------------------------------------------

const CityContext = createContext<CityContextType | undefined>(undefined);

export function useCityContext(): CityContextType {
    const context = useContext(CityContext);
    if (!context) {
        throw new Error("[useCityContext] Must be used within a <CityContextProvider>.");
    }
    return context;
}

// ----------------------------------------------------------------------
// Provider
// ----------------------------------------------------------------------

export function CityContextProvider({children}: CityContextProviderProps) {
    const [currentCity, setCurrentCityState] = useState<CityInfo>(DEFAULT_CITY);
    const [detectedCity, setDetectedCity] = useState<CityInfo | null>(null);

    const currentCityRef = useRef<CityInfo>(currentCity);
    useEffect(() => {
        currentCityRef.current = currentCity;
    }, [currentCity]);

    const [isAutoDetectEnabled, setIsAutoDetectEnabledState] = useState<boolean>(true);

    const setIsAutoDetectEnabled = useCallback((enabled: boolean) => {
        setIsAutoDetectEnabledState(enabled);
        if (!enabled) {
            setDetectedCity(null);
        }
        try {
            localStorage.setItem(STORAGE_KEYS.CITY_AUTO_DETECT, String(enabled));
        } catch {
            // Ignore
        }
    }, []);

    // Restore saved city and preferences on initial mount without triggering SSR hydration mismatch
    useEffect(() => {
        const frameId = requestAnimationFrame(() => {
            try {
                const savedAuto = localStorage.getItem(STORAGE_KEYS.CITY_AUTO_DETECT);
                if (savedAuto !== null) {
                    setIsAutoDetectEnabledState(savedAuto !== "false");
                }

                const params = new URLSearchParams(window.location.search);
                const queryCity = params.get("cityCode") || params.get("city");
                if (queryCity) {
                    const found = getCityByCode(queryCity);
                    if (found && found.code !== currentCityRef.current.code) {
                        currentCityRef.current = found;
                        setCurrentCityState(found);
                        return;
                    }
                }

                const savedCode = localStorage.getItem(STORAGE_KEYS.CITY_CODE);
                if (savedCode) {
                    const found = getCityByCode(savedCode);
                    if (found && found.code !== currentCityRef.current.code) {
                        currentCityRef.current = found;
                        setCurrentCityState(found);
                    }
                }
            } catch {
                // Ignore localStorage errors
            }
        });
        return () => cancelAnimationFrame(frameId);
    }, []);

    const [isDetecting, setIsDetecting] = useState(false);
    const isFlyingRef = useRef(false);
    const flyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const {map} = useAppMapContext();

    useEffect(() => {
        return () => {
            if (flyTimeoutRef.current) {
                clearTimeout(flyTimeoutRef.current);
            }
        };
    }, []);

    const setCity = useCallback(
        (cityOrCode: CityInfo | string, options?: SetCityOptions) => {
            const nextCity = typeof cityOrCode === "string" ? getCityByCode(cityOrCode) : cityOrCode;
            setDetectedCity(null);
            if (nextCity.code === currentCityRef.current.code) {
                if (map && !options?.skipFlyTo) {
                    map.flyTo({
                        center: [nextCity.lng, nextCity.lat],
                        zoom: nextCity.zoom,
                        duration: 1200,
                        essential: true,
                    });
                }
                return;
            }
            currentCityRef.current = nextCity;
            setCurrentCityState(nextCity);

            try {
                localStorage.setItem(STORAGE_KEYS.CITY_CODE, nextCity.code);
            } catch {
                // Ignore storage failure
            }

            if (typeof window !== "undefined") {
                try {
                    const url = new URL(window.location.href);
                    if (url.searchParams.get("cityCode") !== nextCity.code) {
                        url.searchParams.set("cityCode", nextCity.code);
                        url.searchParams.delete("city");
                        url.searchParams.delete("route");
                        window.history.replaceState(null, "", `${url.pathname}${url.search}`);
                    }
                } catch {
                    // Ignore URL update failure
                }
            }

            // Animate map to the city center unless skipFlyTo is set
            if (map && !options?.skipFlyTo) {
                if (flyTimeoutRef.current) {
                    clearTimeout(flyTimeoutRef.current);
                }
                isFlyingRef.current = true;
                map.flyTo({
                    center: [nextCity.lng, nextCity.lat],
                    zoom: nextCity.zoom,
                    duration: 1200,
                    essential: true,
                });
                flyTimeoutRef.current = setTimeout(() => {
                    isFlyingRef.current = false;
                    flyTimeoutRef.current = null;
                }, 1300);
            }
        },
        [map]
    );

    const confirmDetectedCity = useCallback(() => {
        if (!detectedCity) return;
        setCity(detectedCity, {skipFlyTo: true});
    }, [detectedCity, setCity]);

    const dismissDetectedCity = useCallback(() => {
        setDetectedCity(null);
    }, []);

    const handleViewportChange = useCallback(
        (lat: number, lng: number, zoom: number): CityInfo | null => {
            if (!isAutoDetectEnabled || isFlyingRef.current) return null;
            // When zoomed out too far (e.g. country view), avoid rapid detection
            if (zoom < 7.2) {
                setDetectedCity(null);
                return null;
            }

            const {city, distanceKm} = findNearestCityWithDistance(lat, lng);
            // If the viewport center is too far from any city center (e.g. open ocean), skip
            if (distanceKm > 75) {
                setDetectedCity(null);
                return null;
            }

            if (city.code !== currentCityRef.current.code) {
                setDetectedCity((prev) => (prev?.code === city.code ? prev : city));
                return city;
            } else {
                setDetectedCity(null);
                return null;
            }
        },
        [isAutoDetectEnabled]
    );

    // Sync with browser back/forward buttons when city changes in URL
    useEffect(() => {
        const handlePopState = () => {
            if (typeof window === "undefined") return;
            const params = new URLSearchParams(window.location.search);
            const queryCity = params.get("cityCode") || params.get("city");
            if (queryCity && queryCity !== currentCityRef.current.code) {
                const found = getCityByCode(queryCity);
                if (found && found.code !== currentCityRef.current.code) {
                    setCity(found, {skipFlyTo: true});
                }
            }
        };
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [setCity]);

    const detectCurrentLocation = useCallback(async (): Promise<CityInfo | null> => {
        if (typeof window === "undefined" || !("geolocation" in navigator)) {
            return null;
        }

        setIsDetecting(true);
        return new Promise<CityInfo | null>((resolve) => {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const {latitude, longitude} = position.coords;
                    const nearest = findNearestCity(latitude, longitude);
                    setCity(nearest);
                    setIsDetecting(false);
                    resolve(nearest);
                },
                (err) => {
                    console.warn("[CityContext] Geolocation failed:", err);
                    setIsDetecting(false);
                    resolve(null);
                },
                {timeout: 10000, enableHighAccuracy: true}
            );
        });
    }, [setCity]);

    const value = useMemo(
        () => ({
            currentCity,
            detectedCity,
            confirmDetectedCity,
            dismissDetectedCity,
            setCity,
            detectCurrentLocation,
            isDetecting,
            availableCities: NATIONWIDE_CITIES,
            isAutoDetectEnabled,
            setIsAutoDetectEnabled,
            handleViewportChange,
        }),
        [
            currentCity,
            detectedCity,
            confirmDetectedCity,
            dismissDetectedCity,
            setCity,
            detectCurrentLocation,
            isDetecting,
            isAutoDetectEnabled,
            setIsAutoDetectEnabled,
            handleViewportChange,
        ]
    );

    return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}


