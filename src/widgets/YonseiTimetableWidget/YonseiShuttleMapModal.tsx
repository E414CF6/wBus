"use client";

import React, {useEffect, useMemo, useState} from "react";
import {Bus, Camera, X} from "lucide-react";
import {createPortal} from "react-dom";

import {YONSEI_SHUTTLE_STOPS} from "@/data/yonseiShuttleStops";
import {ShuttleStopSelector} from "./ui/YonseiShuttleMap/ShuttleStopSelector";
import {ShuttleMapViewer} from "./ui/YonseiShuttleMap/ShuttleMapViewer";
import {ShuttleStopDetailCard} from "./ui/YonseiShuttleMap/ShuttleStopDetailCard";

export interface YonseiShuttleMapModalProps {
    isOpen: boolean;
    onClose: () => void;
    initialStopId?: string;
}

export const YonseiShuttleMapModal: React.FC<YonseiShuttleMapModalProps> = ({
                                                                                isOpen,
                                                                                onClose,
                                                                                initialStopId,
                                                                            }) => {
    const [mounted, setMounted] = useState(false);
    const [selectedStopId, setSelectedStopId] = useState<string>(
        initialStopId || YONSEI_SHUTTLE_STOPS[0].id
    );

    useEffect(() => {
        setMounted(true);
    }, []);

    // Sync initialStopId when opened
    useEffect(() => {
        if (initialStopId) {
            setSelectedStopId(initialStopId);
        }
    }, [initialStopId, isOpen]);

    // Close on ESC key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        if (isOpen) {
            window.addEventListener("keydown", handleKeyDown);
        }
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    const selectedStop = useMemo(() => {
        return (
            YONSEI_SHUTTLE_STOPS.find((s) => s.id === selectedStopId) ||
            YONSEI_SHUTTLE_STOPS[0]
        );
    }, [selectedStopId]);

    if (!isOpen || !mounted) return null;

    const modalContent = (
        <div
            className="fixed inset-0 z-[10000] flex items-center justify-center p-2.5 sm:p-5 bg-slate-950/70 dark:bg-black/85 backdrop-blur-md animate-fadeIn pointer-events-auto"
            style={{zIndex: 10000}}
            onClick={onClose}
        >
            <div
                className="w-full max-w-5xl h-[92dvh] sm:h-[88vh] rounded-3xl border border-blue-500/30 dark:border-blue-500/20 shadow-2xl flex flex-col overflow-hidden bg-white dark:bg-[#111622] transition-colors duration-300"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="p-3.5 sm:p-5 border-b border-slate-200/80 dark:border-white/10 flex flex-col gap-3 bg-white dark:bg-[#111622] shrink-0">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                            <div
                                className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-teal-500 text-white flex items-center justify-center shadow-md shadow-blue-600/20 shrink-0">
                                <Bus className="w-5 h-5"/>
                            </div>
                            <div className="min-w-0">
                                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white truncate flex items-center gap-1.5">
                                    <span>셔틀버스 정류장 위치 안내</span>
                                    <span
                                        className="text-[10px] sm:text-xs font-bold px-2 py-0.5 rounded-lg bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-500/30">
                                        {YONSEI_SHUTTLE_STOPS.length}개 거점
                                    </span>
                                </h2>
                                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 font-medium truncate flex items-center gap-1">
                                    <span>지도 위 마커를 누르면 </span>
                                    <span
                                        className="text-teal-600 dark:text-teal-400 font-black inline-flex items-center gap-0.5">
                                        <Camera className="w-3 h-3"/>
                                        로드뷰
                                    </span>
                                    <span>가 새 창으로 열립니다</span>
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                            {/* Close Modal Button */}
                            <button
                                onClick={onClose}
                                className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                                title="닫기 (ESC)"
                            >
                                <X className="w-4 h-4"/>
                            </button>
                        </div>
                    </div>

                    {/* Horizontal Stop Selector Chips */}
                    <ShuttleStopSelector
                        stops={YONSEI_SHUTTLE_STOPS}
                        selectedStopId={selectedStop.id}
                        onSelectStop={(stop) => setSelectedStopId(stop.id)}
                    />
                </div>

                {/* Modal Body: Map Viewport with Marker Roadview Buttons */}
                <div className="flex-1 p-2.5 sm:p-4 overflow-hidden flex flex-col gap-3 min-h-0">
                    <div className="flex-1 relative min-h-0 rounded-2xl overflow-hidden">
                        <ShuttleMapViewer
                            stops={YONSEI_SHUTTLE_STOPS}
                            selectedStop={selectedStop}
                            onSelectStop={(stop) => setSelectedStopId(stop.id)}
                        />
                    </div>

                    {/* Bottom Stop Detail & Action Buttons */}
                    <div className="shrink-0">
                        <ShuttleStopDetailCard stop={selectedStop}/>
                    </div>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
};
