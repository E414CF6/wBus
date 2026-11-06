"use client";

import React, {useEffect, useRef, useState} from "react";

export interface MarqueeTextProps {
    text: string;
    className?: string;
    containerClassName?: string;
    durationSeconds?: number;
    fadeEdges?: boolean;
}

/**
 * A text component that continuously and smoothly scrolls (marquee) horizontally
 * only when the content overflows its container. If it fits, it remains static.
 */
export const MarqueeText: React.FC<MarqueeTextProps> = ({
                                                            text,
                                                            className = "",
                                                            containerClassName = "",
                                                            durationSeconds = 14,
                                                            fadeEdges = true,
                                                        }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const measureRef = useRef<HTMLSpanElement>(null);
    const [isOverflowing, setIsOverflowing] = useState(false);

    useEffect(() => {
        const container = containerRef.current;
        const measure = measureRef.current;
        if (!container || !measure) return;

        const checkOverflow = () => {
            const hasOverflow = measure.scrollWidth > container.clientWidth + 1;
            setIsOverflowing(hasOverflow);
        };

        checkOverflow();

        if (typeof ResizeObserver !== "undefined") {
            const observer = new ResizeObserver(checkOverflow);
            observer.observe(container);
            return () => observer.disconnect();
        }
    }, [text]);

    return (
        <div
            ref={containerRef}
            className={`overflow-hidden relative min-w-0 ${
                isOverflowing && fadeEdges
                    ? "[mask-image:linear-gradient(to_right,transparent,black_8px,black_calc(100%-8px),transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_8px,black_calc(100%-8px),transparent)]"
                    : ""
            } ${containerClassName}`}
        >
            {/* Measuring element (hidden when overflowing so it does not affect layout) */}
            <span
                ref={measureRef}
                className={`whitespace-nowrap ${
                    isOverflowing
                        ? "absolute opacity-0 pointer-events-none -z-50"
                        : "inline-block"
                } ${className}`}
                aria-hidden={isOverflowing}
            >
                {text}
            </span>

            {/* Seamless marquee track when overflowing */}
            {isOverflowing && (
                <div
                    className="flex items-center whitespace-nowrap will-change-transform hover:[animation-play-state:paused]"
                    style={{
                        width: "max-content",
                        animation: `marquee ${durationSeconds}s linear infinite`,
                    }}
                >
                    <span className={`pr-8 shrink-0 ${className}`}>
                        {text}
                    </span>
                    <span className={`pr-8 shrink-0 ${className}`} aria-hidden="true">
                        {text}
                    </span>
                </div>
            )}
        </div>
    );
};

export type PopupMarqueeProps = {
    text: string;
    maxWidthClass?: string;
};

/**
 * Backward compatibility component for BusMarker popup labels
 */
export const PopupMarquee: React.FC<PopupMarqueeProps> = ({
                                                              text,
                                                              maxWidthClass = "max-w-full",
                                                          }) => {
    return (
        <MarqueeText
            text={text}
            containerClassName={maxWidthClass}
            durationSeconds={6}
            fadeEdges={false}
            className="font-medium"
        />
    );
};

export default PopupMarquee;
