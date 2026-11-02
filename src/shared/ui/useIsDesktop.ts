import {useSyncExternalStore} from "react";

export const subscribeDesktop = (onStoreChange: () => void) => {
    if (typeof window === "undefined") {
        return () => {
        };
    }
    window.addEventListener("resize", onStoreChange);
    return () => window.removeEventListener("resize", onStoreChange);
};

export const isDesktopViewport = () => {
    if (typeof window === "undefined") return false;
    if (typeof window.matchMedia === "function") {
        return window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine)").matches;
    }
    return window.innerWidth >= 1024;
};

export const getDesktopSnapshot = () => {
    return isDesktopViewport();
};

export const getServerDesktopSnapshot = () => false;

export function useIsDesktop(): boolean {
    return useSyncExternalStore(subscribeDesktop, getDesktopSnapshot, getServerDesktopSnapshot);
}
