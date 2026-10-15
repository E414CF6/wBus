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
    const [currentCity, setCurrentCityState] = useState<CityInfo>(() => {
        if (typeof window === "undefined") return DEFAULT_CITY;
        try {
            const params = new URLSearchParams(window.location.search);
            const queryCity = params.get("cityCode") || params.get("city");
            if (queryCity) {
                const found = getCityByCode(queryCity);
                if (found) return found;
            }

            const savedCode = localStorage.getItem(STORAGE_KEYS.CITY_CODE);
            if (savedCode) {
                return getCityByCode(savedCode);
            }
        } catch {
            // Ignore localStorage errors
        }
        return DEFAULT_CITY;
    });

    const currentCityRef = useRef<CityInfo>(currentCity);
    currentCityRef.current = currentCity;

    const [isAutoDetectEnabled, setIsAutoDetectEnabledState] = useState<boolean>(() => {
        if (typeof window === "undefined") return true;
        try {
            const saved = localStorage.getItem(STORAGE_KEYS.CITY_AUTO_DETECT);
            if (saved !== null) {
                return saved !== "false";
            }
        } catch {
            // Ignore
        }
        return true;
    });

    const setIsAutoDetectEnabled = useCallback((enabled: boolean) => {
        setIsAutoDetectEnabledState(enabled);
        try {
            localStorage.setItem(STORAGE_KEYS.CITY_AUTO_DETECT, String(enabled));
        } catch {
            // Ignore
        }
    }, []);

    const [isDetecting, setIsDetecting] = useState(false);
    const isFlyingRef = useRef(false);
    const {map} = useAppMapContext();

    const setCity = useCallback(
        (cityOrCode: CityInfo | string, options?: SetCityOptions) => {
            const nextCity = typeof cityOrCode === "string" ? getCityByCode(cityOrCode) : cityOrCode;
            if (nextCity.code === currentCityRef.current.code) {
                return; // Early return: already active city
            }
            currentCityRef.current = nextCity;
            setCurrentCityState(nextCity);

            try {
                localStorage.setItem(STORAGE_KEYS.CITY_CODE, nextCity.code);
            } catch {
                // Ignore storage failure
            }

            // Animate map to the city center unless skipFlyTo is set
            if (map && !options?.skipFlyTo) {
                isFlyingRef.current = true;
                map.flyTo({
                    center: [nextCity.lng, nextCity.lat],
                    zoom: nextCity.zoom,
                    duration: 1200,
                    essential: true,
                });
                setTimeout(() => {
                    isFlyingRef.current = false;
                }, 1300);
            }
        },
        [map]
    );

    const handleViewportChange = useCallback(
        (lat: number, lng: number, zoom: number): CityInfo | null => {
            if (!isAutoDetectEnabled || isFlyingRef.current) return null;
            // When zoomed out too far (e.g. country view), avoid rapid switching
            if (zoom < 7.2) return null;

            const {city, distanceKm} = findNearestCityWithDistance(lat, lng);
            // If the viewport center is too far from any city center (e.g. open ocean), skip
            if (distanceKm > 75) return null;

            if (city.code !== currentCityRef.current.code) {
                setCity(city, {skipFlyTo: true});
                return city;
            }
            return null;
        },
        [isAutoDetectEnabled, setCity]
    );

    // Sync with browser back/forward buttons when city changes in URL
    useEffect(() => {
        const handlePopState = () => {
            if (typeof window === "undefined") return;
            const params = new URLSearchParams(window.location.search);
            const queryCity = params.get("cityCode") || params.get("city");
            if (queryCity && queryCity !== currentCityRef.current.code) {
                setCity(queryCity, {skipFlyTo: true});
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

