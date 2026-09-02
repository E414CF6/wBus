"use client";

import React, {useState} from "react";
import {MessageCircle, Sparkles} from "lucide-react";

import {useChatActions} from "./hooks/useChatActions";
import {useChatFeed} from "./hooks/useChatFeed";
import {useChatIdentity} from "./hooks/useChatIdentity";
import {ModalTab, SquareProfileModal} from "./SquareProfileModal";
import {ChatViewProps} from "./types";
import {ChatComposer} from "./ui/ChatComposer";
import {ChatHeader} from "./ui/ChatHeader";
import {ChatSidebar} from "./ui/ChatSidebar";
import {ThreadCard} from "./ui/ThreadCard";

export const ChatView: React.FC<ChatViewProps> = ({
                                                      comments,
                                                      onAddComment,
                                                      onLikeComment,
                                                      onDeleteComment,
                                                      onRefresh,
                                                      isRefreshing = false,
                                                  }) => {
    // 1. User Identity Management
    const {authorName, userTag, handleRerollNickname} = useChatIdentity();

    // 2. Action Handlers (Posting, Liking, Deleting, Sharing, Cooldown, Toast)
    const actions = useChatActions({
        authorName,
        userTag,
        onAddComment,
        onLikeComment,
        onDeleteComment,
    });

    // 3. Feed Hierarchy, Search, Filtering & Trending Computation
    const feed = useChatFeed({
        comments,
        userTag,
        myCommentIds: actions.myCommentIds,
    });

    // 4. Modal State
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [profileModalInitialTab, setProfileModalInitialTab] = useState<ModalTab>("OVERVIEW");

    return (
        <div className="w-full flex-1 min-h-0 flex flex-col relative animate-fadeIn">
            {/* Toast Notification */}
            {actions.toastMessage && (
                <div
                    className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-slate-900/90 dark:bg-white/95 text-white dark:text-slate-900 text-xs font-black shadow-2xl backdrop-blur-md animate-slideDown flex items-center gap-2 border border-white/10 max-w-[90vw] text-center">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 dark:text-amber-500 shrink-0"/>
                    <span>{actions.toastMessage}</span>
                </div>
            )}

            {/* Profile & Radar Modal */}
            <SquareProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                initialTab={profileModalInitialTab}
                authorName={authorName}
                userTag={userTag}
                onRerollNickname={() => handleRerollNickname(actions.showToast)}
                myTotalPostsCount={feed.myTotalPostsCount}
                likedCount={actions.likedCommentIds.size}
                onSelectMyPosts={() => {
                    feed.setActiveTab("MINE");
                    setIsProfileModalOpen(false);
                }}
                trendingTags={feed.trendingTags}
                selectedHashtag={feed.selectedHashtag}
                onSelectHashtag={feed.handleHashtagClick}
                topRankedThreads={feed.topRankedThreads}
                onSelectThread={actions.handleScrollToThread}
            />

            {/* Main Responsive Grid Layout (Main Feed Stream + Desktop Radar Sidebar) */}
            <div className="w-full flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 items-start">
                {/* 1. PRIMARY TIMELINE COLUMN (Left / Center) */}
                <div className="lg:col-span-8 flex flex-col gap-3 min-h-0 h-full">
                    {/* Header Controls Bar */}
                    <ChatHeader
                        authorName={authorName}
                        userTag={userTag}
                        activeTab={feed.activeTab}
                        onTabChange={feed.setActiveTab}
                        topRankedThreadsCount={feed.topRankedThreads.length}
                        searchQuery={feed.searchQuery}
                        onSearchChange={feed.setSearchQuery}
                        isSearchOpen={feed.isSearchOpen}
                        onToggleSearch={() => {
                            const next = !feed.isSearchOpen;
                            feed.setIsSearchOpen(next);
                            if (next) {
                                setTimeout(() => feed.searchInputRef.current?.focus(), 100);
                            }
                        }}
                        searchInputRef={feed.searchInputRef}
                        onRefresh={onRefresh}
                        isRefreshing={isRefreshing}
                        onOpenProfileModal={() => {
                            setProfileModalInitialTab("OVERVIEW");
                            setIsProfileModalOpen(true);
                        }}
                        trendingTags={feed.trendingTags}
                        selectedHashtag={feed.selectedHashtag}
                        onHashtagClick={feed.handleHashtagClick}
                        onClearHashtag={() => feed.setSelectedHashtag(null)}
                    />

                    {/* Timeline Stream Box (Scrollable) */}
                    <div
                        className="flex-1 min-h-0 backdrop-blur-2xl bg-white/80 dark:bg-[#111622]/85 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-xs overflow-y-auto custom-scrollbar p-3.5 sm:p-5 space-y-4">
                        {/* Inline Seamless Composer Card */}
                        <ChatComposer
                            authorName={authorName}
                            userTag={userTag}
                            composerContent={actions.composerContent}
                            isComposerExpanded={actions.isComposerExpanded}
                            isSubmitting={actions.isSubmitting}
                            cooldown={actions.cooldown}
                            textareaRef={actions.textareaRef}
                            onTextareaChange={actions.handleTextareaChange}
                            onExpand={() => actions.setIsComposerExpanded(true)}
                            onInsertHashtag={actions.handleInsertHashtag}
                            onRerollNickname={() => handleRerollNickname(actions.showToast)}
                            onOpenProfileModal={() => setIsProfileModalOpen(true)}
                            onSubmit={actions.handlePostThread}
                        />

                        {/* Thread Cards Feed */}
                        {feed.filteredThreads.length === 0 ? (
                            <div className="py-20 text-center space-y-3">
                                <div
                                    className="w-12 h-12 rounded-3xl bg-slate-100 dark:bg-white/5 text-slate-400 mx-auto flex items-center justify-center">
                                    <MessageCircle className="w-6 h-6"/>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-black text-slate-700 dark:text-slate-300">
                                        {feed.selectedHashtag
                                            ? `${feed.selectedHashtag} 관련 이야기가 없습니다.`
                                            : feed.activeTab === "MINE"
                                                ? "내가 작성한 글이 아직 없습니다."
                                                : "등록된 이야기가 없습니다."}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                        {feed.selectedHashtag ? (
                                            <button
                                                onClick={() => feed.setSelectedHashtag(null)}
                                                className="text-blue-500 font-bold underline cursor-pointer"
                                            >
                                                모든 스레드 보기
                                            </button>
                                        ) : (
                                            "상단 입력창에서 첫 번째 스퀘어 이야기를 남겨보세요!"
                                        )}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            feed.filteredThreads.map((thread) => {
                                const threadReplies = feed.repliesByThreadId[thread.id] || [];
                                const isLiked = actions.likedCommentIds.has(thread.id);
                                const isReplyOpen = actions.activeReplyParentId === thread.id;
                                const isMine = feed.isMyComment(thread);

                                return (
                                    <ThreadCard
                                        key={thread.id}
                                        thread={thread}
                                        replies={threadReplies}
                                        isLiked={isLiked}
                                        isMine={isMine}
                                        isReplyOpen={isReplyOpen}
                                        deletingId={actions.deletingId}
                                        likedCommentIds={actions.likedCommentIds}
                                        inlineReplyTarget={actions.inlineReplyTarget}
                                        inlineReplyContent={actions.inlineReplyContent}
                                        isSubmittingReply={actions.isSubmittingReply}
                                        cooldown={actions.cooldown}
                                        inlineReplyTextareaRef={actions.inlineReplyTextareaRef}
                                        isMyComment={feed.isMyComment}
                                        onLike={actions.handleLike}
                                        onStartReply={actions.handleStartReply}
                                        onCancelReply={actions.handleCancelReply}
                                        onPostReply={actions.handlePostReply}
                                        onInlineReplyContentChange={actions.handleInlineReplyTextareaChange}
                                        onDelete={actions.handleDelete}
                                        onShare={actions.handleShare}
                                        onHashtagClick={feed.handleHashtagClick}
                                    />
                                );
                            })
                        )}
                    </div>
                </div>

                {/* 2. DESKTOP RADAR & IDENTITY SIDEBAR (Right Column, lg:block) */}
                <ChatSidebar
                    authorName={authorName}
                    userTag={userTag}
                    myTotalPostsCount={feed.myTotalPostsCount}
                    likedCount={actions.likedCommentIds.size}
                    trendingTags={feed.trendingTags}
                    selectedHashtag={feed.selectedHashtag}
                    topRankedThreads={feed.topRankedThreads}
                    onRerollNickname={() => handleRerollNickname(actions.showToast)}
                    onHashtagClick={feed.handleHashtagClick}
                    onClearHashtag={() => feed.setSelectedHashtag(null)}
                    onScrollToThread={actions.handleScrollToThread}
                />
            </div>
        </div>
    );
};
