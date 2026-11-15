"use client";

import React from "react";
import {Plus, Route, Trash2} from "lucide-react";
import type {WikiLinkedRoute} from "@entities/wiki";
import {NATIONWIDE_CITIES} from "@entities/city";

export interface WikiRoutesEditorProps {
    value: WikiLinkedRoute[];
    onChange: (next: WikiLinkedRoute[]) => void;
    defaultCityCode?: string;
}

export const WikiRoutesEditor: React.FC<WikiRoutesEditorProps> = ({
                                                                      value,
                                                                      onChange,
                                                                      defaultCityCode = "32020",
                                                                  }) => {
    const updateRoute = (idx: number, patch: Partial<WikiLinkedRoute>) => {
        onChange(value.map((item, i) => (i === idx ? {...item, ...patch} : item)));
    };

    const addRoute = () => {
        onChange([
            ...value,
            {
                routeNo: "",
                cityCode: defaultCityCode,
                originLabel: "",
                destLabel: "",
                description: "",
                viaStops: "",
                note: "",
            },
        ]);
    };

    return (
        <div
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 overflow-hidden shadow-sm">
            <div
                className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/70 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <Route className="w-4 h-4 text-indigo-600 dark:text-indigo-400"/>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                        연결된 실시간 시내버스 노선 ({value.length})
                    </span>
                </div>
                <button
                    type="button"
                    onClick={addRoute}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-black transition cursor-pointer"
                >
                    <Plus className="w-3.5 h-3.5"/>
                    노선 추가
                </button>
            </div>

            <div className="p-4 space-y-3">
                {value.length === 0 ? (
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 text-center py-4">
                        연결된 시내버스 노선이 없습니다. 노선 번호(예: 30, 34, 34-1)를 추가하면 실시간 위치/시간표 위젯과 연동됩니다.
                    </p>
                ) : (
                    value.map((route, idx) => (
                        <div
                            key={`route-${idx}`}
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 space-y-2.5"
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] font-black text-slate-500 dark:text-slate-400">
                                    노선 #{idx + 1}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => onChange(value.filter((_, i) => i !== idx))}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                >
                                    <Trash2 className="w-3 h-3"/>
                                    삭제
                                </button>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <input
                                    type="text"
                                    value={route.routeNo}
                                    onChange={(e) => updateRoute(idx, {routeNo: e.target.value})}
                                    placeholder="노선 번호 (예: 30, 34-1)"
                                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-black"
                                />
                                <select
                                    value={route.cityCode}
                                    onChange={(e) => updateRoute(idx, {cityCode: e.target.value})}
                                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                                >
                                    {NATIONWIDE_CITIES.map((city) => (
                                        <option key={city.code} value={city.code}>
                                            {city.name} ({city.code})
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="text"
                                    value={route.label ?? ""}
                                    onChange={(e) => updateRoute(idx, {label: e.target.value || undefined})}
                                    placeholder="카드 별칭 (선택)"
                                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                    type="text"
                                    value={route.originLabel ?? ""}
                                    onChange={(e) => updateRoute(idx, {originLabel: e.target.value || undefined})}
                                    placeholder="기점/시내방향 표시명 (예: 장양리)"
                                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                />
                                <input
                                    type="text"
                                    value={route.destLabel ?? ""}
                                    onChange={(e) => updateRoute(idx, {destLabel: e.target.value || undefined})}
                                    placeholder="종점/학교방향 표시명 (예: 연세대 미래캠퍼스)"
                                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                />
                            </div>

                            <input
                                type="text"
                                value={route.description ?? ""}
                                onChange={(e) => updateRoute(idx, {description: e.target.value || undefined})}
                                placeholder="노선 요약 설명"
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                            />
                            <input
                                type="text"
                                value={route.viaStops ?? ""}
                                onChange={(e) => updateRoute(idx, {viaStops: e.target.value || undefined})}
                                placeholder="주요 경유지 (예: 원주터미널 · 단계동 · 만종역)"
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                            />
                            <input
                                type="text"
                                value={route.note ?? ""}
                                onChange={(e) => updateRoute(idx, {note: e.target.value || undefined})}
                                placeholder="주의사항/비고 (선택)"
                                className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                            />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
