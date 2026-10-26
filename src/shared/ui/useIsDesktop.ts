import {useSyncExternalStore} from "react";

export const subscribeDesktop = (onStoreChange: () => void) => {
    if (typeof window === "undefined") {
        return () => {
        };
    }
    window.addEventListener("resize", onStoreChange);
    return () => window.removeEventListener("resize", onStoreChange);
};

export const getDesktopSnapshot = () => {
    if (typeof window === "undefined") return false;
    return window.innerWidth >= 768;
};

export const getServerDesktopSnapshot = () => false;

export function useIsDesktop(): boolean {
    return useSyncExternalStore(subscribeDesktop, getDesktopSnapshot, getServerDesktopSnapshot);
}
