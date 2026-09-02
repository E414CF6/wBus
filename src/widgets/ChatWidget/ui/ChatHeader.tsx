import React from "react";
import {Flame, Hash, MessageSquare, RotateCw, Search, TrendingUp, X} from "lucide-react";
import {ChatFeedTab, TrendingTag} from "../types";
import {getAvatarGradient} from "../utils/avatarUtils";

interface ChatHeaderProps {
    authorName: string;
    userTag: string;
    activeTab: ChatFeedTab;
    onTabChange: (tab: ChatFeedTab) => void;
    topRankedThreadsCount: number;
    searchQuery: string;
    onSearchChange: (query: string) => void;
    isSearchOpen: boolean;
    onToggleSearch: () => void;
    searchInputRef: React.RefObject<HTMLInputElement | null>;
    onRefresh: (force?: boolean) => Promise<void>;
    isRefreshing?: boolean;
    onOpenProfileModal: () => void;
    trendingTags: TrendingTag[];
    selectedHashtag: string | null;
    onHashtagClick: (tag: string) => void;
    onClearHashtag: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
                                                          authorName,
                                                          userTag,
                                                          activeTab,
                                                          onTabChange,
                                                          topRankedThreadsCount,
                                                          searchQuery,
                                                          onSearchChange,
                                                          isSearchOpen,
                                                          onToggleSearch,
                                                          searchInputRef,
                                                          onRefresh,
                                                          isRefreshing = false,
                                                          onOpenProfileModal,
                                                          trendingTags,
                                                          selectedHashtag,
                                                          onHashtagClick,
                                                          onClearHashtag,
                                                      }) => {
    return (<div
        className="shrink-0 backdrop-blur-2xl bg-white/80 dark:bg-[#111622]/85 rounded-3xl p-3 sm:p-4 border border-slate-200/80 dark:border-white/10 shadow-xs space-y-3">
        {/* Row 1: Title & Action Icons */}
        <div className="flex items-center justify-between gap-2">
            {/* Title & Live Status */}
            <div className="flex items-center gap-2.5 min-w-0">
                <div
                    className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-violet-600 text-white flex items-center justify-center shadow-xs shrink-0">
                    <MessageSquare className="w-4 h-4"/>
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-2">
                        <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
                            스퀘어
                        </h2>
                        <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-black border border-emerald-500/20 shrink-0 whitespace-nowrap">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/>
                                Live Agora
                            </span>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 whitespace-nowrap truncate">
                        실시간 소통 &amp; 제보 광장
                    </p>
                </div>
            </div>

            {/* Top Action Icons (Search, Refresh, Profile) */}
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                {/* Search Toggle */}
                <button
                    type="button"
                    onClick={onToggleSearch}
                    className={`p-2 rounded-2xl transition-all cursor-pointer active:scale-95 ${isSearchOpen || searchQuery ? "bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30" : "bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300"}`}
                    title="검색"
                >
                    <Search className="w-4 h-4"/>
                </button>

                {/* Refresh Button */}
                <button
                    type="button"
                    onClick={() => onRefresh(true)}
                    disabled={isRefreshing}
                    className="p-2 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-300 transition-all cursor-pointer disabled:opacity-50 active:scale-95"
                    title="새로고침"
                >
                    <RotateCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-blue-500" : ""}`}/>
                </button>

                {/* Profile & Radar Trigger Button */}
                <button
                    type="button"
                    onClick={onOpenProfileModal}
                    className="flex items-center gap-1.5 p-1 sm:px-2 sm:py-1 rounded-2xl bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 text-slate-700 dark:text-slate-300 transition-all cursor-pointer border border-slate-200/50 dark:border-white/5 active:scale-95"
                    title="내 프로필 및 레이더 열기"
                >
                    <div
                        className={`w-6 h-6 rounded-xl bg-gradient-to-tr ${getAvatarGradient(authorName, userTag)} text-white flex items-center justify-center font-black text-[11px] shadow-xs shrink-0`}
                    >
                        {authorName.charAt(0) || "?"}
                    </div>
                </button>
            </div>
        </div>

        {/* Row 2: Feed Mode Tabs (Separated row so mobile never squeezes title) */}
        <div className="flex items-center">
            <div
                className="flex items-center p-0.5 rounded-2xl bg-slate-100 dark:bg-white/5 border border-slate-200/50 dark:border-white/5 w-full sm:w-auto">
                <button
                    type="button"
                    onClick={() => onTabChange("LATEST")}
                    className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center justify-center ${activeTab === "LATEST" ? "bg-white dark:bg-white/15 text-blue-600 dark:text-white shadow-xs" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"}`}
                >
                    최신순
                </button>
                <button
                    type="button"
                    onClick={() => onTabChange("HOT")}
                    className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${activeTab === "HOT" ? "bg-rose-500 text-white shadow-xs" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"}`}
                >
                    <Flame className="w-3 h-3"/>
                    <span>인기</span>
                    {topRankedThreadsCount > 0 && (<span
                        className={`text-[10px] font-mono font-bold px-1 py-0.2 rounded-full ${activeTab === "HOT" ? "bg-white/20 text-white" : "bg-rose-500/10 text-rose-500 dark:text-rose-400"}`}
                    >
                                {topRankedThreadsCount}
                            </span>)}
                </button>
                <button
                    type="button"
                    onClick={() => onTabChange("MINE")}
                    className={`flex-1 sm:flex-initial px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center justify-center ${activeTab === "MINE" ? "bg-indigo-600 text-white shadow-xs" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"}`}
                >
                    내 글
                </button>
            </div>
        </div>

        {/* Search Input Accordion */}
        {isSearchOpen && (<div className="relative w-full pt-1 animate-slideDown">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="닉네임, #해시태그, 키워드 검색..."
                className="w-full pl-9 pr-8 py-2 text-xs rounded-2xl bg-slate-100/90 dark:bg-white/5 border border-transparent focus:border-blue-500 text-slate-900 dark:text-white outline-none font-medium transition-all shadow-inner"
            />
            {searchQuery && (<button
                onClick={() => onSearchChange("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
            >
                <X className="w-3.5 h-3.5"/>
            </button>)}
        </div>)}

        {/* Mobile Only: Horizontal Trending Hashtags Strip */}
        <div className="lg:hidden pt-2 border-t border-slate-100 dark:border-white/5">
            <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-0.5">
                    <span className="text-[10px] font-bold text-slate-400 flex items-center gap-0.5 shrink-0">
                        <TrendingUp className="w-3 h-3 text-blue-500"/> 트렌드:
                    </span>
                {trendingTags.length > 0 ? (trendingTags.map((t, idx) => (<button
                    key={t.tag}
                    type="button"
                    onClick={() => onHashtagClick(t.tag)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold whitespace-nowrap transition-all cursor-pointer active:scale-95 ${selectedHashtag === t.tag ? "bg-blue-600 text-white shadow-xs" : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:text-blue-600"}`}
                >
                    <span className="text-[9px] font-mono opacity-60">#{idx + 1}</span>
                    <span>{t.tag}</span>
                    <span className="text-[9px] font-mono opacity-70">({t.count})</span>
                </button>))) : (<span className="text-[10px] text-slate-400">#해시태그로 글을 작성해보세요</span>)}
            </div>
        </div>

        {/* Active Hashtag Filter Banner */}
        {selectedHashtag && (<div
            className="flex items-center justify-between p-2 rounded-2xl bg-blue-50/80 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/40 text-blue-600 dark:text-blue-400 animate-slideDown">
            <div className="flex items-center gap-1.5 text-xs font-bold">
                <Hash className="w-3.5 h-3.5"/>
                <span>
                            <strong>{selectedHashtag}</strong> 태그가 포함된 스레드 모아보기
                        </span>
            </div>
            <button
                type="button"
                onClick={onClearHashtag}
                className="p-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 cursor-pointer"
                title="필터 해제"
            >
                <X className="w-3.5 h-3.5"/>
            </button>
        </div>)}
    </div>);
};
