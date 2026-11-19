"use client";

import {useCallback, useEffect, useMemo, useState, useSyncExternalStore} from "react";
import type {WikiFormDraft} from "../WikiCreateForm";
import {LOCALE, UI_TEXT} from "@shared/config/locale";
import {
    clearWikiLocalDraft,
    isWikiFormDirty,
    parseWikiLocalDraft,
    readRawWikiLocalDraft,
    subscribeWikiLocalDraft,
    type WikiLocalDraft,
    writeWikiLocalDraft,
} from "./wikiLocalDraft";

export interface WikiFormDraftActions {
    saveDraft: () => void;
    clearDraft: () => void;
}

export interface UseWikiDraftPersistenceOptions {
    draftKey: string;
    baselineDraft: WikiFormDraft;
    currentDraft: WikiFormDraft;
    baseVersion?: number;
    skipInitialRestore?: boolean;
    onApplyDraft: (draft: WikiLocalDraft) => void;
    onDirtyChange?: (dirty: boolean) => void;
    actionsRef?: React.RefObject<WikiFormDraftActions | null>;
}

function formatDraftTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString(LOCALE, {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
}

export function useWikiDraftPersistence({
                                            draftKey,
                                            baselineDraft,
                                            currentDraft,
                                            baseVersion,
                                            skipInitialRestore = false,
                                            onApplyDraft,
                                            onDirtyChange,
                                            actionsRef,
                                        }: UseWikiDraftPersistenceOptions) {
    const [bannerDismissed, setBannerDismissed] = useState(skipInitialRestore);
    const [draftStatusLabel, setDraftStatusLabel] = useState<string | null>(null);

    const rawStoredDraft = useSyncExternalStore(
        subscribeWikiLocalDraft,
        () => readRawWikiLocalDraft(draftKey),
        () => null,
    );

    const isDirty = useMemo(
        () => isWikiFormDirty(currentDraft, baselineDraft),
        [currentDraft, baselineDraft],
    );

    const recoverableDraft = useMemo(() => {
        if (bannerDismissed || isDirty) return null;
        const parsed = parseWikiLocalDraft(rawStoredDraft);
        if (!parsed || !isWikiFormDirty(parsed, baselineDraft)) return null;
        return parsed;
    }, [bannerDismissed, isDirty, rawStoredDraft, baselineDraft]);

    useEffect(() => {
        onDirtyChange?.(isDirty);
    }, [isDirty, onDirtyChange]);

    const saveDraftNow = useCallback(() => {
        const saved = writeWikiLocalDraft(draftKey, {
            ...currentDraft,
            baseVersion,
        });
        if (saved) {
            setBannerDismissed(true);
            setDraftStatusLabel(UI_TEXT.WIKI.DRAFT.STATUS_SAVED(formatDraftTime(saved.savedAt)));
        }
    }, [draftKey, currentDraft, baseVersion]);

    const clearDraft = useCallback(() => {
        clearWikiLocalDraft(draftKey);
        setBannerDismissed(true);
        setDraftStatusLabel(null);
    }, [draftKey]);

    const restoreDraft = useCallback(() => {
        if (!recoverableDraft) return;
        onApplyDraft(recoverableDraft);
        setBannerDismissed(true);
        setDraftStatusLabel(UI_TEXT.WIKI.DRAFT.STATUS_RESTORED(formatDraftTime(recoverableDraft.savedAt)));
    }, [recoverableDraft, onApplyDraft]);

    const discardDraft = useCallback(() => {
        clearDraft();
    }, [clearDraft]);

    useEffect(() => {
        if (!actionsRef) return;
        actionsRef.current = {saveDraft: saveDraftNow, clearDraft};
        return () => {
            actionsRef.current = null;
        };
    }, [actionsRef, saveDraftNow, clearDraft]);

    // Auto-save after 800ms idle when dirty
    useEffect(() => {
        if (!isDirty) return;
        const timer = window.setTimeout(() => {
            saveDraftNow();
        }, 800);
        return () => window.clearTimeout(timer);
    }, [isDirty, saveDraftNow]);

    // Warn on browser tab close / reload when there are unsaved changes
    useEffect(() => {
        if (!isDirty) return;
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [isDirty]);

    return {
        isDirty,
        recoverableDraft,
        draftStatusLabel,
        saveDraftNow,
        restoreDraft,
        discardDraft,
        clearDraft,
    };
}
