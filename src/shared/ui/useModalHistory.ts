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

const MODAL_NAVIGATION_SUPPRESS_MS = 1000;
let lastModalNavigationAt = 0;

/**
 * 모달 내부 링크 이동(<Link> 등) 직전에 호출하여 모달 닫힘 시
 * window.history.back() 호출이 라우팅을 취소하지 않도록 방지합니다.
 */
export function markModalNavigating(now = Date.now()) {
    lastModalNavigationAt = now;
}

export function shouldSuppressHistoryBackOnClose(params: {
    currentHref: string;
    initialBaseUrl: string | null;
    modalId: string;
    queryKey: string;
    lastNavigationAt: number;
    now?: number;
}): boolean {
    const {
        currentHref,
        initialBaseUrl,
        modalId,
        queryKey,
        lastNavigationAt,
        now = Date.now(),
    } = params;
    const currentBase = removeModalUrlQuery(currentHref, queryKey);
    const hasNavigated = Boolean(initialBaseUrl && initialBaseUrl !== currentBase);
    const isStillOnModal = isModalQueryMatching(currentHref, modalId, queryKey);
    const isLinkNavigating = isRecentModalNavigation(lastNavigationAt, now);

    return isLinkNavigating || hasNavigated || !isStillOnModal;
}

export function isRecentModalNavigation(lastNavigationAt: number, now = Date.now()): boolean {
    return lastNavigationAt > 0 && now - lastNavigationAt >= 0 && now - lastNavigationAt < MODAL_NAVIGATION_SUPPRESS_MS;
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
    const initialUrlRef = useRef<string | null>(null);

    // 모달 열림: URL에 쿼리스트링 추가 및 popstate / 내부 링크 클릭 리스너 등록
    useEffect(() => {
        if (!isOpen || !enableHistory || typeof window === "undefined") return;

        const key = queryKey;
        const value = modalId || "open";

        try {
            const currentUrl = new URL(window.location.href);
            const currentVal = currentUrl.searchParams.get(key);

            // 모달 열리기 전의 기본 URL (modal 쿼리 제외) 기록
            if (!initialUrlRef.current) {
                initialUrlRef.current = removeModalUrlQuery(window.location.href, key);
            }

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

        const handleDocumentLinkClick = (e: MouseEvent) => {
            if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
                return;
            }
            const target = e.target;
            if (!(target instanceof Element)) return;
            const anchor = target.closest("a[href]");
            if (!anchor) return;
            const targetAttr = anchor.getAttribute("target");
            if ((targetAttr && targetAttr !== "_self") || anchor.hasAttribute("download")) {
                return;
            }
            try {
                const resolved = new URL(anchor.getAttribute("href") || "", window.location.href);
                if (resolved.origin === window.location.origin) {
                    markModalNavigating();
                }
            } catch {
                // Ignore malformed href
            }
        };

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

        document.addEventListener("click", handleDocumentLinkClick, true);
        window.addEventListener("popstate", handlePopState);
        return () => {
            document.removeEventListener("click", handleDocumentLinkClick, true);
            window.removeEventListener("popstate", handlePopState);
        };
    }, [isOpen, enableHistory, modalId, queryKey]);

    // 모달 닫힘: 사용자가 UI(X 버튼, 배경 터치 등)로 닫았을 때 브라우저 히스토리 원상복구
    useEffect(() => {
        if (!isOpen) {
            if (hasPushedRef.current && !isPopstateClosingRef.current) {
                hasPushedRef.current = false;
                if (typeof window !== "undefined") {
                    const currentHref = window.location.href;
                    const isLinkNavigating = isRecentModalNavigation(lastModalNavigationAt);
                    const suppressHistoryBack = shouldSuppressHistoryBackOnClose({
                        currentHref,
                        initialBaseUrl: initialUrlRef.current,
                        modalId: modalId || "open",
                        queryKey,
                        lastNavigationAt: lastModalNavigationAt,
                    });

                    // 링크 이동/라우트 전환 중에는 history.back() 및 replaceState를 호출하지 않아 Next.js App Router 전환이 취소되지 않도록 함
                    if (!suppressHistoryBack) {
                        try {
                            window.history.back();
                        } catch {
                            const cleanUrl = removeModalUrlQuery(currentHref, queryKey);
                            window.history.replaceState(null, "", cleanUrl);
                        }
                    } else if (!isLinkNavigating) {
                        try {
                            const currentUrl = new URL(currentHref);
                            if (currentUrl.searchParams.has(queryKey)) {
                                const cleanUrl = removeModalUrlQuery(currentHref, queryKey);
                                window.history.replaceState(null, "", cleanUrl);
                            }
                        } catch {
                            // Ignore
                        }
                    }
                }
            } else if (!hasPushedRef.current && !isPopstateClosingRef.current) {
                // pushState를 수행하지 않았던 경우(예: 직접 URL로 진입) 모달이 닫히면 URL 쿼리 파라미터만 정리 (단, 링크 이동 중이 아닐 때만)
                if (typeof window !== "undefined" && !isRecentModalNavigation(lastModalNavigationAt)) {
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
            initialUrlRef.current = null;
        } else {
            isPopstateClosingRef.current = false;
        }
    }, [isOpen, modalId, queryKey]);

    // 언마운트 시 안전 조치: 모달이 열린 채로 컴포넌트가 unmount된 경우 잔여 쿼리스트링 정리
    useEffect(() => {
        return () => {
            if (hasPushedRef.current && !isPopstateClosingRef.current) {
                hasPushedRef.current = false;
                if (isRecentModalNavigation(lastModalNavigationAt)) {
                    return;
                }
                try {
                    if (typeof window !== "undefined") {
                        const currentUrl = new URL(window.location.href);
                        if (currentUrl.searchParams.get(queryKey) === (modalId || "open")) {
                            const cleanUrl = removeModalUrlQuery(window.location.href, queryKey);
                            window.history.replaceState(null, "", cleanUrl);
                        }
                    }
                } catch {
                    // Ignore
                }
            }
        };
    }, [modalId, queryKey]);
}
