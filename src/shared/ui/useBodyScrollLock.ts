"use client";

import {useEffect} from "react";

/**
 * Directly locks document body scroll and returns a cleanup restore function.
 * Safe for server-side environments where document is not defined.
 */
export function lockBodyScroll(): () => void {
    if (typeof document === "undefined" || !document.body) {
        return () => {};
    }
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
        document.body.style.overflow = originalOverflow;
    };
}

/**
 * Custom hook to lock body scrolling when a modal or drawer is open.
 * Automatically restores original overflow style on unmount or when isLocked becomes false.
 */
export function useBodyScrollLock(isLocked: boolean): void {
    useEffect(() => {
        if (!isLocked) return;
        return lockBodyScroll();
    }, [isLocked]);
}
