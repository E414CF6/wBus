export interface NoticeItem {
  id: string;
  num: string;
  isNotice: boolean;
  title: string;
  hasFile: boolean;
  date: string;
  views: string;
}

export interface NoticeAttachment {
  url: string;
  name: string;
}

export interface NoticeDetail extends NoticeItem {
  writer: string;
  content: string;
  files: NoticeAttachment[];
  prevId?: string;
  prevTitle?: string;
  nextId?: string;
  nextTitle?: string;
}

export interface NoticeListResponse {
  notices: NoticeItem[];
  totalCount: number;
  page: number;
}
