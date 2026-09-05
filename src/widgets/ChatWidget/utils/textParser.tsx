import React from "react";

// Convert URLs, Hashtags, and Mentions into interactive rich elements
export function renderRichContent(content: string, onHashtagClick?: (tag: string) => void): React.ReactNode {
    const tokenRegex = /(https?:\/\/[^\s]+|#[a-zA-Z0-9_\uac00-\ud7a3]+|@[a-zA-Z0-9_\uac00-\ud7a3]+)/g;
    const parts = content.split(tokenRegex);

    return parts.map((part, index) => {
        if (!part) return null;

        // 1. External URL
        if (part.startsWith("http://") || part.startsWith("https://")) {
            return (<a
                key={index}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 dark:text-blue-400 hover:underline break-all font-semibold inline-flex items-center gap-0.5"
                onClick={(e) => e.stopPropagation()}
            >
                {part}
            </a>);
        }

        // 2. Hashtag (#tag)
        if (part.startsWith("#") && part.length > 1) {
            return (<span
                key={index}
                onClick={(e) => {
                    e.stopPropagation();
                    if (onHashtagClick) {
                        onHashtagClick(part);
                    }
                }}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        if (onHashtagClick) {
                            onHashtagClick(part);
                        }
                    }
                }}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-extrabold cursor-pointer hover:underline transition-colors inline-block bg-blue-50/60 dark:bg-blue-950/40 px-1.5 py-0.5 rounded-lg text-[13px] sm:text-sm mx-0.5"
                role="button"
                tabIndex={0}
            >
                    {part}
                </span>);
        }

        // 3. Mention (@user)
        if (part.startsWith("@") && part.length > 1) {
            return (<span
                key={index}
                className="text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded-md text-[13px] sm:text-sm mx-0.5"
            >
                    {part}
                </span>);
        }

        // Regular Text
        return <span key={index}>{part}</span>;
    });
}
