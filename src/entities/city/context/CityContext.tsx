"use client";

import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from "react";
import type {CityInfo} from "../types";
import {DEFAULT_CITY, findNearestCity, getCityByCode, NATIONWIDE_CITIES} from "../cities";
import {STORAGE_KEYS} from "@shared/config/env";
import {useAppMapContext} from "@shared/context/AppMapContext";

// ----------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------

interface CityContextType {
    currentCity: CityInfo;
    setCity: (cityOrCode: CityInfo | string) => void;
    detectCurrentLocation: () => Promise<CityInfo | null>;
    isDetecting: boolean;
    availableCities: CityInfo[];
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
            const savedCode = localStorage.getItem(STORAGE_KEYS.CITY_CODE);
            if (savedCode) {
                return getCityByCode(savedCode);
            }
        } catch {
            // Ignore localStorage errors
        }
        return DEFAULT_CITY;
    });

    const [isDetecting, setIsDetecting] = useState(false);
    const {map} = useAppMapContext();

    const setCity = useCallback(
        (cityOrCode: CityInfo | string) => {
            const nextCity = typeof cityOrCode === "string" ? getCityByCode(cityOrCode) : cityOrCode;
            setCurrentCityState(nextCity);
            try {
                localStorage.setItem(STORAGE_KEYS.CITY_CODE, nextCity.code);
            } catch {
                // Ignore storage failure
            }

            // Animate map to the city center
            if (map) {
                map.flyTo({
                    center: [nextCity.lng, nextCity.lat],
                    zoom: nextCity.zoom,
                    duration: 1200,
                    essential: true,
                });
            }
        },
        [map]
    );

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
        }),
        [currentCity, setCity, detectCurrentLocation, isDetecting]
    );

    return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
}
