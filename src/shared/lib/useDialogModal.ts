"use client";

import {type RefObject, useEffect} from "react";

/**
 * Syncs a native <dialog> element's modal state with `isOpen` and adds a
 * pointer-based light-dismiss fallback for browsers without `closedby="any"`.
 */
export function useDialogModal(
    dialogRef: RefObject<HTMLDialogElement | null>,
    isOpen: boolean,
    onOpen?: () => void
) {
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;

        if (isOpen) {
            if (!dialog.open) {
                dialog.showModal();
            }
            onOpen?.();
        } else if (dialog.open) {
            dialog.close();
        }
    }, [dialogRef, isOpen, onOpen]);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog || "closedBy" in HTMLDialogElement.prototype) return;

        const isOutside = (e: PointerEvent) => {
            const r = dialog.getBoundingClientRect();
            return (
                e.clientX < r.left ||
                e.clientX > r.right ||
                e.clientY < r.top ||
                e.clientY > r.bottom
            );
        };

        let pressedOutside = false;
        const onPointerDown = (e: PointerEvent) => {
            pressedOutside = isOutside(e);
        };
        const onPointerUp = (e: PointerEvent) => {
            if (pressedOutside && isOutside(e)) {
                dialog.close();
            }
            pressedOutside = false;
        };

        dialog.addEventListener("pointerdown", onPointerDown);
        dialog.addEventListener("pointerup", onPointerUp);
        return () => {
            dialog.removeEventListener("pointerdown", onPointerDown);
            dialog.removeEventListener("pointerup", onPointerUp);
        };
    }, [dialogRef]);
}
