import {describe, expect, it} from "vitest";
import {type CommentItem, type CommentRow, commentToRow, rowToComment} from "./types";

describe("comment types and transformers", () => {
    describe("rowToComment", () => {
        it("transforms a complete database row to CommentItem", () => {
            const row: CommentRow = {
                id: "comment-1",
                author: "익명",
                author_tag: "1234",
                content: "안녕하세요",
                created_at: "2026-09-10T00:00:00.000Z",
                likes: 5,
                parent_id: "parent-1",
                reply_to_author: "이전작성자",
                reply_to_author_tag: "#5678",
                is_deleted: false,
                ip_hash: "hash123",
            };

            const comment = rowToComment(row);

            expect(comment).toEqual({
                id: "comment-1",
                author: "익명",
                authorTag: "1234",
                content: "안녕하세요",
                createdAt: "2026-09-10T00:00:00.000Z",
                likes: 5,
                parentId: "parent-1",
                replyToAuthor: "이전작성자",
                replyToAuthorTag: "5678",
                isDeleted: false,
                ipHash: "hash123",
            });
        });

        it("cleans leading '#' from tags and handles null/undefined defaults", () => {
            const row: CommentRow = {
                id: "comment-2",
                author: "익명",
                author_tag: "###abcd",
                content: "내용",
                created_at: "2026-09-10T00:00:00.000Z",
                likes: null,
                parent_id: null,
                reply_to_author: null,
                reply_to_author_tag: null,
                is_deleted: null,
                ip_hash: null,
            };

            const comment = rowToComment(row);

            expect(comment.authorTag).toBe("abcd");
            expect(comment.likes).toBe(0);
            expect(comment.parentId).toBeUndefined();
            expect(comment.replyToAuthor).toBeUndefined();
            expect(comment.replyToAuthorTag).toBeUndefined();
            expect(comment.isDeleted).toBe(false);
            expect(comment.ipHash).toBeUndefined();
        });
    });

    describe("commentToRow", () => {
        it("converts CommentItem to db CommentRow", () => {
            const item: CommentItem = {
                id: "comment-3",
                author: "익명2",
                authorTag: "##xyz",
                content: "댓글 내용",
                createdAt: "2026-09-10T01:00:00.000Z",
                likes: 3,
                parentId: "parent-3",
                replyToAuthor: "원작성자",
                replyToAuthorTag: "#xyz2",
                isDeleted: false,
                ipHash: "hash321",
            };

            const row = commentToRow(item);

            expect(row).toEqual({
                id: "comment-3",
                author: "익명2",
                author_tag: "xyz",
                content: "댓글 내용",
                created_at: "2026-09-10T01:00:00.000Z",
                likes: 3,
                parent_id: "parent-3",
                reply_to_author: "원작성자",
                reply_to_author_tag: "xyz2",
                is_deleted: false,
                ip_hash: "hash321",
            });
        });

        it("handles undefined optional fields by setting nulls", () => {
            const item: CommentItem = {
                id: "comment-4",
                author: "익명3",
                content: "내용",
                createdAt: "2026-09-10T02:00:00.000Z",
            };

            const row = commentToRow(item);

            expect(row.author_tag).toBeNull();
            expect(row.parent_id).toBeNull();
            expect(row.reply_to_author).toBeNull();
            expect(row.reply_to_author_tag).toBeNull();
            expect(row.likes).toBe(0);
            expect(row.is_deleted).toBe(false);
            expect(row.ip_hash).toBeNull();
        });
    });
});
