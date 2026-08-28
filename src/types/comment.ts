export interface CommentItem {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  routeNo?: string;
  ipHash?: string;
}

export interface CommentsDataset {
  updatedAt: string;
  comments: CommentItem[];
}
