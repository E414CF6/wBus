import {useEffect, useRef, useState} from "react";

type PopupMarqueeProps = {
    text: string; maxWidthClass?: string;
};

/**
 * A text component that scrolls horizontally (marquee) only when the content
 * overflows its container. Includes:
 * - Pause-scroll-pause cycle for readability (not a constant infinite scroll)
 * - `prefers-reduced-motion` support (falls back to truncation)
 * - ResizeObserver-based overflow detection
 */
const PopupMarquee = ({text, maxWidthClass = "max-w-full"}: PopupMarqueeProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const [shouldMarquee, setShouldMarquee] = useState(false);

    useEffect(() => {
        const container = containerRef.current;
        const textEl = textRef.current;
        if (!container || !textEl || typeof ResizeObserver === "undefined") return;

        const checkOverflow = () => {
            setShouldMarquee(textEl.scrollWidth > container.clientWidth);
        };

        checkOverflow();

        const observer = new ResizeObserver(checkOverflow);
        observer.observe(container);

        return () => observer.disconnect();
    }, [text]);

    return (<div
            ref={containerRef}
            className={`marquee-container overflow-hidden inline-block align-middle ${maxWidthClass}`}
        >
            {shouldMarquee ? (<div className="marquee-scroll flex-nowrap">
                    <span ref={textRef} className="pr-2 font-medium whitespace-nowrap shrink-0">
                        {text}
                    </span>
                    <span className="pr-2 font-medium whitespace-nowrap shrink-0" aria-hidden="true">
                        {text}
                    </span>
                </div>) : (<span ref={textRef} className="whitespace-nowrap block font-medium">{text}</span>)}
        </div>);
};

export default PopupMarquee;