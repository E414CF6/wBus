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
            className={`relative w-full min-w-0 overflow-hidden ${
                isOverflowing && fadeEdges
                    ? "[mask-image:linear-gradient(to_right,transparent,black_8px,black_calc(100%-8px),transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_8px,black_calc(100%-8px),transparent)]"
                    : ""
            } ${containerClassName}`}
        >
            {/* Keep measurement out of layout so overflow detection cannot resize the parent. */}
            <span
                ref={measureRef}
                className={`pointer-events-none absolute left-0 top-0 -z-50 whitespace-nowrap opacity-0 ${className}`}
                aria-hidden="true"
            >
                {text}
            </span>

            {!isOverflowing && (
                <span className={`inline-block max-w-full whitespace-nowrap ${className}`}>
                    {text}
                </span>
            )}

            {/* Seamless marquee track when overflowing */}
            {isOverflowing && (
                <div
                    className="flex w-max min-w-max items-center whitespace-nowrap will-change-transform hover:[animation-play-state:paused]"
                    style={{
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
