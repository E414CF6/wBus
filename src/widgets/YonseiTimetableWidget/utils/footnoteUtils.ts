export const CIRCLED_NUMBERS = [
    "\u2460",
    "\u2461",
    "\u2462",
    "\u2463",
    "\u2464",
    "\u2465",
    "\u2466",
    "\u2467",
    "\u2468",
    "\u2469",
];

export const getFootnoteSymbol = (num: number): string => {
    if (num >= 1 && num <= 10) return CIRCLED_NUMBERS[num - 1];
    return `[${num}]`;
};

export const getRouteBadgeGradient = (no: string): string => {
    if (no === "30") return "from-[#003876] to-blue-700 shadow-blue-900/30";
    if (no === "34") return "from-blue-600 to-indigo-600 shadow-blue-500/20";
    if (no === "34-1") return "from-indigo-600 to-purple-600 shadow-indigo-500/20";
    return "from-[#003876] to-blue-700 shadow-blue-900/30";
};
