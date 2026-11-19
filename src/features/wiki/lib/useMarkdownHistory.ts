"use client";

import {useCallback, useRef, useState} from "react";
import {
    canRedoEditorHistory,
    canUndoEditorHistory,
    createEditorHistory,
    type EditorHistorySource,
    type EditorHistoryState,
    type EditorSnapshot,
    pushEditorSnapshot,
    redoEditorHistory,
    type TextEditResult,
    undoEditorHistory,
} from "./markdownEditorOps";

export interface UseMarkdownHistoryOptions {
    value: string;
    onChange: (next: string) => void;
    textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function useMarkdownHistory({
                                       value,
                                       onChange,
                                       textareaRef,
                                   }: UseMarkdownHistoryOptions) {
    const [history, setHistory] = useState<EditorHistoryState>(() =>
        createEditorHistory(value, 0),
    );
    const [prevPropValue, setPrevPropValue] = useState(value);
    const [isComposing, setIsComposing] = useState(false);

    const historyRef = useRef<EditorHistoryState>(history);
    const isComposingRef = useRef(false);

    // Sync external value updates (e.g., draft recovery, 409 latestDocument apply) without effect setState
    if (value !== prevPropValue) {
        setPrevPropValue(value);
        if (!isComposing && value !== history.entries[history.index]?.value) {
            const nextHistory = pushEditorSnapshot(history, {
                value,
                selectionStart: value.length,
                selectionEnd: value.length,
                scrollTop: 0,
                timestamp: 0,
                source: "external",
            });
            setHistory(nextHistory);
        }
    }

    const commitState = useCallback((nextHistory: EditorHistoryState) => {
        historyRef.current = nextHistory;
        setHistory(nextHistory);
    }, []);

    const restoreSelectionAndScroll = useCallback(
        (snapshot: EditorSnapshot) => {
            requestAnimationFrame(() => {
                const el = textareaRef.current;
                if (!el) return;
                el.focus();
                const start = Math.min(snapshot.selectionStart, snapshot.value.length);
                const end = Math.min(snapshot.selectionEnd, snapshot.value.length);
                el.setSelectionRange(start, end);
                if (typeof snapshot.scrollTop === "number") {
                    el.scrollTop = snapshot.scrollTop;
                }
            });
        },
        [textareaRef],
    );

    const applyEdit = useCallback(
        (result: TextEditResult, source: EditorHistorySource) => {
            const el = textareaRef.current;
            const snapshot: EditorSnapshot = {
                value: result.value,
                selectionStart: result.selectionStart,
                selectionEnd: result.selectionEnd,
                scrollTop: el?.scrollTop ?? 0,
                timestamp: Date.now(),
                source,
            };
            const base =
                historyRef.current.entries[historyRef.current.index]?.value === value
                    ? historyRef.current
                    : history;
            const nextHistory = pushEditorSnapshot(base, snapshot);
            setPrevPropValue(result.value);
            commitState(nextHistory);
            onChange(result.value);
            if (source !== "typing") {
                restoreSelectionAndScroll(snapshot);
            }
        },
        [textareaRef, value, history, commitState, onChange, restoreSelectionAndScroll],
    );

    const handleTextareaChange = useCallback(
        (nextValue: string) => {
            const el = textareaRef.current;
            if (isComposingRef.current) {
                setPrevPropValue(nextValue);
                onChange(nextValue);
                return;
            }
            const selectionStart = el?.selectionStart ?? nextValue.length;
            const selectionEnd = el?.selectionEnd ?? nextValue.length;
            const snapshot: EditorSnapshot = {
                value: nextValue,
                selectionStart,
                selectionEnd,
                scrollTop: el?.scrollTop ?? 0,
                timestamp: Date.now(),
                source: "typing",
            };
            const nextHistory = pushEditorSnapshot(historyRef.current, snapshot);
            setPrevPropValue(nextValue);
            commitState(nextHistory);
            onChange(nextValue);
        },
        [textareaRef, commitState, onChange],
    );

    const handleCompositionStart = useCallback(() => {
        isComposingRef.current = true;
        setIsComposing(true);
    }, []);

    const handleCompositionEnd = useCallback(
        (committedValue: string) => {
            isComposingRef.current = false;
            setIsComposing(false);
            const el = textareaRef.current;
            const snapshot: EditorSnapshot = {
                value: committedValue,
                selectionStart: el?.selectionStart ?? committedValue.length,
                selectionEnd: el?.selectionEnd ?? committedValue.length,
                scrollTop: el?.scrollTop ?? 0,
                timestamp: Date.now(),
                source: "typing",
            };
            setPrevPropValue(committedValue);
            commitState(pushEditorSnapshot(historyRef.current, snapshot));
        },
        [textareaRef, commitState],
    );

    const undo = useCallback(() => {
        const base =
            historyRef.current.entries[historyRef.current.index]?.value === value
                ? historyRef.current
                : history;
        const nextHistory = undoEditorHistory(base);
        if (nextHistory === base) return false;
        const target = nextHistory.entries[nextHistory.index];
        setPrevPropValue(target.value);
        commitState(nextHistory);
        onChange(target.value);
        restoreSelectionAndScroll(target);
        return true;
    }, [value, history, commitState, onChange, restoreSelectionAndScroll]);

    const redo = useCallback(() => {
        const base =
            historyRef.current.entries[historyRef.current.index]?.value === value
                ? historyRef.current
                : history;
        const nextHistory = redoEditorHistory(base);
        if (nextHistory === base) return false;
        const target = nextHistory.entries[nextHistory.index];
        setPrevPropValue(target.value);
        commitState(nextHistory);
        onChange(target.value);
        restoreSelectionAndScroll(target);
        return true;
    }, [value, history, commitState, onChange, restoreSelectionAndScroll]);

    return {
        canUndo: canUndoEditorHistory(history),
        canRedo: canRedoEditorHistory(history),
        isComposingRef,
        undo,
        redo,
        applyEdit,
        handleTextareaChange,
        handleCompositionStart,
        handleCompositionEnd,
    };
}
