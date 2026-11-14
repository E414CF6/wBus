export {Modal, default as BaseModal} from "./Modal";
export type {ModalProps, ModalMaxWidth, ModalHeight} from "./Modal";
export {BottomSheet, useBottomSheetDrag} from "./BottomSheet";
export type {BottomSheetProps, UseBottomSheetDragOptions} from "./BottomSheet";
export {useBodyScrollLock} from "./useBodyScrollLock";
export {useIsDesktop, useIsCoarsePointer, isDesktopViewport, isCoarsePointerDevice} from "./useIsDesktop";
export {
    useModalHistory,
    buildModalUrl,
    removeModalUrlQuery,
    isModalQueryMatching,
    markModalNavigating,
    markModalReplacing,
    isPendingModalReplacement,
    shouldSuppressHistoryBackOnClose,
} from "./useModalHistory";
export type {UseModalHistoryOptions} from "./useModalHistory";
export {applyThemePreference, type ThemePreference} from "./themeUtils";
