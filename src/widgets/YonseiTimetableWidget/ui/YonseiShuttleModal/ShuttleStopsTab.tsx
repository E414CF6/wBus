"use client";

import React, {useMemo, useState} from "react";

import {YONSEI_SHUTTLE_STOPS} from "@data/yonseiShuttleStops";

import {ShuttleStopSelector} from "../YonseiShuttleMap/ShuttleStopSelector";
import {ShuttleMapViewer} from "../YonseiShuttleMap/ShuttleMapViewer";
import {ShuttleStopDetailCard} from "../YonseiShuttleMap/ShuttleStopDetailCard";

export const ShuttleStopsTab: React.FC = () => {
    const [selectedStopId, setSelectedStopId] = useState<string>(YONSEI_SHUTTLE_STOPS[0].id);

    const selectedStop = useMemo(() => {
        return (
            YONSEI_SHUTTLE_STOPS.find((s) => s.id === selectedStopId) ||
            YONSEI_SHUTTLE_STOPS[0]
        );
    }, [selectedStopId]);

    return (
        <div className="space-y-3.5">
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
