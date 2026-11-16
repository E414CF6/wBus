import type {WikiPinColor} from "@entities/wiki";

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
        label: "네이비",
        badgeBg: "bg-[#003366]",
        borderClass: "border-[#003366]/35",
        dotBg: "bg-[#003366]",
        pillTextClass: "text-[#003366] dark:text-sky-300",
        swatchClass: "bg-[#003366]",
    },
    blue: {
        id: "blue",
        label: "블루",
        badgeBg: "bg-blue-600",
        borderClass: "border-blue-500/40",
        dotBg: "bg-blue-600",
        pillTextClass: "text-blue-700 dark:text-blue-300",
        swatchClass: "bg-blue-600",
    },
    emerald: {
        id: "emerald",
        label: "에메랄드",
        badgeBg: "bg-emerald-600",
        borderClass: "border-emerald-500/40",
        dotBg: "bg-emerald-600",
        pillTextClass: "text-emerald-700 dark:text-emerald-300",
        swatchClass: "bg-emerald-600",
    },
    teal: {
        id: "teal",
        label: "틸",
        badgeBg: "bg-teal-600",
        borderClass: "border-teal-500/40",
        dotBg: "bg-teal-600",
        pillTextClass: "text-teal-700 dark:text-teal-300",
        swatchClass: "bg-teal-600",
    },
    indigo: {
        id: "indigo",
        label: "인디고",
        badgeBg: "bg-indigo-600",
        borderClass: "border-indigo-500/40",
        dotBg: "bg-indigo-600",
        pillTextClass: "text-indigo-700 dark:text-indigo-300",
        swatchClass: "bg-indigo-600",
    },
    violet: {
        id: "violet",
        label: "바이올렛",
        badgeBg: "bg-violet-600",
        borderClass: "border-violet-500/40",
        dotBg: "bg-violet-600",
        pillTextClass: "text-violet-700 dark:text-violet-300",
        swatchClass: "bg-violet-600",
    },
    amber: {
        id: "amber",
        label: "앰버",
        badgeBg: "bg-amber-600",
        borderClass: "border-amber-500/40",
        dotBg: "bg-amber-600",
        pillTextClass: "text-amber-700 dark:text-amber-300",
        swatchClass: "bg-amber-600",
    },
    rose: {
        id: "rose",
        label: "로즈",
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
