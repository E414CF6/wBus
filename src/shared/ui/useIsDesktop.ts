import {useSyncExternalStore} from "react";

const DESKTOP_MEDIA_QUERY = "(min-width: 1024px)";
const COARSE_POINTER_MEDIA_QUERY = "(hover: none) and (pointer: coarse)";

const subscribeMediaQuery = (query: string, onStoreChange: () => void) => {
    if (typeof window === "undefined") {
        return () => {
        };
    }

    window.addEventListener("resize", onStoreChange);
    const mql = typeof window.matchMedia === "function" ? window.matchMedia(query) : null;
    if (mql?.addEventListener) {
        mql.addEventListener("change", onStoreChange);
    }

    return () => {
        window.removeEventListener("resize", onStoreChange);
        if (mql?.removeEventListener) {
            mql.removeEventListener("change", onStoreChange);
        }
    };
};

export const subscribeDesktop = (onStoreChange: () => void) => {
    return subscribeMediaQuery(DESKTOP_MEDIA_QUERY, onStoreChange);
};

export const isDesktopViewport = () => {
    if (typeof window === "undefined") return false;
    if (typeof window.matchMedia === "function") {
        const mql = window.matchMedia(DESKTOP_MEDIA_QUERY);
        if (mql && typeof mql.matches === "boolean") {
            return mql.matches;
        }
    }
    return window.innerWidth >= 1024;
};

export const getDesktopSnapshot = () => {
    return isDesktopViewport();
};

export const getServerDesktopSnapshot = () => false;

/**
 * Matches Tailwind `lg:` (`min-width: 1024px`) so JS layout branches never diverge from CSS.
 */
export function useIsDesktop(): boolean {
    return useSyncExternalStore(subscribeDesktop, getDesktopSnapshot, getServerDesktopSnapshot);
}

export const subscribeCoarsePointer = (onStoreChange: () => void) => {
    return subscribeMediaQuery(COARSE_POINTER_MEDIA_QUERY, onStoreChange);
};

export const isCoarsePointerDevice = () => {
    if (typeof window === "undefined") return false;
    if (typeof window.matchMedia === "function") {
        const mql = window.matchMedia(COARSE_POINTER_MEDIA_QUERY);
        if (mql && typeof mql.matches === "boolean") {
            return mql.matches;
        }
    }
    return false;
};

export const getCoarsePointerSnapshot = () => {
    return isCoarsePointerDevice();
};

export const getServerCoarsePointerSnapshot = () => false;

/**
 * Detects touch-primary devices (coarse pointer / no hover) independently of viewport width.
 */
export function useIsCoarsePointer(): boolean {
    return useSyncExternalStore(
        subscribeCoarsePointer,
        getCoarsePointerSnapshot,
        getServerCoarsePointerSnapshot
    );
}
