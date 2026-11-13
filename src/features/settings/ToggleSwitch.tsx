"use client";

import React from "react";

export interface ToggleSwitchProps {
    checked: boolean;
    onChange: (next: boolean) => void;
    ariaLabel: string;
}

/**
 * Accessible toggle switch control used across settings modals.
 */
export function ToggleSwitch({checked, onChange, ariaLabel}: ToggleSwitchProps) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={ariaLabel}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
                checked ? "bg-[#003876] dark:bg-blue-500" : "bg-slate-300 dark:bg-white/15"
            }`}
        >
            <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ${
                    checked ? "translate-x-5" : "translate-x-0"
                }`}
            />
        </button>
    );
}
