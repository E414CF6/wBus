"use client";

import React, {useMemo, useState} from "react";
import {Camera, MapPin, Maximize2} from "lucide-react";

import {YONSEI_SHUTTLE_STOPS} from "@/data/yonseiShuttleStops";

import {ShuttleStopSelector} from "../YonseiShuttleMap/ShuttleStopSelector";
import {ShuttleMapViewer} from "../YonseiShuttleMap/ShuttleMapViewer";
import {ShuttleStopDetailCard} from "../YonseiShuttleMap/ShuttleStopDetailCard";

interface ShuttleStopsTabProps {
    onOpenMapModal?: (stopId?: string) => void;
}

export const ShuttleStopsTab: React.FC<ShuttleStopsTabProps> = ({onOpenMapModal}) => {
    const [selectedStopId, setSelectedStopId] = useState<string>(YONSEI_SHUTTLE_STOPS[0].id);

    const selectedStop = useMemo(() => {
        return (
            YONSEI_SHUTTLE_STOPS.find((s) => s.id === selectedStopId) ||
            YONSEI_SHUTTLE_STOPS[0]
        );
    }, [selectedStopId]);

    return (
        <div className="space-y-3.5">
            {/* Control Bar & Actions */}
            <div
                className="flex items-center justify-between gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.04] border border-slate-200/80 dark:border-white/10">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
                    <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400"/>
                    <span>셔틀버스 정류장 위치 안내</span>
                    <span className="text-slate-400 dark:text-slate-500 font-normal hidden sm:inline">
                        (마커의 <span
                        className="text-teal-600 dark:text-teal-400 font-bold inline-flex items-center gap-0.5"><Camera
                        className="w-3 h-3"/>로드뷰</span> 버튼으로 현장 확인)
                    </span>
                </div>

                {/* Open Fullscreen Modal Trigger */}
                {onOpenMapModal && (
                    <button
                        type="button"
                        onClick={() => onOpenMapModal(selectedStop.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-black shadow-xs transition-all active:scale-95 cursor-pointer shrink-0"
                        title="전체화면 정류장 지도 모달 열기"
                    >
                        <Maximize2 className="w-3.5 h-3.5"/>
                        <span>전체화면 열기</span>
                    </button>
                )}
            </div>

            {/* Horizontal Stop Selector Chips */}
            <ShuttleStopSelector
                stops={YONSEI_SHUTTLE_STOPS}
                selectedStopId={selectedStop.id}
                onSelectStop={(stop) => setSelectedStopId(stop.id)}
            />

            {/* Viewport: Map with Marker Roadview Buttons */}
            <div
                className="w-full h-[360px] sm:h-[420px] rounded-2xl overflow-hidden border border-slate-200/80 dark:border-white/10 relative">
                <ShuttleMapViewer
                    stops={YONSEI_SHUTTLE_STOPS}
                    selectedStop={selectedStop}
                    onSelectStop={(stop) => setSelectedStopId(stop.id)}
                />
            </div>

            {/* Bottom Stop Detail & Action Buttons */}
            <ShuttleStopDetailCard stop={selectedStop}/>
        </div>
    );
};
