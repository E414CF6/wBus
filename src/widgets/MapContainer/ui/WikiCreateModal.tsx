"use client";

import React, {useRef, useState} from "react";
import {BookPlus} from "lucide-react";
import {mutateAllWikiQueries, type WikiPageDocument} from "@entities/wiki";
import {
    WikiCreateForm,
    type WikiFormDraft,
    type WikiFormDraftActions,
    WikiUnsavedConfirmDialog,
} from "@features/wiki";
import {Modal} from "@shared/ui";
import {UI_TEXT} from "@shared/config/locale";

export interface WikiCreateModalProps {
    isOpen: boolean;
    initialSlug?: string;
    initialLat?: number;
    initialLng?: number;
    initialDraft?: Partial<WikiFormDraft>;
    onClose: () => void;
    onCreated: (doc: WikiPageDocument) => void;
    onRepickLocation?: (draft: WikiFormDraft) => void;
}

export const WikiCreateModal: React.FC<WikiCreateModalProps> = ({
    isOpen,
    initialSlug,
    initialLat,
    initialLng,
    initialDraft,
    onClose,
    onCreated,
    onRepickLocation,
}) => {
    const [isDirty, setIsDirty] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const draftActionsRef = useRef<WikiFormDraftActions | null>(null);

    const requestClose = () => {
        if (isDirty) {
            setConfirmOpen(true);
            return;
        }
        onClose();
    };

    const modalIcon = (
        <div
            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-600 text-white shadow-sm shrink-0">
            <BookPlus className="w-5 h-5"/>
        </div>
    );

    return (
        <>
            <Modal
                isOpen={isOpen}
                onClose={requestClose}
                closeOnBackdropClick={!isDirty}
                closeOnEscape={!isDirty}
                title={UI_TEXT.WIKI.CREATE_MODAL.TITLE}
                subtitle={UI_TEXT.WIKI.CREATE_MODAL.SUBTITLE}
                icon={modalIcon}
                maxWidth="full"
                height="full"
                zIndex="z-[125]"
                modalId="wiki-create"
                ariaLabel={UI_TEXT.WIKI.CREATE_MODAL.ARIA}
            >
                <div
                    className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 lg:px-8 custom-scrollbar select-text">
                    <div className="max-w-6xl mx-auto">
                        {isOpen && (
                            <WikiCreateForm
                                key={`${initialLat ?? "none"}-${initialLng ?? "none"}-${initialSlug ?? ""}`}
                                initialSlug={initialSlug}
                                initialLat={initialLat}
                                initialLng={initialLng}
                                initialDraft={initialDraft}
                                onDirtyChange={setIsDirty}
                                actionsRef={draftActionsRef}
                                onPickOnMap={
                                    onRepickLocation
                                        ? (draft) => {
                                            setIsDirty(false);
                                            onRepickLocation(draft);
                                        }
                                        : undefined
                                }
                                onCreated={async (created) => {
                                    setIsDirty(false);
                                    await mutateAllWikiQueries().catch(() => []);
                                    onCreated(created);
                                }}
                                onCancel={requestClose}
                            />
                        )}
                    </div>
                </div>
            </Modal>

            <WikiUnsavedConfirmDialog
                isOpen={confirmOpen}
                onContinueEditing={() => setConfirmOpen(false)}
                onSaveDraftAndLeave={() => {
                    draftActionsRef.current?.saveDraft();
                    setConfirmOpen(false);
                    setIsDirty(false);
                    onClose();
                }}
                onDiscardAndLeave={() => {
                    draftActionsRef.current?.clearDraft();
                    setConfirmOpen(false);
                    setIsDirty(false);
                    onClose();
                }}
            />
        </>
    );
};
