import type {WikiPinColor} from "@entities/wiki";
import {UI_TEXT} from "@shared/config/locale";

export interface WikiPinColorTheme {
    id: WikiPinColor;
    label: string;
    badgeBg: string;
    borderClass: string;
    dotBg: string;
    pillTextClass: string;
    swatchClass: string;
}

export const WIKI_PIN_COLOR_THEMES: Record<WikiPinColor, WikiPinColorTheme> = {
    navy: {
        id: "navy",
        label: UI_TEXT.WIKI.PIN_COLORS.navy,
        badgeBg: "bg-[#003366]",
        borderClass: "border-[#003366]/35",
        dotBg: "bg-[#003366]",
        pillTextClass: "text-[#003366] dark:text-sky-300",
        swatchClass: "bg-[#003366]",
    },
    blue: {
        id: "blue",
        label: UI_TEXT.WIKI.PIN_COLORS.blue,
        badgeBg: "bg-blue-600",
        borderClass: "border-blue-500/40",
        dotBg: "bg-blue-600",
        pillTextClass: "text-blue-700 dark:text-blue-300",
        swatchClass: "bg-blue-600",
    },
    emerald: {
        id: "emerald",
        label: UI_TEXT.WIKI.PIN_COLORS.emerald,
        badgeBg: "bg-emerald-600",
        borderClass: "border-emerald-500/40",
        dotBg: "bg-emerald-600",
        pillTextClass: "text-emerald-700 dark:text-emerald-300",
        swatchClass: "bg-emerald-600",
    },
    teal: {
        id: "teal",
        label: UI_TEXT.WIKI.PIN_COLORS.teal,
        badgeBg: "bg-teal-600",
        borderClass: "border-teal-500/40",
        dotBg: "bg-teal-600",
        pillTextClass: "text-teal-700 dark:text-teal-300",
        swatchClass: "bg-teal-600",
    },
    indigo: {
        id: "indigo",
        label: UI_TEXT.WIKI.PIN_COLORS.indigo,
        badgeBg: "bg-indigo-600",
        borderClass: "border-indigo-500/40",
        dotBg: "bg-indigo-600",
        pillTextClass: "text-indigo-700 dark:text-indigo-300",
        swatchClass: "bg-indigo-600",
    },
    violet: {
        id: "violet",
        label: UI_TEXT.WIKI.PIN_COLORS.violet,
        badgeBg: "bg-violet-600",
        borderClass: "border-violet-500/40",
        dotBg: "bg-violet-600",
        pillTextClass: "text-violet-700 dark:text-violet-300",
        swatchClass: "bg-violet-600",
    },
    amber: {
        id: "amber",
        label: UI_TEXT.WIKI.PIN_COLORS.amber,
        badgeBg: "bg-amber-600",
        borderClass: "border-amber-500/40",
        dotBg: "bg-amber-600",
        pillTextClass: "text-amber-700 dark:text-amber-300",
        swatchClass: "bg-amber-600",
    },
    rose: {
        id: "rose",
        label: UI_TEXT.WIKI.PIN_COLORS.rose,
        badgeBg: "bg-rose-600",
        borderClass: "border-rose-500/40",
        dotBg: "bg-rose-600",
        pillTextClass: "text-rose-700 dark:text-rose-300",
        swatchClass: "bg-rose-600",
    },
};

export const WIKI_PIN_COLOR_LIST: WikiPinColorTheme[] = Object.values(WIKI_PIN_COLOR_THEMES);

export function resolveWikiPinTheme(color?: WikiPinColor | null): WikiPinColorTheme {
    if (color && color in WIKI_PIN_COLOR_THEMES) {
        return WIKI_PIN_COLOR_THEMES[color];
    }
    return WIKI_PIN_COLOR_THEMES.navy;
}
