import type {NoticeDetail, NoticeListResponse} from "./types";
import {fetchAPI} from "@shared/api/fetchAPI";

export async function getNoticeList(page = 1, searchText = "", searchGb = "title"): Promise<NoticeListResponse> {
    const params = new URLSearchParams();
    if (page > 1) params.set("page", String(page));
    if (searchText) {
        params.set("searchText", searchText);
        params.set("searchGb", searchGb);
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await fetchAPI<{
        success?: boolean; data?: NoticeListResponse
    } | NoticeListResponse>(`/api/notice${query}`);
    if (res && typeof res === "object" && "data" in res && res.data) {
        return res.data;
    }
    return res as NoticeListResponse;
}

export async function getNoticeDetail(id: string): Promise<NoticeDetail> {
    const res = await fetchAPI<{
        success?: boolean; data?: NoticeDetail
    } | NoticeDetail>(`/api/notice/${encodeURIComponent(id)}`);
    if (res && typeof res === "object" && "data" in res && res.data) {
        return res.data;
    }
    return res as NoticeDetail;
}
