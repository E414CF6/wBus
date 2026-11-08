"use client";

import {useEffect, useRef} from "react";

export interface UseModalHistoryOptions {
    /**
     * 모달이 열려 있는지 여부
     */
    isOpen: boolean;
    /**
     * 모달 닫기 핸들러
     */
    onClose: () => void;
    /**
     * URL 쿼리 파라미터 값으로 사용할 고유 모달 식별자 (기본: "open")
     * 예: "city", "route", "schedule", "notice", "yonsei-shuttle"
     */
    modalId?: string;
    /**
     * URL 쿼리 파라미터 키 이름 (기본: "modal")
     */
    queryKey?: string;
    /**
     * 브라우저 히스토리(뒤로가기 방지 및 동기화) 활성화 여부 (기본: true)
     */
    enableHistory?: boolean;
}

/**
 * URL에 모달 쿼리스트링을 추가하거나 교체한 새 상대 경로/URL 문자열을 반환합니다.
 */
export function buildModalUrl(currentHref: string, modalId: string, queryKey = "modal"): string {
    const url = new URL(currentHref, "http://localhost");
    url.searchParams.set(queryKey, modalId);
    return url.pathname + url.search + url.hash;
}

/**
 * URL에서 모달 쿼리스트링을 제거한 새 상대 경로/URL 문자열을 반환합니다.
 */
export function removeModalUrlQuery(currentHref: string, queryKey = "modal"): string {
    const url = new URL(currentHref, "http://localhost");
    url.searchParams.delete(queryKey);
    return url.pathname + url.search + url.hash;
}

/**
 * 현재 URL에 특정 모달 쿼리스트링이 활성화되어 있는지 여부를 확인합니다.
 */
export function isModalQueryMatching(currentHref: string, modalId: string, queryKey = "modal"): boolean {
    try {
        const url = new URL(currentHref, "http://localhost");
        return url.searchParams.get(queryKey) === modalId;
    } catch {
        return false;
    }
}

/**
 * 모바일 및 웹 브라우저 환경에서 모달이 열려 있을 때 뒤로가기를 누르면
 * 웹사이트를 이탈하거나 이전 페이지로 이동하지 않고 모달만 닫히도록
 * URL 쿼리스트링과 History API(pushState/popstate)를 양방향 동기화하는 훅
 */
export function useModalHistory({
                                    isOpen,
                                    onClose,
                                    modalId = "open",
                                    queryKey = "modal",
                                    enableHistory = true,
                                }: UseModalHistoryOptions) {
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    }, [onClose]);

    const hasPushedRef = useRef(false);
    const isPopstateClosingRef = useRef(false);

    // 모달 열림: URL에 쿼리스트링 추가 및 popstate 이벤트 리스너 등록
    useEffect(() => {
        if (!isOpen || !enableHistory || typeof window === "undefined") return;

        const key = queryKey;
        const value = modalId || "open";

        try {
            const currentUrl = new URL(window.location.href);
            const currentVal = currentUrl.searchParams.get(key);

            if (currentVal !== value) {
                const targetUrl = buildModalUrl(window.location.href, value, key);
                window.history.pushState(
                    {modalId: value, isWbusModal: true},
                    "",
                    targetUrl
                );
                hasPushedRef.current = true;
            }
        } catch {
            // URL 파싱이나 pushState가 제한된 환경 예외 무시
        }

        const handlePopState = () => {
            try {
                const nextUrl = new URL(window.location.href);
                const nextVal = nextUrl.searchParams.get(key);
                if (nextVal !== value) {
                    // 뒤로가기 제스처 또는 브라우저 백 버튼으로 인해 쿼리스트링이 이전 상태로 변경됨
                    isPopstateClosingRef.current = true;
                    hasPushedRef.current = false;
                    onCloseRef.current();
                }
            } catch {
                isPopstateClosingRef.current = true;
                hasPushedRef.current = false;
                onCloseRef.current();
            }
        };

        window.addEventListener("popstate", handlePopState);
        return () => {
            window.removeEventListener("popstate", handlePopState);
        };
    }, [isOpen, enableHistory, modalId, queryKey]);

    // 모달 닫힘: 사용자가 UI(X 버튼, 배경 터치 등)로 닫았을 때 브라우저 히스토리 원상복구
    useEffect(() => {
        if (!isOpen) {
            if (hasPushedRef.current && !isPopstateClosingRef.current) {
                hasPushedRef.current = false;
                if (typeof window !== "undefined") {
                    // 현재 URL에 이 모달 쿼리 파라미터가 그대로 남아 있는 경우에만(단순 닫기/취소) history.back() 수행
                    // 만약 사용자가 모달에서 항목(노선, 지역 등)을 선택하여 이미 새 URL로 이동/교체(replaceState/pushState)된 경우,
                    // history.back()을 호출하면 방금 선택한 변경사항이 직전 URL로 롤백되어 버리므로 호출하지 않음!
                    const isStillOnModal = isModalQueryMatching(
                        window.location.href,
                        modalId || "open",
                        queryKey
                    );
                    if (isStillOnModal) {
                        try {
                            window.history.back();
                        } catch {
                            const cleanUrl = removeModalUrlQuery(window.location.href, queryKey);
                            window.history.replaceState(null, "", cleanUrl);
                        }
                    } else {
                        // 이미 새 URL로 전환된 경우 혹시 남아있을 수 있는 modal 파라미터만 정리
                        try {
                            const currentUrl = new URL(window.location.href);
                            if (currentUrl.searchParams.has(queryKey)) {
                                const cleanUrl = removeModalUrlQuery(window.location.href, queryKey);
                                window.history.replaceState(null, "", cleanUrl);
                            }
                        } catch {
                            // Ignore
                        }
                    }
                }
            } else if (!hasPushedRef.current && !isPopstateClosingRef.current) {
                // pushState를 수행하지 않았던 경우(예: 직접 URL로 진입) 모달이 닫히면 URL 쿼리 파라미터만 정리
                if (typeof window !== "undefined") {
                    try {
                        const currentUrl = new URL(window.location.href);
                        if (currentUrl.searchParams.get(queryKey) === (modalId || "open")) {
                            const cleanUrl = removeModalUrlQuery(window.location.href, queryKey);
                            window.history.replaceState(null, "", cleanUrl);
                        }
                    } catch {
                        // Ignore
                    }
                }
            }
            isPopstateClosingRef.current = false;
        } else {
            isPopstateClosingRef.current = false;
        }
    }, [isOpen, modalId, queryKey]);

    // 언마운트 시 안전 조치: 모달이 열린 채로 컴포넌트가 unmount된 경우 잔여 쿼리스트링 정리
    useEffect(() => {
        return () => {
            if (hasPushedRef.current && !isPopstateClosingRef.current) {
                hasPushedRef.current = false;
                try {
                    if (typeof window !== "undefined") {
                        const cleanUrl = removeModalUrlQuery(window.location.href, queryKey);
                        window.history.replaceState(null, "", cleanUrl);
                    }
                } catch {
                    // Ignore
                }
            }
        };
    }, [queryKey]);
}
