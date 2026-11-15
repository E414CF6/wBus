"use client";

import React, {useMemo} from "react";
import Link from "next/link";
import {AlertTriangle, BookOpen, Bus, Camera, ExternalLink, Info, Lightbulb} from "lucide-react";
import {getKakaoRoadviewUrl} from "@entities/station";
import {
    parseWikiMarkdown,
    type WikiBlockNode,
    type WikiCalloutTone,
    type WikiInlineNode,
} from "@entities/wiki";
import {buildMapUrl} from "@widgets/AppShell/hooks/useAppNavigation";

function renderInlineNodes(nodes: WikiInlineNode[], keyPrefix: string): React.ReactNode {
    return nodes.map((node, idx) => {
        const key = `${keyPrefix}-${idx}`;
        switch (node.type) {
            case "text":
                return <React.Fragment key={key}>{node.text}</React.Fragment>;
            case "strong":
                return (
                    <strong key={key} className="font-black text-slate-900 dark:text-white">
                        {renderInlineNodes(node.children, key)}
                    </strong>
                );
            case "em":
                return (
                    <em key={key} className="italic">
                        {renderInlineNodes(node.children, key)}
                    </em>
                );
            case "del":
                return (
                    <del key={key} className="line-through text-slate-400 dark:text-slate-500">
                        {renderInlineNodes(node.children, key)}
                    </del>
                );
            case "code":
                return (
                    <code
                        key={key}
                        className="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 font-mono text-[0.85em] font-bold text-[#003876] dark:text-blue-300"
                    >
                        {node.text}
                    </code>
                );
            case "link":
                if (node.isExternal) {
                    return (
                        <a
                            key={key}
                            href={node.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 font-bold text-[#003876] dark:text-blue-400 underline underline-offset-4 hover:opacity-80"
                        >
                            <span>{node.label}</span>
                            <ExternalLink className="w-3 h-3 shrink-0"/>
                        </a>
                    );
                }
                return (
                    <Link
                        key={key}
                        href={node.href}
                        className="font-bold text-[#003876] dark:text-blue-400 underline underline-offset-4 hover:opacity-80"
                    >
                        {node.label}
                    </Link>
                );
            case "wikilink":
                return (
                    <Link
                        key={key}
                        href={`/wiki/${encodeURIComponent(node.slug)}`}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/15 dark:hover:bg-blue-500/25 border border-blue-200/80 dark:border-blue-400/25 text-[0.9em] font-extrabold text-[#003876] dark:text-blue-300 transition-colors align-baseline"
                    >
                        <BookOpen className="w-3 h-3 shrink-0"/>
                        <span>{node.label}</span>
                    </Link>
                );
            case "routelink":
                return (
                    <Link
                        key={key}
                        href={buildMapUrl(node.routeNo, node.cityCode)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-full bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 border border-emerald-200/80 dark:border-emerald-400/25 text-[0.85em] font-black text-emerald-800 dark:text-emerald-300 transition-colors align-baseline"
                    >
                        <Bus className="w-3 h-3 shrink-0"/>
                        <span>{node.label}</span>
                    </Link>
                );
            case "roadview":
                return (
                    <a
                        key={key}
                        href={getKakaoRoadviewUrl(node.lat, node.lng)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-0.5 mx-0.5 rounded-full bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/15 dark:hover:bg-amber-500/25 border border-amber-200/80 dark:border-amber-400/25 text-[0.85em] font-extrabold text-amber-800 dark:text-amber-300 transition-colors align-baseline"
                    >
                        <Camera className="w-3 h-3 shrink-0"/>
                        <span>{node.label}</span>
                    </a>
                );
        }
    });
}

const CALLOUT_STYLES: Record<
    WikiCalloutTone,
    { container: string; title: string; icon: React.ReactNode; label: string }
> = {
    NOTE: {
        container: "bg-slate-50/90 dark:bg-white/[0.04] border-slate-200/80 dark:border-white/15 text-slate-700 dark:text-slate-200",
        title: "text-slate-900 dark:text-white",
        icon: <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0"/>,
        label: "참고",
    },
    TIP: {
        container: "bg-emerald-50/85 dark:bg-emerald-950/30 border-emerald-200/80 dark:border-emerald-500/30 text-emerald-950 dark:text-emerald-100",
        title: "text-emerald-800 dark:text-emerald-300",
        icon: <Lightbulb className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0"/>,
        label: "꿀팁",
    },
    IMPORTANT: {
        container: "bg-blue-50/85 dark:bg-blue-950/35 border-blue-200/80 dark:border-blue-500/30 text-blue-950 dark:text-blue-100",
        title: "text-[#003876] dark:text-blue-300",
        icon: <Info className="w-4 h-4 text-[#003876] dark:text-blue-400 shrink-0"/>,
        label: "중요",
    },
    WARNING: {
        container: "bg-amber-50/90 dark:bg-amber-950/30 border-amber-200/90 dark:border-amber-500/30 text-amber-950 dark:text-amber-100",
        title: "text-amber-800 dark:text-amber-300",
        icon: <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0"/>,
        label: "주의",
    },
};

function renderBlock(block: WikiBlockNode, idx: number): React.ReactNode {
    const key = `block-${idx}`;
    switch (block.type) {
        case "heading": {
            const cls =
                block.level === 1
                    ? "text-lg sm:text-xl font-black tracking-tight text-slate-900 dark:text-white pt-3 pb-1 border-b border-slate-200/80 dark:border-white/10 scroll-mt-20"
                    : block.level === 2
                        ? "text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white pt-3 pb-1 border-b border-slate-200/70 dark:border-white/10 scroll-mt-20"
                        : "text-sm sm:text-base font-black tracking-tight text-slate-800 dark:text-slate-100 pt-2 scroll-mt-20";
            if (block.level === 1) {
                return <h2 key={key} id={block.id} className={cls}>{renderInlineNodes(block.children, key)}</h2>;
            }
            if (block.level === 2) {
                return <h2 key={key} id={block.id} className={cls}>{renderInlineNodes(block.children, key)}</h2>;
            }
            return <h3 key={key} id={block.id} className={cls}>{renderInlineNodes(block.children, key)}</h3>;
        }
        case "paragraph":
            return (
                <p key={key} className="text-xs sm:text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                    {renderInlineNodes(block.children, key)}
                </p>
            );
        case "list":
            if (block.ordered) {
                return (
                    <ol key={key} className="list-decimal pl-5 space-y-1.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                        {block.items.map((item, itemIdx) => (
                            <li key={`${key}-li-${itemIdx}`} className="leading-relaxed">
                                {renderInlineNodes(item, `${key}-li-${itemIdx}`)}
                            </li>
                        ))}
                    </ol>
                );
            }
            return (
                <ul key={key} className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm text-slate-700 dark:text-slate-300">
                    {block.items.map((item, itemIdx) => (
                        <li key={`${key}-li-${itemIdx}`} className="leading-relaxed">
                            {renderInlineNodes(item, `${key}-li-${itemIdx}`)}
                        </li>
                    ))}
                </ul>
            );
        case "blockquote":
            return (
                <blockquote
                    key={key}
                    className="pl-3.5 py-1 border-l-4 border-[#003876]/40 dark:border-blue-400/40 text-xs sm:text-sm text-slate-600 dark:text-slate-300 space-y-1"
                >
                    {block.children.map((line, lIdx) => (
                        <p key={`${key}-q-${lIdx}`}>{renderInlineNodes(line, `${key}-q-${lIdx}`)}</p>
                    ))}
                </blockquote>
            );
        case "callout": {
            const style = CALLOUT_STYLES[block.tone];
            return (
                <div key={key} className={`rounded-2xl border p-3.5 sm:p-4 space-y-1.5 ${style.container}`}>
                    <div className={`flex items-center gap-1.5 text-xs font-black ${style.title}`}>
                        {style.icon}
                        <span>{style.label}</span>
                    </div>
                    <div className="space-y-1 text-xs sm:text-sm leading-relaxed">
                        {block.lines.map((line, lIdx) => (
                            <p key={`${key}-c-${lIdx}`}>{renderInlineNodes(line, `${key}-c-${lIdx}`)}</p>
                        ))}
                    </div>
                </div>
            );
        }
        case "code":
            return (
                <pre
                    key={key}
                    className="p-3.5 rounded-2xl bg-slate-900 text-slate-100 dark:bg-black/60 border border-slate-800 dark:border-white/10 overflow-x-auto text-xs font-mono leading-relaxed"
                >
                    <code>{block.code}</code>
                </pre>
            );
        case "table":
            return (
                <div key={key} className="overflow-x-auto rounded-2xl border border-slate-200/85 dark:border-white/10">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead>
                        <tr className="bg-slate-100/90 dark:bg-white/[0.06] text-slate-800 dark:text-slate-100 font-black">
                            {block.headers.map((header, hIdx) => (
                                <th
                                    key={`${key}-th-${hIdx}`}
                                    className="px-3.5 py-2.5 border-b border-slate-200/80 dark:border-white/10 whitespace-nowrap"
                                >
                                    {renderInlineNodes(header, `${key}-th-${hIdx}`)}
                                </th>
                            ))}
                        </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200/70 dark:divide-white/10">
                        {block.rows.map((row, rIdx) => (
                            <tr key={`${key}-tr-${rIdx}`} className="bg-white dark:bg-transparent hover:bg-slate-50/80 dark:hover:bg-white/[0.03]">
                                {row.map((cell, cIdx) => (
                                    <td key={`${key}-td-${rIdx}-${cIdx}`} className="px-3.5 py-2.5 text-slate-700 dark:text-slate-300">
                                        {renderInlineNodes(cell, `${key}-td-${rIdx}-${cIdx}`)}
                                    </td>
                                ))}
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            );
        case "hr":
            return <hr key={key} className="border-slate-200/80 dark:border-white/10 my-2"/>;
    }
}

export interface WikiMarkdownRendererProps {
    markdown: string;
    showToc?: boolean;
}

export const WikiMarkdownRenderer: React.FC<WikiMarkdownRendererProps> = ({
    markdown,
    showToc = true,
}) => {
    const {blocks, toc} = useMemo(() => parseWikiMarkdown(markdown), [markdown]);

    if (blocks.length === 0) {
        return (
            <p className="text-xs sm:text-sm text-slate-400 dark:text-slate-500 py-4 text-center">
                아직 작성된 위키 본문이 없습니다. 상단 편집 버튼을 눌러 첫 안내 글을 작성해 보세요!
            </p>
        );
    }

    return (
        <div className="space-y-4">
            {showToc && toc.length >= 2 && (
                <nav
                    aria-label="문서 목차"
                    className="p-3.5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-slate-200/80 dark:border-white/10 space-y-1.5"
                >
                    <p className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        목차
                    </p>
                    <ul className="flex flex-wrap gap-x-3 gap-y-1">
                        {toc.map((item) => (
                            <li key={item.id}>
                                <a
                                    href={`#${item.id}`}
                                    className={`text-xs font-bold text-[#003876] dark:text-blue-400 hover:underline ${
                                        item.level === 3 ? "opacity-80" : ""
                                    }`}
                                >
                                    {item.text}
                                </a>
                            </li>
                        ))}
                    </ul>
                </nav>
            )}
            <div className="space-y-3.5">
                {blocks.map((block, idx) => renderBlock(block, idx))}
            </div>
        </div>
    );
};
