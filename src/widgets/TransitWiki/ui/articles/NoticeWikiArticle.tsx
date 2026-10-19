"use client";

import React, {useState} from "react";
import {
    ChevronLeft,
    ChevronRight,
    Download,
    ExternalLink,
    Eye,
    Paperclip,
    RefreshCw,
    Search,
    X,
} from "lucide-react";
import {useNoticeDetail, useNoticeList} from "@entities/notice/hooks";
import {
    WikiCallout,
    WikiInfobox,
    WikiLink,
    WikiSection,
    WikiToc,
} from "../WikiPrimitives";

interface NoticeWikiArticleProps {
    noticeId?: string;
    onNavigate: (docId: string) => void;
}

export const NoticeWikiArticle: React.FC<NoticeWikiArticleProps> = ({
    noticeId,
    onNavigate,
}) => {
    if (noticeId) {
        return <NoticeDetailWikiView noticeId={noticeId} onNavigate={onNavigate} />;
    }
    return <NoticeListWikiView onNavigate={onNavigate} />;
};

function NoticeListWikiView({onNavigate}: { onNavigate: (docId: string) => void }) {
    const [page, setPage] = useState(1);
    const [searchInput, setSearchInput] = useState("");
    const [activeSearch, setActiveSearch] = useState("");

    const {data, loading, error, refresh} = useNoticeList(page, activeSearch);
    const notices = data?.notices ?? [];
    const totalPages =
        data?.totalPages || (data?.totalCount ? Math.ceil(data.totalCount / 10) : 1);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setActiveSearch(searchInput);
        setPage(1);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col-reverse md:flex-row items-start justify-between gap-4">
                <div className="w-full md:w-auto space-y-3 flex-1">
                    <WikiCallout tone="amber">
                        이 문서는 <strong>원주시 교통정보센터(ITS)</strong>에서 게시하는 시내버스 노선 변경, 시간표 개편, 도로 통제 우회 운행 공지사항을 아카이빙한 위키 문서입니다. 각 공지 제목을 클릭하면 상세 문서로 이동합니다.
                    </WikiCallout>
                    <WikiToc
                        items={[
                            {id: "list", number: "1", title: "공지사항 목록 및 검색"},
                        ]}
                    />
                </div>

                <WikiInfobox
                    badge="OFFICIAL TRANSIT NOTICES"
                    title="원주시 교통정보센터/공지사항"
                    subtitle="원주시 시내버스 공식 운행 공지"
                    headerClassName="bg-amber-600 text-white"
                    rows={[
                        {label: "정보 출처", value: "원주시 교통정보센터 (ITS)"},
                        {
                            label: "총 게시물",
                            value: data?.totalCount ? `${data.totalCount}건` : "실시간 연동",
                        },
                        {
                            label: "공식 홈페이지",
                            value: (
                                <a
                                    href="http://its.wonju.go.kr/center/notice.do"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold hover:underline"
                                >
                                    <span>원주시 ITS 바로가기</span>
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            ),
                        },
                    ]}
                />
            </div>

            <WikiSection
                id="list"
                number="1"
                title="공지사항 목록 및 검색"
                rightBadge={
                    <button
                        type="button"
                        onClick={() => refresh()}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-xs font-bold text-slate-600 dark:text-slate-300 cursor-pointer"
                    >
                        <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
                        <span>새로고침</span>
                    </button>
                }
            >
                {/* Search Form */}
                <form
                    onSubmit={handleSearch}
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-[#161a25] border border-slate-200 dark:border-slate-800"
                >
                    <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            placeholder="공지 제목 검색 (예: 방학, 우회, 34번, 시간표)"
                            className="w-full pl-8 pr-8 py-1.5 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#11141c] text-slate-900 dark:text-white focus:outline-none focus:border-amber-500"
                        />
                        {searchInput && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchInput("");
                                    setActiveSearch("");
                                    setPage(1);
                                }}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                    <button
                        type="submit"
                        className="px-3 py-1.5 rounded bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-extrabold cursor-pointer"
                    >
                        검색
                    </button>
                </form>

                {/* Notices Table */}
                <div className="overflow-x-auto rounded-lg border border-slate-300 dark:border-slate-700">
                    <table className="w-full border-collapse text-left text-xs">
                        <thead>
                            <tr className="bg-slate-100 dark:bg-[#1b202e] text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 font-extrabold">
                                <th className="py-2.5 px-3 w-18 text-center border-r border-slate-300 dark:border-slate-700">
                                    번호
                                </th>
                                <th className="py-2.5 px-3 border-r border-slate-300 dark:border-slate-700">
                                    제목
                                </th>
                                <th className="py-2.5 px-3 w-16 text-center border-r border-slate-300 dark:border-slate-700">
                                    첨부
                                </th>
                                <th className="py-2.5 px-3 w-24 text-center border-r border-slate-300 dark:border-slate-700">
                                    작성일
                                </th>
                                <th className="py-2.5 px-3 w-18 text-center">조회수</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#12151e]">
                            {loading && notices.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-slate-400">
                                        공지사항 목록을 불러오는 중입니다...
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-rose-500">
                                        공지사항을 불러오지 못했습니다.
                                    </td>
                                </tr>
                            ) : notices.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-8 text-center text-slate-400">
                                        검색된 공지사항이 없습니다.
                                    </td>
                                </tr>
                            ) : (
                                notices.map((notice) => (
                                    <tr
                                        key={notice.id}
                                        className="hover:bg-slate-50 dark:hover:bg-white/[0.02]"
                                    >
                                        <td className="py-2.5 px-2.5 text-center border-r border-slate-200 dark:border-slate-800">
                                            {notice.isNotice ? (
                                                <span className="px-1.5 py-0.5 rounded bg-amber-500 text-white text-[10px] font-black">
                                                    공지
                                                </span>
                                            ) : (
                                                <span className="font-mono text-slate-400">
                                                    #{notice.num}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3 border-r border-slate-200 dark:border-slate-800">
                                            <WikiLink
                                                docId={`notice:${notice.id}`}
                                                onNavigate={onNavigate}
                                            >
                                                {notice.title}
                                            </WikiLink>
                                        </td>
                                        <td className="py-2.5 px-2 text-center border-r border-slate-200 dark:border-slate-800">
                                            {notice.hasFile ? (
                                                <Paperclip className="w-3.5 h-3.5 mx-auto text-amber-600 dark:text-amber-400" />
                                            ) : (
                                                <span className="text-slate-300 dark:text-slate-700">
                                                    -
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-2.5 text-center font-mono text-slate-500 border-r border-slate-200 dark:border-slate-800">
                                            {notice.date}
                                        </td>
                                        <td className="py-2.5 px-2.5 text-center font-mono text-slate-500">
                                            <span className="inline-flex items-center gap-1">
                                                <Eye className="w-3 h-3 opacity-60" />
                                                {notice.views}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-3 pt-2">
                        <button
                            type="button"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#151821] text-xs font-bold disabled:opacity-40 cursor-pointer"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            <span>이전</span>
                        </button>
                        <span className="text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                            {page} / {totalPages} 페이지
                        </span>
                        <button
                            type="button"
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#151821] text-xs font-bold disabled:opacity-40 cursor-pointer"
                        >
                            <span>다음</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </WikiSection>
        </div>
    );
}

function NoticeDetailWikiView({
    noticeId,
    onNavigate,
}: {
    noticeId: string;
    onNavigate: (docId: string) => void;
}) {
    const {notice, loading, error} = useNoticeDetail(noticeId);

    if (loading) {
        return (
            <div className="py-12 text-center text-slate-400 text-xs">
                공지사항 본문 문서를 불러오는 중입니다...
            </div>
        );
    }

    if (error || !notice) {
        return (
            <div className="space-y-4 py-8 text-center">
                <p className="text-sm text-rose-500 font-bold">
                    해당 공지사항 문서를 찾을 수 없거나 불러오지 못했습니다.
                </p>
                <WikiLink docId="notices" onNavigate={onNavigate} variant="badge">
                    원주시 교통정보센터/공지사항 목록으로 돌아가기
                </WikiLink>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col-reverse md:flex-row items-start justify-between gap-4">
                <div className="w-full md:w-auto space-y-3 flex-1">
                    <WikiCallout tone="amber">
                        <strong>{notice.title}</strong> — 원주시 교통정보센터 공식 공지 문서입니다.
                    </WikiCallout>
                    <WikiToc
                        items={[
                            {id: "content", number: "1", title: "공지 본문"},
                            ...(notice.files && notice.files.length > 0
                                ? [{id: "files", number: "2", title: "첨부 파일"}]
                                : []),
                            {id: "nav", number: notice.files?.length ? "3" : "2", title: "이전 · 다음 공지 문서"},
                        ]}
                    />
                </div>

                <WikiInfobox
                    badge={`NOTICE #${noticeId}`}
                    title={notice.title}
                    headerClassName="bg-amber-600 text-white"
                    rows={[
                        {label: "작성 부서", value: notice.writer || "원주시 교통정보센터"},
                        {label: "등록일", value: notice.date},
                        {label: "조회수", value: `${notice.views}회`},
                        {
                            label: "원문 링크",
                            value: (
                                <a
                                    href={`http://its.wonju.go.kr/center/noticeView.do?bdIdx=${noticeId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 font-bold hover:underline"
                                >
                                    <span>ITS 원문 보기</span>
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            ),
                        },
                    ]}
                />
            </div>

            <WikiSection id="content" number="1" title="공지 본문">
                <div className="p-4 sm:p-5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#12151e]">
                    <div
                        className="prose dark:prose-invert max-w-none break-words overflow-x-auto text-xs sm:text-sm leading-relaxed"
                        dangerouslySetInnerHTML={{__html: notice.content}}
                    />
                </div>
            </WikiSection>

            {notice.files && notice.files.length > 0 && (
                <WikiSection
                    id="files"
                    number="2"
                    title={`첨부 파일 (${notice.files.length})`}
                >
                    <div className="overflow-x-auto rounded-lg border border-slate-300 dark:border-slate-700">
                        <table className="w-full border-collapse text-left text-xs">
                            <thead>
                                <tr className="bg-slate-100 dark:bg-[#1b202e] text-slate-700 dark:text-slate-200 border-b border-slate-300 dark:border-slate-700 font-extrabold">
                                    <th className="py-2 px-3 border-r border-slate-300 dark:border-slate-700">
                                        파일명
                                    </th>
                                    <th className="py-2 px-3 w-28 text-center">다운로드</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#12151e]">
                                {notice.files.map((file, idx) => (
                                    <tr key={idx}>
                                        <td className="py-2 px-3 border-r border-slate-200 dark:border-slate-800 font-medium">
                                            {file.name}
                                        </td>
                                        <td className="py-2 px-3 text-center">
                                            <a
                                                href={file.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                download
                                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px]"
                                            >
                                                <Download className="w-3 h-3" />
                                                <span>받기</span>
                                            </a>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </WikiSection>
            )}

            <WikiSection
                id="nav"
                number={notice.files && notice.files.length > 0 ? "3" : "2"}
                title="이전 · 다음 공지 문서"
            >
                <div className="overflow-x-auto rounded-lg border border-slate-300 dark:border-slate-700">
                    <table className="w-full border-collapse text-left text-xs">
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-[#12151e]">
                            {notice.prevId && (
                                <tr>
                                    <th className="w-24 py-2 px-3 bg-slate-100 dark:bg-[#1b202e] font-bold border-r border-slate-200 dark:border-slate-800">
                                        이전 글
                                    </th>
                                    <td className="py-2 px-3">
                                        <WikiLink
                                            docId={`notice:${notice.prevId}`}
                                            onNavigate={onNavigate}
                                        >
                                            {notice.prevTitle || `#${notice.prevId}`}
                                        </WikiLink>
                                    </td>
                                </tr>
                            )}
                            {notice.nextId && (
                                <tr>
                                    <th className="w-24 py-2 px-3 bg-slate-100 dark:bg-[#1b202e] font-bold border-r border-slate-200 dark:border-slate-800">
                                        다음 글
                                    </th>
                                    <td className="py-2 px-3">
                                        <WikiLink
                                            docId={`notice:${notice.nextId}`}
                                            onNavigate={onNavigate}
                                        >
                                            {notice.nextTitle || `#${notice.nextId}`}
                                        </WikiLink>
                                    </td>
                                </tr>
                            )}
                            <tr>
                                <th className="w-24 py-2 px-3 bg-slate-100 dark:bg-[#1b202e] font-bold border-r border-slate-200 dark:border-slate-800">
                                    전체 목록
                                </th>
                                <td className="py-2 px-3">
                                    <WikiLink docId="notices" onNavigate={onNavigate}>
                                        원주시 교통정보센터/공지사항 전체 목록으로 이동
                                    </WikiLink>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </WikiSection>
        </div>
    );
}
