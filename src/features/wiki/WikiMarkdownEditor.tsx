"use client";

import React, {useRef, useState} from "react";
import {BookOpen, Bus, Camera, Clock, Eye, Heading2, Info, List, MapPin, PenLine, Route, Table2,} from "lucide-react";
import {WikiMarkdownRenderer} from "./WikiMarkdownRenderer";

export interface WikiMarkdownEditorProps {
    value: string;
    onChange: (next: string) => void;
}

const ROUTES_SNIPPET = `\n## 연결 시내버스\n\n\`\`\`routes\n32020 | 30 | 30번 | 기점 ↔ 종점 설명 | 주요 경유지\n\`\`\`\n`;

const SHUTTLE_SNIPPET = `\n## 셔틀 시간표\n\n\`\`\`shuttle\ntitle: 무료 셔틀버스 시간표\n\n[stops]\n- 정류장명 | 탑승 위치 설명\n\n[inbound]\n- 평일 운행 | 08:00 | 출발지 -> 도착지 | 경유: 경유지(08:15 정시)\n\n[outbound]\n- 평일 운행 | 17:00 | 출발지 -> 도착지 | 비고: 막차\n\n[guidelines]\n- 출발 5분 전까지 승강장에 대기해 주세요.\n\`\`\`\n`;

const STOPS_SNIPPET = `\n## 주요 승강장\n\n\`\`\`stops\n- 승강장 이름 | 공통 | 37.343832, 127.932123 | 상세 위치 설명 | 참고 팁\n\`\`\`\n`;

export const WikiMarkdownEditor: React.FC<WikiMarkdownEditorProps> = ({
                                                                          value,
                                                                          onChange,
                                                                      }) => {
    const [mode, setMode] = useState<"write" | "preview">("write");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const insertSnippet = (snippet: string) => {
        const el = textareaRef.current;
        if (!el) {
            onChange(`${value}${value.endsWith("\n") || !value ? "" : "\n"}${snippet}`);
            return;
        }
        const start = el.selectionStart ?? value.length;
        const end = el.selectionEnd ?? value.length;
        const next = value.slice(0, start) + snippet + value.slice(end);
        onChange(next);
        requestAnimationFrame(() => {
            el.focus();
            const cursor = start + snippet.length;
            el.setSelectionRange(cursor, cursor);
        });
    };

    const toolbarItems = [
        {label: "제목", icon: <Heading2 className="w-3.5 h-3.5"/>, snippet: "\n## 새 섹션\n"},
        {label: "목록", icon: <List className="w-3.5 h-3.5"/>, snippet: "\n- 항목 내용\n"},
        {
            label: "꿀팁 박스",
            icon: <Info className="w-3.5 h-3.5"/>,
            snippet: "\n> [!TIP]\n> 여기에 탑승 꿀팁을 입력하세요.\n",
        },
        {
            label: "표",
            icon: <Table2 className="w-3.5 h-3.5"/>,
            snippet: "\n| 구분 | 안내 |\n| :--- | :--- |\n| 내용 | 설명 |\n",
        },
        {
            label: "노선 카드",
            icon: <Route className="w-3.5 h-3.5"/>,
            snippet: ROUTES_SNIPPET,
        },
        {
            label: "셔틀 시간표",
            icon: <Clock className="w-3.5 h-3.5"/>,
            snippet: SHUTTLE_SNIPPET,
        },
        {
            label: "승강장",
            icon: <MapPin className="w-3.5 h-3.5"/>,
            snippet: STOPS_SNIPPET,
        },
        {
            label: "위키 링크",
            icon: <BookOpen className="w-3.5 h-3.5"/>,
            snippet: "[[문서 제목|표시 텍스트]]",
        },
        {
            label: "노선 배지",
            icon: <Bus className="w-3.5 h-3.5"/>,
            snippet: "[[route:도시코드:노선번호]]",
        },
        {
            label: "로드뷰",
            icon: <Camera className="w-3.5 h-3.5"/>,
            snippet: "[[roadview:37.5665,126.9780,정류장 위치]]",
        },
    ];

    return (
        <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/[0.06]">
                    <button
                        type="button"
                        onClick={() => setMode("write")}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                            mode === "write"
                                ? "bg-white dark:bg-[#1b2234] text-[#003876] dark:text-blue-300 shadow-xs"
                                : "text-slate-600 dark:text-slate-300"
                        }`}
                    >
                        <PenLine className="w-3.5 h-3.5"/>
                        <span>마크다운 작성</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode("preview")}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black transition-colors cursor-pointer ${
                            mode === "preview"
                                ? "bg-white dark:bg-[#1b2234] text-[#003876] dark:text-blue-300 shadow-xs"
                                : "text-slate-600 dark:text-slate-300"
                        }`}
                    >
                        <Eye className="w-3.5 h-3.5"/>
                        <span>미리보기</span>
                    </button>
                </div>

                {mode === "write" && (
                    <div className="flex flex-wrap items-center gap-1">
                        {toolbarItems.map((btn) => (
                            <button
                                key={btn.label}
                                type="button"
                                onClick={() => insertSnippet(btn.snippet)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-[11px] font-bold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                            >
                                {btn.icon}
                                <span>{btn.label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {mode === "write" ? (
                <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    rows={18}
                    placeholder="마크다운으로 문서와 노선(```routes), 셔틀 시간표(```shuttle), 승강장(```stops)을 한 번에 작성하세요."
                    className="w-full rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 p-4 font-mono text-xs sm:text-sm text-slate-800 dark:text-slate-100 leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#003876]/40 dark:focus:ring-blue-500/40 resize-y min-h-[340px]"
                />
            ) : (
                <div
                    className="rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900/90 p-5 min-h-[340px]">
                    <WikiMarkdownRenderer markdown={value}/>
                </div>
            )}
        </div>
    );
};
