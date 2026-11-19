export {getDb, closeDb, isDatabaseConfigured, type WikiDatabase} from "./client";
export {
    wikiPages,
    wikiRevisions,
    wikiDiscussionThreads,
    wikiDiscussionComments,
    type WikiPageRow,
    type WikiPageInsert,
    type WikiRevisionRow,
    type WikiRevisionInsert,
    type WikiDiscussionThreadRow,
    type WikiDiscussionThreadInsert,
    type WikiDiscussionCommentRow,
    type WikiDiscussionCommentInsert,
} from "./schema";
