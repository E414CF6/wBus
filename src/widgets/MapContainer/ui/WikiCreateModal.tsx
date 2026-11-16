"use client";

import React from "react";
import {BookPlus} from "lucide-react";
import {mutateAllWikiQueries, type WikiPageDocument} from "@entities/wiki";
import {WikiCreateForm} from "@features/wiki";
import {Modal} from "@shared/ui";

export interface WikiCreateModalProps {
    isOpen: boolean;
    initialSlug?: string;
    initialLat?: number;
    initialLng?: number;
    initialCityCode?: string;
    onClose: () => void;
    onCreated: (doc: WikiPageDocument) => void;
    onRepickLocation?: () => void;
}

export const WikiCreateModal: React.FC<WikiCreateModalProps> = ({
                                                                    isOpen,
                                                                    initialSlug,
                                                                    initialLat,
                                                                    initialLng,
                                                                    initialCityCode = "32020",
                                                                    onClose,
                                                                    onCreated,
                                                                    onRepickLocation,
                                                                }) => {
    const modalIcon = (
        <div
            className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-emerald-600 text-white shadow-sm shrink-0">
            <BookPlus className="w-5 h-5"/>
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="지도 핀으로 새 위키 만들기"
            subtitle="지정한 위치에 정류장·캠퍼스·노선 팁 문서를 바로 생성합니다"
            icon={modalIcon}
            maxWidth="2xl"
            height="tall"
            zIndex="z-[125]"
            modalId="wiki-create"
            ariaLabel="새 위키 문서 만들기 모달"
        >
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6 custom-scrollbar select-text">
                {isOpen && (
                    <WikiCreateForm
                        key={`${initialLat ?? "none"}-${initialLng ?? "none"}-${initialSlug ?? ""}`}
                        initialSlug={initialSlug}
                        initialLat={initialLat}
                        initialLng={initialLng}
                        initialCityCode={initialCityCode}
                        onPickOnMap={onRepickLocation}
                        onCreated={async (created) => {
                            await mutateAllWikiQueries().catch(() => []);
                            onCreated(created);
                        }}
                        onCancel={onClose}
                    />
                )}
            </div>
        </Modal>
    );
};
