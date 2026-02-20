import { useEffect, useRef, useState } from "react";

type PopupMarqueeProps = {
    text: string;
    maxWidthClass?: string;
};

// Marquee Component
const PopupMarquee = ({ text, maxWidthClass = "max-w-full" }: PopupMarqueeProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [shouldMarquee, setShouldMarquee] = useState(false);

    useEffect(() => {
        const el = containerRef.current;
        if (!el || typeof ResizeObserver === "undefined") return;

        const checkOverflow = () => {
            setShouldMarquee(el.scrollWidth > el.clientWidth + 1);
        };

        checkOverflow();

        const observer = new ResizeObserver(checkOverflow);
        observer.observe(el);

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
                    <span className="pr-6 font-medium whitespace-nowrap shrink-0">
                        {text}
                    </span>
                    <span className="pr-6 font-medium whitespace-nowrap shrink-0" aria-hidden="true">
                        {text}
                    </span>
                </div>
            ) : (
                <span className="whitespace-nowrap block font-medium">{text}</span>
            )}
        </div>
    );
};

export default PopupMarquee;
