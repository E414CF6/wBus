import {BookOpen, Bus, GraduationCap, type LucideIcon, MapPin, TrainFront} from "lucide-react";
import type {WikiCategory} from "@entities/wiki";

export interface WikiCategoryPinStyle {
    label: string;
    shortLabel: string;
    badgeBg: string;
    borderClass: string;
    dotBg: string;
    pillTextClass: string;
    icon: LucideIcon;
}

export const WIKI_CATEGORY_PIN_STYLES: Record<WikiCategory, WikiCategoryPinStyle> = {
    campus: {
        label: "캠퍼스 허브",
        shortLabel: "캠퍼스",
        badgeBg: "bg-[#003876]",
        borderClass: "border-[#003876]/35 dark:border-sky-400/40",
        dotBg: "bg-[#003876]",
        pillTextClass: "text-[#003876] dark:text-sky-300",
        icon: GraduationCap,
    },
    terminal: {
        label: "터미널 · 역",
        shortLabel: "터미널·역",
        badgeBg: "bg-emerald-600",
        borderClass: "border-emerald-500/35 dark:border-emerald-400/40",
        dotBg: "bg-emerald-600",
        pillTextClass: "text-emerald-700 dark:text-emerald-300",
        icon: TrainFront,
    },
    stop: {
        label: "정류장 · 환승",
        shortLabel: "정류장",
        badgeBg: "bg-teal-600",
        borderClass: "border-teal-500/35 dark:border-teal-400/40",
        dotBg: "bg-teal-600",
        pillTextClass: "text-teal-700 dark:text-teal-300",
        icon: MapPin,
    },
    route: {
        label: "노선 가이드",
        shortLabel: "노선",
        badgeBg: "bg-indigo-600",
        borderClass: "border-indigo-500/35 dark:border-indigo-400/40",
        dotBg: "bg-indigo-600",
        pillTextClass: "text-indigo-700 dark:text-indigo-300",
        icon: Bus,
    },
    guide: {
        label: "이용 팁 · 안내",
        shortLabel: "위키 팁",
        badgeBg: "bg-violet-600",
        borderClass: "border-violet-500/35 dark:border-violet-400/40",
        dotBg: "bg-violet-600",
        pillTextClass: "text-violet-700 dark:text-violet-300",
        icon: BookOpen,
    },
};
