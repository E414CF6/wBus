"use client";

import React, {useRef, useState} from "react";
import {BookOpen, Bus, Camera, Eye, Heading2, Info, List, PenLine, Table2} from "lucide-react";
import {WikiMarkdownRenderer} from "./WikiMarkdownRenderer";

export interface WikiMarkdownEditorProps {
    value: string;
    onChange: (next: string) => void;
    cityCode?: string;
}

export const WikiMarkdownEditor: React.FC<WikiMarkdownEditorProps> = ({
    value,
    onChange,
    cityCode = "32020",
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
            label: "위키 링크",
            icon: <BookOpen className="w-3.5 h-3.5"/>,
            snippet: "[[yonsei-mirae|연세대 미래캠퍼스]]",
        },
        {
            label: "노선 배지",
            icon: <Bus className="w-3.5 h-3.5"/>,
            snippet: `[[route:${cityCode}:30]]`,
        },
        {
            label: "로드뷰",
            icon: <Camera className="w-3.5 h-3.5"/>,
            snippet: "[[roadview:37.283476,127.900657,미래관 승강장]]",
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
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/12 text-[11px] font-bold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                            >
                                {btn.icon}
                                <span>{btn.label}</span>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {mode === "write" ? (
                <div className="space-y-1.5">
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => onChange(e.target.value)}
                        rows={14}
                        placeholder="마크다운으로 교통 팁, 환승 정보, 정류장 주의사항을 자유롭게 작성하세요. [[slug]]로 위키 문서 링크, [[route:32020:30]]로 실시간 노선 배지를 넣을 수 있습니다."
                        className="w-full p-3.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.04] border border-slate-200/85 dark:border-white/10 focus:border-[#003876] dark:focus:border-blue-400 text-xs sm:text-sm font-mono leading-relaxed text-slate-900 dark:text-slate-100 outline-none resize-y"
                    />
                    <p className="text-[11px] text-slate-400 dark:text-slate-500">
                        위키 문법: <code className="font-mono">[[문서슬러그|표시명]]</code> ·{" "}
                        <code className="font-mono">[[route:도시코드:노선번호]]</code> ·{" "}
                        <code className="font-mono">[[roadview:위도,경도,라벨]]</code>
                    </p>
                </div>
            ) : (
                <div className="p-4 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/80 dark:border-white/10 min-h-[240px]">
                    <WikiMarkdownRenderer markdown={value} showToc/>
                </div>
            )}
        </div>
    );
};
