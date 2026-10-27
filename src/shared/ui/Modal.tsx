"use client";

import React, {useCallback, useEffect, useRef, useSyncExternalStore} from "react";
import {createPortal} from "react-dom";
import {X} from "lucide-react";
import {useBodyScrollLock} from "./useBodyScrollLock";

export type ModalMaxWidth = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "full";
export type ModalHeight = "default" | "tall" | "auto" | "full";

const MAX_WIDTH_CLASSES: Record<ModalMaxWidth, string> = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg lg:max-w-xl",
    xl: "max-w-xl lg:max-w-3xl",
    "2xl": "max-w-2xl lg:max-w-4xl xl:max-w-5xl",
    "3xl": "max-w-3xl lg:max-w-5xl xl:max-w-6xl",
    full: "max-w-[calc(100vw-1.5rem)] sm:max-w-5xl lg:max-w-6xl",
};

const HEIGHT_CLASSES: Record<ModalHeight, string> = {
    default: "h-[78dvh] sm:h-[82dvh] max-h-[78dvh] sm:max-h-[82dvh]",
    tall: "h-[85dvh] sm:h-[88dvh] max-h-[780px] sm:max-h-[820px]",
    auto: "h-auto max-h-[85dvh]",
    full: "h-[92dvh] max-h-[92dvh]",
};

export interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: React.ReactNode;
    subtitle?: React.ReactNode;
    icon?: React.ReactNode;
    headerBadge?: React.ReactNode;
    headerLeading?: React.ReactNode;
    headerActions?: React.ReactNode;
    footer?: React.ReactNode;
    maxWidth?: ModalMaxWidth;
    height?: ModalHeight;
    className?: string;
    bodyClassName?: string;
    headerClassName?: string;
    footerClassName?: string;
    closeOnBackdropClick?: boolean;
    closeOnEscape?: boolean;
    hideCloseButton?: boolean;
    zIndex?: string;
    ariaLabel?: string;
    ariaLabelledby?: string;
    children?: React.ReactNode;

    /**
     * URL 쿼리스트링 파라미터를 활용한 모달 히스토리 관리 (모바일 뒤로가기 사이트 이탈 방지)
     * 예: "city", "route", "schedule", "notice"
     */
    modalId?: string;
    /**
     * 쿼리스트링 파라미터 키 (기본: "modal")
     */
    queryKey?: string;
    /**
     * 뒤로가기(popstate) 히스토리 연동 활성화 여부 (기본: true)
     */
    enableHistory?: boolean;
}

const emptySubscribe = () => () => {};

export function Modal({
    isOpen,
    onClose,
    title,
    subtitle,
    icon,
    headerBadge,
    headerLeading,
    headerActions,
    footer,
    maxWidth = "2xl",
    height = "default",
    className = "",
    bodyClassName = "",
    headerClassName = "",
    footerClassName = "",
    closeOnBackdropClick = true,
    closeOnEscape = true,
    hideCloseButton = false,
    zIndex = "z-[100]",
    ariaLabel,
    ariaLabelledby,
    modalId,
    queryKey = "modal",
    enableHistory = true,
    children,
}: ModalProps) {
    const isClient = useSyncExternalStore(emptySubscribe, () => true, () => false);

    useBodyScrollLock(isOpen);

    // Track whether this modal pushed a history entry, and if popstate caused closing
    const hasPushedHistoryRef = useRef(false);
    const isPopstateClosingRef = useRef(false);

    // Synchronize History & Query String to prevent site exit on mobile back button
    useEffect(() => {
        if (!isOpen || !enableHistory || !isClient) return;

        const key = queryKey;
        const value = modalId || "open";

        try {
            const currentUrl = new URL(window.location.href);
            const currentVal = currentUrl.searchParams.get(key);

            // If current URL does not already have this modal parameter, push state
            if (currentVal !== value) {
                currentUrl.searchParams.set(key, value);
                window.history.pushState(
                    {modalId: value, isWbusModal: true},
                    "",
                    currentUrl.pathname + currentUrl.search + currentUrl.hash
                );
                hasPushedHistoryRef.current = true;
            }
        } catch {
            // Ignore in restricted environments
        }

        const handlePopState = () => {
            try {
                const nextUrl = new URL(window.location.href);
                const nextVal = nextUrl.searchParams.get(key);
                if (nextVal !== value) {
                    // Mobile or browser back button was pressed
                    isPopstateClosingRef.current = true;
                    hasPushedHistoryRef.current = false;
                    onClose();
                }
            } catch {
                isPopstateClosingRef.current = true;
                hasPushedHistoryRef.current = false;
                onClose();
            }
        };

        window.addEventListener("popstate", handlePopState);
        return () => {
            window.removeEventListener("popstate", handlePopState);
        };
    }, [isOpen, enableHistory, isClient, modalId, queryKey, onClose]);

    // Handle modal closure triggered via UI (Close Button, Backdrop click, ESC key)
    useEffect(() => {
        if (!isOpen) {
            if (hasPushedHistoryRef.current && !isPopstateClosingRef.current) {
                hasPushedHistoryRef.current = false;
                try {
                    // Revert the history entry pushed when opening this modal
                    window.history.back();
                } catch {
                    // Ignore
                }
            }
            isPopstateClosingRef.current = false;
        } else {
            isPopstateClosingRef.current = false;
        }
    }, [isOpen]);

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (closeOnEscape && e.key === "Escape") {
                onClose();
            }
        },
        [closeOnEscape, onClose]
    );

    useEffect(() => {
        if (!isOpen) return;
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, handleKeyDown]);

    if (!isOpen || !isClient) return null;

    const hasHeader = Boolean(title || icon || headerLeading || headerActions || !hideCloseButton);

    const modalContent = (
        <div
            className={`fixed inset-0 ${zIndex} flex items-center justify-center p-3.5 sm:p-4 select-none pointer-events-auto`}
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledby}
        >
            {/* Backdrop Blur Overlay */}
            <div
                className="fixed inset-0 bg-black/60 dark:bg-black/75 backdrop-blur-md transition-opacity duration-200 animate-fadeIn"
                onClick={closeOnBackdropClick ? onClose : undefined}
                aria-hidden="true"
            />

            {/* Modal Dialog Container */}
            <div
                className={`
                    relative flex flex-col w-full ${MAX_WIDTH_CLASSES[maxWidth]} ${HEIGHT_CLASSES[height]}
                    bg-white/95 dark:bg-[#11131a]/95 backdrop-blur-3xl
                    border border-black/10 dark:border-white/10
                    shadow-[0_24px_70px_rgba(0,0,0,0.35)] dark:shadow-[0_24px_70px_rgba(0,0,0,0.85)]
                    rounded-[28px] sm:rounded-[32px] overflow-hidden z-10
                    transition-all duration-200 transform animate-scaleUp
                    ${className}
                `}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                {hasHeader && (
                    <div
                        className={`flex items-center justify-between px-4 sm:px-6 pt-3.5 pb-3 border-b border-black/5 dark:border-white/5 bg-slate-50/70 dark:bg-white/[0.02] shrink-0 ${headerClassName}`}
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            {headerLeading}
                            {!headerLeading && icon && (
                                <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl shrink-0">
                                    {icon}
                                </div>
                            )}
                            <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    {typeof title === "string" ? (
                                        <h2
                                            id={ariaLabelledby}
                                            className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate"
                                        >
                                            {title}
                                        </h2>
                                    ) : (
                                        title
                                    )}
                                    {headerBadge}
                                </div>
                                {subtitle && (
                                    <div className="text-[11px] sm:text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                        {subtitle}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                            {headerActions}
                            {!hideCloseButton && (
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="p-2 rounded-full text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/10 transition-colors cursor-pointer"
                                    aria-label="닫기"
                                >
                                    <X className="w-5 h-5"/>
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Body Area */}
                <div className={`relative flex-1 min-h-0 overflow-hidden flex flex-col ${bodyClassName}`}>
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div
                        className={`px-4 sm:px-6 py-3 border-t border-black/5 dark:border-white/5 bg-black/[0.02] dark:bg-white/[0.02] flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0 ${footerClassName}`}
                    >
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}

export default Modal;
