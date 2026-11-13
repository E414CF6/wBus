"use client";

import React, {createContext, useCallback, useContext, useEffect, useMemo, useState} from "react";
import {
    type AppSettings,
    clearSettingsCookie,
    DEFAULT_APP_SETTINGS,
    readSettingsFromBrowser,
    writeSettingsToBrowser,
} from "@shared/config/settingsCookie";
import {setGlobalBusPollingIntervalMs} from "@features/live-tracking/lib/BusLocationStore";
import {setHapticEnabled} from "@shared/utils/haptics";

interface AppSettingsContextValue {
    settings: AppSettings;
    hasLoadedSettings: boolean;
    isOnboardingOpen: boolean;
    openOnboarding: () => void;
    closeOnboarding: () => void;
    updateSettings: (patch: Partial<AppSettings>) => void;
    resetSettings: () => void;
    clearApiCache: () => void;
    clearAllAppData: () => void;
}

const DEFAULT_CONTEXT_VALUE: AppSettingsContextValue = {
    settings: DEFAULT_APP_SETTINGS,
    hasLoadedSettings: false,
    isOnboardingOpen: false,
    openOnboarding: () => undefined,
    closeOnboarding: () => undefined,
    updateSettings: () => undefined,
    resetSettings: () => undefined,
    clearApiCache: () => undefined,
    clearAllAppData: () => undefined,
};

const AppSettingsContext = createContext<AppSettingsContextValue>(DEFAULT_CONTEXT_VALUE);

export function AppSettingsProvider({children}: { children: React.ReactNode }) {
    const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS);
    const [hasLoadedSettings, setHasLoadedSettings] = useState(false);
    const [isOnboardingOpen, setIsOnboardingOpen] = useState(false);

    useEffect(() => {
        const frameId = requestAnimationFrame(() => {
            const loaded = readSettingsFromBrowser();
            setHapticEnabled(loaded.hapticEnabled);
            setGlobalBusPollingIntervalMs(loaded.livePollingIntervalMs);
            setSettings(loaded);
            setHasLoadedSettings(true);
            if (!loaded.hasCompletedOnboarding) {
                setIsOnboardingOpen(true);
            }
        });
        return () => cancelAnimationFrame(frameId);
    }, []);

    useEffect(() => {
        if (!hasLoadedSettings) return;
        setGlobalBusPollingIntervalMs(settings.livePollingIntervalMs);
    }, [hasLoadedSettings, settings.livePollingIntervalMs]);

    useEffect(() => {
        if (!hasLoadedSettings || typeof document === "undefined") return;
        document.documentElement.classList.toggle("reduce-motion", settings.reduceMotion);
        document.documentElement.style.fontSize = settings.fontScale === "large" ? "17.5px" : "";
    }, [hasLoadedSettings, settings.reduceMotion, settings.fontScale]);

    const openOnboarding = useCallback(() => {
        setIsOnboardingOpen(true);
    }, []);

    const closeOnboarding = useCallback(() => {
        setIsOnboardingOpen(false);
        setSettings((prev) => {
            if (prev.hasCompletedOnboarding) return prev;
            const next: AppSettings = {
                ...prev,
                hasCompletedOnboarding: true,
            };
            writeSettingsToBrowser(next);
            return next;
        });
    }, []);

    const updateSettings = useCallback((patch: Partial<AppSettings>) => {
        setSettings((prev) => {
            const next: AppSettings = {
                ...prev,
                ...patch,
            };
            writeSettingsToBrowser(next);
            return next;
        });
    }, []);

    const resetSettings = useCallback(() => {
        const next: AppSettings = {
            ...DEFAULT_APP_SETTINGS,
            hasCompletedOnboarding: true,
        };
        setSettings(next);
        writeSettingsToBrowser(next);
    }, []);

    const clearApiCache = useCallback(() => {
        if (typeof window !== "undefined") {
            try {
                const keysToRemove: string[] = [];
                for (let i = 0; i < window.localStorage.length; i++) {
                    const key = window.localStorage.key(i);
                    if (
                        key &&
                        (key.startsWith("wbus_cached_") || key.startsWith("wbus_cache_"))
                    ) {
                        keysToRemove.push(key);
                    }
                }
                for (const key of keysToRemove) {
                    window.localStorage.removeItem(key);
                }
            } catch {
                // Ignore localStorage failure
            }
        }
    }, []);

    const clearAllAppData = useCallback(() => {
        clearSettingsCookie();
        if (typeof window !== "undefined") {
            try {
                const keysToRemove: string[] = [];
                for (let i = 0; i < window.localStorage.length; i++) {
                    const key = window.localStorage.key(i);
                    if (
                        key &&
                        (key.startsWith("wbus_") || key === "wonju_bus_bookmarks")
                    ) {
                        keysToRemove.push(key);
                    }
                }
                for (const key of keysToRemove) {
                    window.localStorage.removeItem(key);
                }
            } catch {
                // Ignore localStorage failure
            }
        }
        const next = {...DEFAULT_APP_SETTINGS};
        setHapticEnabled(next.hapticEnabled);
        setSettings(next);
    }, []);

    const value = useMemo<AppSettingsContextValue>(
        () => ({
            settings,
            hasLoadedSettings,
            isOnboardingOpen,
            openOnboarding,
            closeOnboarding,
            updateSettings,
            resetSettings,
            clearApiCache,
            clearAllAppData,
        }),
        [
            settings,
            hasLoadedSettings,
            isOnboardingOpen,
            openOnboarding,
            closeOnboarding,
            updateSettings,
            resetSettings,
            clearApiCache,
            clearAllAppData,
        ]
    );

    return (
        <AppSettingsContext.Provider value={value}>
            {children}
        </AppSettingsContext.Provider>
    );
}

export function useAppSettings(): AppSettingsContextValue {
    return useContext(AppSettingsContext);
}
