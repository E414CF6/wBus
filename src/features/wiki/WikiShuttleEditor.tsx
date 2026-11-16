"use client";

import React, {useState} from "react";
import {Bus, ChevronDown, ChevronUp, Plus, Trash2} from "lucide-react";
import type {ShuttleInboundItem, ShuttleOutboundItem, ShuttleViaStop} from "@entities/schedule";
import type {WikiShuttleBlock} from "@entities/wiki";

export interface WikiShuttleEditorProps {
    value: WikiShuttleBlock | null;
    onChange: (next: WikiShuttleBlock | null) => void;
}

const DEFAULT_SHUTTLE_BLOCK: WikiShuttleBlock = {
    enabled: true,
    title: "무료 셔틀버스 시간표",
    stop_locations: [],
    inbound_to_campus: [],
    outbound_from_campus: [],
    guidelines: [],
};

function formatViaText(via: ShuttleViaStop[]): string {
    return via
        .map((v) => {
            const parts = [v.name];
            if (v.time) parts.push(v.time);
            if (v.is_fixed_time) parts.push("정시");
            return parts.join("|");
        })
        .join(", ");
}

function parseViaText(raw: string): ShuttleViaStop[] {
    if (!raw.trim()) return [];
    return raw
        .split(",")
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .map((chunk) => {
            const [nameRaw, timeRaw, fixedRaw] = chunk.split("|").map((p) => p.trim());
            const time = timeRaw && /^([01]\d|2[0-3]):[0-5]\d$/.test(timeRaw) ? timeRaw : null;
            return {
                name: nameRaw,
                time,
                ...(fixedRaw === "정시" || fixedRaw === "fixed" ? {is_fixed_time: true} : {}),
            };
        });
}

export const WikiShuttleEditor: React.FC<WikiShuttleEditorProps> = ({value, onChange}) => {
    const [activeSection, setActiveSection] = useState<"outbound" | "inbound" | "guidelines">("outbound");

    if (!value) {
        return (
            <div
                className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-900/40 p-5 flex items-center justify-between gap-4">
                <div className="min-w-0">
                    <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Bus className="w-4 h-4 text-sky-600 dark:text-sky-400"/>
                        셔틀버스 시간표 블록 (비활성)
                    </h4>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                        셔틀·순환버스 시간표와 실시간 다음 출발 카운트다운을 이 문서에 포함할 수 있습니다.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => onChange({...DEFAULT_SHUTTLE_BLOCK})}
                    className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-black transition cursor-pointer"
                >
                    <Plus className="w-3.5 h-3.5"/>
                    셔틀 블록 추가
                </button>
            </div>
        );
    }

    const updateBlock = (patch: Partial<WikiShuttleBlock>) => {
        onChange({...value, ...patch});
    };

    const updateOutbound = (idx: number, patch: Partial<ShuttleOutboundItem>) => {
        const next = value.outbound_from_campus.map((item, i) => (i === idx ? {...item, ...patch} : item));
        updateBlock({outbound_from_campus: next});
    };

    const updateInbound = (idx: number, patch: Partial<ShuttleInboundItem>) => {
        const next = value.inbound_to_campus.map((item, i) => (i === idx ? {...item, ...patch} : item));
        updateBlock({inbound_to_campus: next});
    };

    const addOutbound = () => {
        updateBlock({
            outbound_from_campus: [
                ...value.outbound_from_campus,
                {
                    operation_type: "평일",
                    departure_point: "출발지",
                    departure_time: "09:00",
                    destination: "도착지",
                    via: [],
                    note: null,
                },
            ],
        });
    };

    const addInbound = () => {
        updateBlock({
            inbound_to_campus: [
                ...value.inbound_to_campus,
                {
                    operation_type: "평일",
                    departure_point: "출발지",
                    departure_time: "08:00",
                    via: [],
                    destination: "도착지",
                    note: null,
                },
            ],
        });
    };

    return (
        <div
            className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/90 overflow-hidden shadow-sm">
            <div
                className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-800/70 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                    <Bus className="w-4 h-4 text-[#003876] dark:text-sky-400 shrink-0"/>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                        셔틀버스 시간표 구조화 데이터
                    </span>
                    <label
                        className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300 cursor-pointer ml-1">
                        <input
                            type="checkbox"
                            checked={value.enabled}
                            onChange={(e) => updateBlock({enabled: e.target.checked})}
                            className="rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                        />
                        화면 표시
                    </label>
                </div>
                <button
                    type="button"
                    onClick={() => onChange(null)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                >
                    <Trash2 className="w-3.5 h-3.5"/>
                    블록 제거
                </button>
            </div>

            <div className="p-4 space-y-4">
                <div>
                    <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 mb-1">
                        셔틀 섹션 제목
                    </label>
                    <input
                        type="text"
                        value={value.title}
                        onChange={(e) => updateBlock({title: e.target.value})}
                        maxLength={80}
                        placeholder="예: 무료 셔틀버스 시간표"
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40"
                    />
                </div>

                {/* Sub-tabs */}
                <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setActiveSection("outbound")}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                            activeSection === "outbound"
                                ? "bg-white dark:bg-slate-900 text-[#003876] dark:text-sky-400 shadow-xs"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                    >
                        학교 출발 / 하교 ({value.outbound_from_campus.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSection("inbound")}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                            activeSection === "inbound"
                                ? "bg-white dark:bg-slate-900 text-[#003876] dark:text-sky-400 shadow-xs"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                    >
                        학교 도착 / 등교 ({value.inbound_to_campus.length})
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveSection("guidelines")}
                        className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-extrabold transition cursor-pointer ${
                            activeSection === "guidelines"
                                ? "bg-white dark:bg-slate-900 text-[#003876] dark:text-sky-400 shadow-xs"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                        }`}
                    >
                        안내사항 ({value.guidelines.length})
                    </button>
                </div>

                {activeSection === "outbound" && (
                    <div className="space-y-2.5">
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            경유지는 <code
                            className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800">정류장|HH:MM|정시</code> 형식으로
                            쉼표(,)로 구분해 입력하세요. (예: <code>원주역|08:50|정시, 원주터미널</code>)
                        </p>
                        {value.outbound_from_campus.map((item, idx) => (
                            <div
                                key={`out-${idx}`}
                                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-2"
                            >
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <input
                                        type="text"
                                        value={item.departure_time}
                                        onChange={(e) => updateOutbound(idx, {departure_time: e.target.value})}
                                        placeholder="HH:MM (예: 17:10)"
                                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold tabular-nums"
                                    />
                                    <input
                                        type="text"
                                        value={item.operation_type}
                                        onChange={(e) => updateOutbound(idx, {operation_type: e.target.value})}
                                        placeholder="운행 구분 (예: 평일)"
                                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                                    />
                                    <input
                                        type="text"
                                        value={item.departure_point}
                                        onChange={(e) => updateOutbound(idx, {departure_point: e.target.value})}
                                        placeholder="출발지"
                                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                                    />
                                    <input
                                        type="text"
                                        value={item.destination}
                                        onChange={(e) => updateOutbound(idx, {destination: e.target.value})}
                                        placeholder="도착지"
                                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                                    />
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="text"
                                        defaultValue={formatViaText(item.via)}
                                        onBlur={(e) => updateOutbound(idx, {via: parseViaText(e.target.value)})}
                                        placeholder="경유지 (예: 만종역|17:25, 원주터미널)"
                                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                    />
                                    <input
                                        type="text"
                                        value={item.note ?? ""}
                                        onChange={(e) => updateOutbound(idx, {note: e.target.value || null})}
                                        placeholder="비고 (선택)"
                                        className="sm:w-44 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                    />
                                    <div className="flex items-center gap-1 shrink-0">
                                        {idx > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const copy = [...value.outbound_from_campus];
                                                    [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
                                                    updateBlock({outbound_from_campus: copy});
                                                }}
                                                title="위로"
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
                                            >
                                                <ChevronUp className="w-3.5 h-3.5"/>
                                            </button>
                                        )}
                                        {idx < value.outbound_from_campus.length - 1 && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const copy = [...value.outbound_from_campus];
                                                    [copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]];
                                                    updateBlock({outbound_from_campus: copy});
                                                }}
                                                title="아래로"
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
                                            >
                                                <ChevronDown className="w-3.5 h-3.5"/>
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                updateBlock({
                                                    outbound_from_campus: value.outbound_from_campus.filter((_, i) => i !== idx),
                                                })
                                            }
                                            title="삭제"
                                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                        >
                                            <Trash2 className="w-3.5 h-3.5"/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={addOutbound}
                            className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-extrabold text-sky-700 dark:text-sky-400 hover:bg-sky-50/70 dark:hover:bg-sky-950/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <Plus className="w-3.5 h-3.5"/>
                            하교(학교 출발) 배차 추가
                        </button>
                    </div>
                )}

                {activeSection === "inbound" && (
                    <div className="space-y-2.5">
                        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            경유지는 <code
                            className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800">정류장|HH:MM|정시</code> 형식으로
                            쉼표(,)로 구분해 입력하세요.
                        </p>
                        {value.inbound_to_campus.map((item, idx) => (
                            <div
                                key={`in-${idx}`}
                                className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 space-y-2"
                            >
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    <input
                                        type="text"
                                        value={item.departure_time}
                                        onChange={(e) => updateInbound(idx, {departure_time: e.target.value})}
                                        placeholder="HH:MM (예: 08:20)"
                                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold tabular-nums"
                                    />
                                    <input
                                        type="text"
                                        value={item.operation_type}
                                        onChange={(e) => updateInbound(idx, {operation_type: e.target.value})}
                                        placeholder="운행 구분 (예: 평일)"
                                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                                    />
                                    <input
                                        type="text"
                                        value={item.departure_point}
                                        onChange={(e) => updateInbound(idx, {departure_point: e.target.value})}
                                        placeholder="출발지"
                                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                                    />
                                    <input
                                        type="text"
                                        value={item.destination}
                                        onChange={(e) => updateInbound(idx, {destination: e.target.value})}
                                        placeholder="도착지"
                                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
                                    />
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <input
                                        type="text"
                                        defaultValue={formatViaText(item.via)}
                                        onBlur={(e) => updateInbound(idx, {via: parseViaText(e.target.value)})}
                                        placeholder="경유지 (예: 원주터미널|08:30|정시, 원주역)"
                                        className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                    />
                                    <input
                                        type="text"
                                        value={item.note ?? ""}
                                        onChange={(e) => updateInbound(idx, {note: e.target.value || null})}
                                        placeholder="비고 (선택)"
                                        className="sm:w-44 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                    />
                                    <button
                                        type="button"
                                        onClick={() =>
                                            updateBlock({
                                                inbound_to_campus: value.inbound_to_campus.filter((_, i) => i !== idx),
                                            })
                                        }
                                        title="삭제"
                                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 self-end sm:self-center cursor-pointer"
                                    >
                                        <Trash2 className="w-3.5 h-3.5"/>
                                    </button>
                                </div>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={addInbound}
                            className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-extrabold text-sky-700 dark:text-sky-400 hover:bg-sky-50/70 dark:hover:bg-sky-950/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <Plus className="w-3.5 h-3.5"/>
                            등교(학교 도착) 배차 추가
                        </button>
                    </div>
                )}

                {activeSection === "guidelines" && (
                    <div className="space-y-2">
                        {value.guidelines.map((line, idx) => (
                            <div key={`guide-${idx}`} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={line}
                                    onChange={(e) => {
                                        const next = value.guidelines.map((g, i) => (i === idx ? e.target.value : g));
                                        updateBlock({guidelines: next});
                                    }}
                                    placeholder="안내 문구"
                                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-medium"
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        updateBlock({
                                            guidelines: value.guidelines.filter((_, i) => i !== idx),
                                        })
                                    }
                                    className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                                >
                                    <Trash2 className="w-3.5 h-3.5"/>
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => updateBlock({guidelines: [...value.guidelines, ""]})}
                            className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-extrabold text-sky-700 dark:text-sky-400 hover:bg-sky-50/70 dark:hover:bg-sky-950/30 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                            <Plus className="w-3.5 h-3.5"/>
                            안내사항 항목 추가
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
