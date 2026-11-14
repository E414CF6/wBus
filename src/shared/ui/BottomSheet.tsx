"use client";

import React, {useCallback, useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {useBodyScrollLock} from "./useBodyScrollLock";
import {useModalHistory} from "./useModalHistory";

export interface UseBottomSheetDragOptions {
    isOpen: boolean;
    onClose: () => void;
    enabled?: boolean;
    distanceThreshold?: number;
    velocityThreshold?: number;
}

export function useBottomSheetDrag({
                                       isOpen,
                                       onClose,
                                       enabled = true,
                                       distanceThreshold = 80,
                                       velocityThreshold = 0.5,
                                   }: UseBottomSheetDragOptions) {
    const [dragOffsetY, setDragOffsetY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [shouldAnimateEnter, setShouldAnimateEnter] = useState(true);
    const dragStartRef = useRef<{ y: number; time: number } | null>(null);

    const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
    if (isOpen !== prevIsOpen) {
        setPrevIsOpen(isOpen);
        setDragOffsetY(0);
        setIsDragging(false);
        if (isOpen) {
            setShouldAnimateEnter(true);
        }
    }

    const handleTouchStart = useCallback(
        (e: React.TouchEvent) => {
            if (!enabled) return;
            dragStartRef.current = {y: e.touches[0].clientY, time: Date.now()};
            setShouldAnimateEnter(false);
            setIsDragging(true);
        },
        [enabled]
    );

    const handleTouchMove = useCallback(
        (e: React.TouchEvent) => {
            if (!enabled || !dragStartRef.current) return;
            const deltaY = e.touches[0].clientY - dragStartRef.current.y;
            if (deltaY > 0) {
                setDragOffsetY(deltaY);
            } else {
                setDragOffsetY(0);
            }
        },
        [enabled]
    );

    const handleTouchEnd = useCallback(
        (e: React.TouchEvent) => {
            if (!enabled || !dragStartRef.current) return;
            const deltaY = e.changedTouches[0].clientY - dragStartRef.current.y;
            const dt = Date.now() - dragStartRef.current.time;
            const velocity = dt > 0 ? deltaY / dt : 0;

            dragStartRef.current = null;
            setIsDragging(false);
            setDragOffsetY(0);

            if (deltaY > distanceThreshold || (deltaY > 24 && velocity > velocityThreshold)) {
                onClose();
            }
        },
        [enabled, distanceThreshold, velocityThreshold, onClose]
    );

    const handleAnimationEnd = useCallback(() => {
        setShouldAnimateEnter(false);
    }, []);

    return {
        dragOffsetY,
        isDragging,
        shouldAnimateEnter,
        dragHandlers: {
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd,
            onTouchCancel: handleTouchEnd,
        },
        handleAnimationEnd,
    };
}

export interface BottomSheetProps {
    isOpen: boolean;
    onClose: () => void;
    ariaLabel: string;
    modalId?: string;
    enableHistory?: boolean;
    zIndexClass?: string;
    backdropZIndexClass?: string;
    heightClassName?: string;
    className?: string;
    handleContent?: React.ReactNode;
    children: React.ReactNode;
    role?: "dialog" | "complementary";
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
                                                            isOpen,
                                                            onClose,
                                                            ariaLabel,
                                                            modalId,
                                                            enableHistory = true,
                                                            zIndexClass = "z-[60]",
                                                            backdropZIndexClass = "z-[55]",
                                                            heightClassName = "max-h-[82dvh]",
                                                            className = "",
                                                            handleContent,
                                                            children,
                                                            role = "dialog",
                                                        }) => {
    useBodyScrollLock(isOpen);
    useModalHistory({
        isOpen,
        onClose,
        modalId: modalId ?? "bottom-sheet",
        enableHistory,
    });

    const {
        dragOffsetY,
        isDragging,
        shouldAnimateEnter,
        dragHandlers,
        handleAnimationEnd,
    } = useBottomSheetDrag({isOpen, onClose, enabled: isOpen});

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (typeof document === "undefined" || !isOpen) return null;

    return createPortal(
        <>
            <div
                className={`fixed inset-0 ${backdropZIndexClass} bg-black/35 dark:bg-black/60 backdrop-blur-[1px] transition-opacity animate-fadeIn`}
                onClick={onClose}
                aria-hidden="true"
            />
            <div
                role={role}
                aria-modal={role === "dialog" ? "true" : undefined}
                aria-label={ariaLabel}
                onClick={(e) => e.stopPropagation()}
                onAnimationEnd={handleAnimationEnd}
                style={dragOffsetY > 0 ? {transform: `translateY(${dragOffsetY}px)`} : undefined}
                className={`fixed inset-x-0 bottom-0 ${zIndexClass} ${heightClassName} mx-auto w-full max-w-2xl bg-white dark:bg-[#11131a] rounded-t-[24px] shadow-[0_-12px_40px_rgba(0,0,0,0.22)] dark:shadow-[0_-12px_40px_rgba(0,0,0,0.7)] border-t border-x border-slate-200/70 dark:border-white/10 flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom,0px)] select-none ${
                    isDragging ? "transition-none" : "transition-transform duration-300 ease-out"
                } ${shouldAnimateEnter ? "animate-slideUp" : ""} ${className}`}
            >
                <div {...dragHandlers} className="touch-none shrink-0">
                    <div className="flex justify-center pt-2.5 pb-1 cursor-grab active:cursor-grabbing">
                        <div className="w-9 h-1 bg-slate-300/90 dark:bg-white/20 rounded-full"/>
                    </div>
                    {handleContent}
                </div>
                {children}
            </div>
        </>,
        document.body
    );
};

export default BottomSheet;
