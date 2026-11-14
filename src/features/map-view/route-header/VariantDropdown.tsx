"use client";

import React from "react";
import {Check, GitFork} from "lucide-react";
import type {RouteVariation} from "@entities/route/types";
import type {RouteMeta} from "@entities/route/routeMetadata";

interface VariantDropdownProps {
    meta: RouteMeta;
    effectiveVariations: RouteVariation[];
    selectedVariantId: string | null;
    activeVariant: RouteVariation | null;
    busesPerVariation: Map<string, number>;
    onSelectVariant: (variantId: string | null) => void;
}

export const VariantDropdown: React.FC<VariantDropdownProps> = ({
    meta,
    effectiveVariations,
    selectedVariantId,
    activeVariant,
    busesPerVariation,
    onSelectVariant,
}) => {
    return (
        <div
            className="absolute top-full left-0 mt-2 z-50 w-64 sm:w-72 max-w-[calc(100vw-2rem)] bg-white/95 dark:bg-[#11131a]/95 backdrop-blur-2xl rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.25)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.7)] border border-black/10 dark:border-white/15 p-1.5 space-y-1 animate-scaleUp select-none"
        >
            <div className="px-3 py-1.5 border-b border-black/5 dark:border-white/5 flex items-center justify-between text-[11px] font-extrabold text-slate-500 dark:text-slate-400">
                <span>노선 종류 및 경유지 선택</span>
                <span className="font-mono text-[10px]">총 {effectiveVariations.length}개</span>
            </div>

            <div className="max-h-60 overflow-y-auto custom-scrollbar p-0.5 space-y-0.5">
                {/* Option: View All Variations combined */}
                <button
                    type="button"
                    onClick={() => onSelectVariant("all")}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer text-left ${
                        selectedVariantId === "all"
                            ? `${meta.colorTheme.bg} text-white shadow-xs`
                            : "text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5"
                    }`}
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <GitFork className="w-3.5 h-3.5 shrink-0 opacity-80"/>
                        <div className="truncate">
                            <p className="truncate">전체 경로 (모든 경유지)</p>
                            <p className={`text-[10px] font-semibold truncate ${selectedVariantId === "all" ? "text-white/80" : "text-slate-400"}`}>
                                {meta.origin} ↔ {meta.destination}
                            </p>
                        </div>
                    </div>
                    {selectedVariantId === "all" && <Check className="w-4 h-4 shrink-0 ml-2"/>}
                </button>

                {/* Individual Variation Options */}
                {effectiveVariations.map((variant, idx) => {
                    const isSelected = selectedVariantId !== "all" && (activeVariant?.routeId === variant.routeId);
                    const count = busesPerVariation.get(variant.routeId) ?? 0;
                    const turningStopName = variant.turningStop?.nodenm;

                    return (
                        <button
                            key={variant.routeId}
                            type="button"
                            onClick={() => onSelectVariant(variant.routeId)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-black transition cursor-pointer text-left ${
                                isSelected
                                    ? `${meta.colorTheme.bg} text-white shadow-xs`
                                    : "text-slate-700 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5"
                            }`}
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <span
                                    className={`w-5 text-center font-mono text-[11px] font-bold shrink-0 ${isSelected ? "text-white/80" : "text-slate-400"}`}
                                >
                                    {idx + 1}
                                </span>
                                <div className="truncate">
                                    <div className="flex items-center gap-1.5">
                                        <span className="truncate">{variant.label}</span>
                                        {count > 0 && (
                                            <span
                                                className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${
                                                    isSelected
                                                        ? "bg-white/20 text-white"
                                                        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                                }`}
                                            >
                                                {count}대 운행
                                            </span>
                                        )}
                                    </div>
                                    <p className={`text-[10px] font-semibold truncate ${isSelected ? "text-white/80" : "text-slate-400"}`}>
                                        {turningStopName ? `회차: ${turningStopName}` : `${variant.stops.length}개 정류장`}
                                    </p>
                                </div>
                            </div>
                            {isSelected && <Check className="w-4 h-4 shrink-0 ml-2"/>}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
