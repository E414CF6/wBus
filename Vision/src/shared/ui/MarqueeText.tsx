import { useEffect, useRef, useState } from "react";

type PopupMarqueeProps = {
    text: string;
    maxWidthClass?: string;
};

// Marquee Component
const PopupMarquee = ({ text, maxWidthClass = "max-w-full" }: PopupMarqueeProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    const [shouldMarquee, setShouldMarquee] = useState(false);

    useEffect(() => {
        const container = containerRef.current;
        const textEl = textRef.current;
        if (!container || !textEl || typeof ResizeObserver === "undefined") return;

        const checkOverflow = () => {
            // scrollWidth of textEl gives the true width of a single text span.
            // If currently marqueeing, it includes pr-6 (24px) padding, which provides a nice hysteresis.
            setShouldMarquee(textEl.scrollWidth > container.clientWidth);
        };

        checkOverflow();

        const observer = new ResizeObserver(checkOverflow);
        observer.observe(container);

        return () => observer.disconnect();
    }, [text]);

    return (
        <div
            ref={containerRef}
            className={`popup-marquee-container overflow-hidden inline-block align-middle ${maxWidthClass}`}
        >
            <style>{`
                @keyframes infinite-scroll {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
                .animate-infinite-scroll {
                    animation: infinite-scroll 6s linear infinite;
                    display: flex;
                    width: max-content;
                }
            `}</style>

            {shouldMarquee ? (
                <div className="animate-infinite-scroll flex-nowrap">
                    <span ref={textRef} className="pr-6 font-medium whitespace-nowrap shrink-0">
                        {text}
                    </span>
                    <span className="pr-6 font-medium whitespace-nowrap shrink-0" aria-hidden="true">
                        {text}
                    </span>
                </div>
            ) : (
                <span ref={textRef} className="whitespace-nowrap block font-medium truncate">{text}</span>
            )}
        </div>
    );
};

export default PopupMarquee;