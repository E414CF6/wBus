"use client";

import React from "react";
import {MapPin, Plus, Trash2} from "lucide-react";
import type {WikiBoardingStop} from "@entities/wiki";

export interface WikiStopsEditorProps {
    value: WikiBoardingStop[];
    onChange: (next: WikiBoardingStop[]) => void;
}

export const WikiStopsEditor: React.FC<WikiStopsEditorProps> = ({value, onChange}) => {
    const updateStop = (idx: number, patch: Partial<WikiBoardingStop>) => {
        onChange(value.map((s, i) => (i === idx ? {...s, ...patch} : s)));
    };

    const addStop = () => {
        onChange([
            ...value,
            {
                id: `stop-${Date.now()}`,
                number: value.length + 1,
                name: "",
                lat: 37.338,
                lng: 127.92,
                locationDescription: "",
                directionTag: "공통",
                tips: "",
            },
        ]);
    };

    return (
        <div
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 overflow-hidden shadow-sm">
            <div
                className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/70 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400"/>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                        주요 승강장 · 탑승 위치 ({value.length})
                    </span>
                </div>
                <button
                    type="button"
                    onClick={addStop}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black transition cursor-pointer"
                >
                    <Plus className="w-3.5 h-3.5"/>
                    승강장 추가
                </button>
            </div>

            <div className="p-4 space-y-3">
                {value.length === 0 ? (
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 text-center py-4">
                        등록된 승강장이 없습니다. 오른쪽 상단 &lsquo;승강장 추가&rsquo; 버튼으로 카카오맵·로드뷰 연동 정류장을 추가하세요.
                    </p>
                ) : (
                    value.map((stop, idx) => (
                        <div
                            key={stop.id || idx}
                            className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 space-y-2.5"
                        >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <span className="text-[11px] font-black text-slate-500 dark:text-slate-400">
                                    승강장 #{idx + 1}
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

                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                                <input
                                    type="text"
                                    value={stop.name}
                                    onChange={(e) => updateStop(idx, {name: e.target.value})}
                                    placeholder="승강장 이름 (예: 대학본부 앞)"
                                    className="sm:col-span-2 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                                />
                                <select
                                    value={stop.directionTag}
                                    onChange={(e) =>
                                        updateStop(idx, {
                                            directionTag: e.target.value as WikiBoardingStop["directionTag"],
                                        })
                                    }
                                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
                                >
                                    <option value="시내방면">시내방면</option>
                                    <option value="학교방면">학교방면</option>
                                    <option value="공통">공통</option>
                                </select>
                                <input
                                    type="number"
                                    value={stop.number ?? idx + 1}
                                    onChange={(e) => updateStop(idx, {number: Number(e.target.value) || idx + 1})}
                                    placeholder="순번"
                                    className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold tabular-nums"
                                />
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                <input
                                    type="number"
                                    step="0.000001"
                                    value={stop.lat}
                                    onChange={(e) => updateStop(idx, {lat: parseFloat(e.target.value) || 0})}
                                    placeholder="위도 (lat)"
                                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                                />
                                <input
                                    type="number"
                                    step="0.000001"
                                    value={stop.lng}
                                    onChange={(e) => updateStop(idx, {lng: parseFloat(e.target.value) || 0})}
                                    placeholder="경도 (lng)"
                                    className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                                />
                                <input
                                    type="text"
                                    value={stop.shortName ?? ""}
                                    onChange={(e) => updateStop(idx, {shortName: e.target.value || undefined})}
                                    placeholder="짧은 이름 (선택)"
                                    className="sm:col-span-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                />
                            </div>

                            <input
                                type="text"
                                value={stop.locationDescription}
                                onChange={(e) => updateStop(idx, {locationDescription: e.target.value})}
                                placeholder="위치 설명 (예: 대학본부 맞은편 도로변 셔틀 승강장)"
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                            />
                            <input
                                type="text"
                                value={stop.tips ?? ""}
                                onChange={(e) => updateStop(idx, {tips: e.target.value || undefined})}
                                placeholder="탑승 팁 (선택: 줄 서는 방향, 만차 시 대안 등)"
                                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                            />
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
