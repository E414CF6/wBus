import { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

// ----------------------------------------------------------------------
// Types & Config
// ----------------------------------------------------------------------

type PillTone = "soft" | "solid" | "muted" | "light" | "glass";
type PillSize = "sm" | "md";

/**
 * Visual styles mapping for the Pill component.
 * - `soft`: Light background with colored text (Standard).
 * - `solid`: High contrast, filled background.
 * - `muted`: Gray scale for neutral status.
 * - `light`: For use on dark backgrounds (translucent white).
 * - `glass`: Frosted glass effect for overlays.
 */
const toneStyles: Record<PillTone, string> = {
    soft: "bg-black/[0.04] text-gray-800 dark:bg-white/[0.06] dark:text-gray-200 border-none",
    solid: "bg-black text-white dark:bg-white dark:text-black border-none",
    muted: "bg-black/[0.02] text-gray-500 dark:bg-white/[0.02] dark:text-gray-400 border-none",
    light: "bg-white/60 dark:bg-white/[0.06] text-black dark:text-white border-none",
    glass: "bg-white/40 dark:bg-[#111111]/40 text-black dark:text-white backdrop-blur-3xl border border-black/[0.04] dark:border-white/[0.06]",
};

const sizeStyles: Record<PillSize, string> = {
    sm: "px-2.5 py-1 text-[11px]",
    md: "px-3.5 py-1.5 text-[13px]",
};

/**
 * Props for the Pill component.
 * Supports polymorphism via the `as` prop.
 */
type PillProps<T extends ElementType> = {
    /** The HTML element or React component to render (default: "span") */
    as?: T;
    /** The content to display inside the pill */
    children: ReactNode;
    /** Additional CSS classes to merge */
    className?: string;
    /** The visual color theme of the pill */
    tone?: PillTone;
    /** The size dimension of the pill */
    size?: PillSize;
} & ComponentPropsWithoutRef<T>; // Inherit props from the underlying element (e.g., onClick, href)

// ----------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------

/**
 * A versatile "Pill" or "Badge" component for displaying status, tags, or counts.
 * It is polymorphic, meaning it can be rendered as a span, div, button, etc.
 *
 * @example
 * <Pill tone="solid" size="sm">New</Pill>
 * <Pill as="button" onClick={handleClick}>Click Me</Pill>
 */
export default function Pill<T extends ElementType = "span">({
    as,
    children,
    className = "",
    tone = "soft",
    size = "md",
    ...props
}: PillProps<T>) {
    const Component = as || "span";

    return (
        <Component
            className={`
        inline-flex items-center gap-1.5 rounded-full
        font-semibold leading-none whitespace-nowrap
        transition-colors duration-200
        ${toneStyles[tone]}
        ${sizeStyles[size]}
        ${className}
      `}
            {...props}
        >
            {children}
        </Component>
    );
}
