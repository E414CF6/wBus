"use client";

import React from "react";
import {Check} from "lucide-react";
import {WIKI_PIN_COLORS, type WikiPinColor} from "@entities/wiki";
import {UI_TEXT} from "@shared/config/locale";

export const WIKI_PIN_COLOR_META: Record<
    WikiPinColor,
    { label: string; swatchClass: string }
> = {
    navy: {label: UI_TEXT.WIKI.PIN_COLORS.navy, swatchClass: "bg-[#003366]"},
    blue: {label: UI_TEXT.WIKI.PIN_COLORS.blue, swatchClass: "bg-blue-600"},
    emerald: {label: UI_TEXT.WIKI.PIN_COLORS.emerald, swatchClass: "bg-emerald-600"},
    teal: {label: UI_TEXT.WIKI.PIN_COLORS.teal, swatchClass: "bg-teal-600"},
    indigo: {label: UI_TEXT.WIKI.PIN_COLORS.indigo, swatchClass: "bg-indigo-600"},
    violet: {label: UI_TEXT.WIKI.PIN_COLORS.violet, swatchClass: "bg-violet-600"},
    amber: {label: UI_TEXT.WIKI.PIN_COLORS.amber, swatchClass: "bg-amber-600"},
    rose: {label: UI_TEXT.WIKI.PIN_COLORS.rose, swatchClass: "bg-rose-600"},
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
                {UI_TEXT.WIKI.PIN_COLOR_SELECTOR.LABEL_FORMAT(WIKI_PIN_COLOR_META[value]?.label ?? UI_TEXT.WIKI.PIN_COLORS.navy)}
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
                            aria-label={UI_TEXT.WIKI.PIN_COLOR_SELECTOR.OPTION_ARIA(meta.label)}
                            title={meta.label}
                            onClick={() => onChange(color)}
                            className={`w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 cursor-pointer ${meta.swatchClass} ${
                                selected
                                    ? "ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-slate-900 scale-105"
                                    : "opacity-85 hover:opacity-100"
                            }`}
                        >
                            {selected && <Check className="w-3.5 h-3.5 text-white stroke-[3]"/>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
