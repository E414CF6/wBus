"use client";

import React from "react";
import {Check} from "lucide-react";
import {WIKI_PIN_COLORS, type WikiPinColor} from "@entities/wiki";

export const WIKI_PIN_COLOR_META: Record<
    WikiPinColor,
    {label: string; swatchClass: string}
> = {
    navy: {label: "네이비", swatchClass: "bg-[#003366]"},
    blue: {label: "블루", swatchClass: "bg-blue-600"},
    emerald: {label: "에메랄드", swatchClass: "bg-emerald-600"},
    teal: {label: "틸", swatchClass: "bg-teal-600"},
    indigo: {label: "인디고", swatchClass: "bg-indigo-600"},
    violet: {label: "바이올렛", swatchClass: "bg-violet-600"},
    amber: {label: "앰버", swatchClass: "bg-amber-600"},
    rose: {label: "로즈", swatchClass: "bg-rose-600"},
};

export interface WikiPinColorSelectorProps {
    id?: string;
    value: WikiPinColor;
    onChange: (next: WikiPinColor) => void;
}

export const WikiPinColorSelector: React.FC<WikiPinColorSelectorProps> = ({
    id = "wiki-pin-color",
    value,
    onChange,
}) => {
    return (
        <div>
            <span
                id={`${id}-label`}
                className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1.5"
            >
                핀 색상 ({WIKI_PIN_COLOR_META[value]?.label ?? "네이비"})
            </span>
            <div
                role="radiogroup"
                aria-labelledby={`${id}-label`}
                className="flex flex-wrap items-center gap-2 py-1"
            >
                {WIKI_PIN_COLORS.map((color) => {
                    const meta = WIKI_PIN_COLOR_META[color];
                    const selected = value === color;
                    return (
                        <button
                            key={color}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={`${meta.label} 핀 색상`}
                            title={meta.label}
                            onClick={() => onChange(color)}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${meta.swatchClass} ${
                                selected
                                    ? "ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-slate-900 scale-105"
                                    : "opacity-85 hover:opacity-100"
                            }`}
                        >
                            {selected && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
