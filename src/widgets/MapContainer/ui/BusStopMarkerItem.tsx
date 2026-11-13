import React, {memo, useCallback, useEffect, useMemo, useState} from "react";
import {Marker} from "react-map-gl/maplibre";
import {BusFront, Star} from "lucide-react";
import type {BusStop} from "@entities/station/types";
import {useIsDesktop} from "@shared/ui/useIsDesktop";
import {useAppMapContext} from "@shared/context/AppMapContext";
import type {LabelPlacement} from "@entities/station/busStopMarkerUtils";
import {BusStopBottomSheet} from "./BusStopBottomSheet";

export interface BusStopMarkerItemProps {
    stop: BusStop;
    cityCode: string;
    currentRouteName: string;
    isRouteStop?: boolean;
    isFavorite?: boolean;
    onToggleFavorite?: (stop: BusStop) => void;
    onRouteChange?: (routeName: string) => void;
    showLabel?: boolean;
    labelPlacement?: LabelPlacement;
    disambiguationLabel?: string | null;
    pairedOppositeStop?: BusStop | null;
    onSelectOppositeStop?: (stop: BusStop) => void;
    color?: string;
    initialOpen?: boolean;
    onClearInitialOpen?: () => void;
}

export const BusStopMarkerItem = memo<BusStopMarkerItemProps>(({
                                                                   stop,
                                                                   cityCode,
                                                                   currentRouteName,
                                                                   isRouteStop = true,
                                                                   isFavorite = false,
                                                                   onToggleFavorite,
                                                                   onRouteChange,
                                                                   showLabel = true,
                                                                   labelPlacement = "right",
                                                                   disambiguationLabel = null,
                                                                   pairedOppositeStop = null,
                                                                   onSelectOppositeStop,
                                                                   color = "#059669",
                                                                   initialOpen = false,
                                                                   onClearInitialOpen,
                                                               }) => {
    const isDesktop = useIsDesktop();
    const {map} = useAppMapContext();
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [closedStopId, setClosedStopId] = useState<string | null>(null);
    const [isHovered, setIsHovered] = useState(false);

    const isUserClosed = closedStopId === stop.nodeid;
    const isOpen = !isDesktop && (isPopupOpen || (initialOpen && !isUserClosed));

    const handleMarkerClick = useCallback((e: { originalEvent?: Event }) => {
        if (e.originalEvent) {
            e.originalEvent.stopPropagation();
        }
        if (isDesktop) {
            window.dispatchEvent(new CustomEvent("wbus:focus-stop", {detail: stop}));
            window.dispatchEvent(new CustomEvent("wbus:open-bus-list"));
            return;
        }

        if (typeof window !== "undefined") {
            window.dispatchEvent(new CustomEvent("wbus:close-stop-popup"));
            window.dispatchEvent(new CustomEvent("wbus:close-bus-list"));
            window.dispatchEvent(new CustomEvent("wbus:close-timetable"));
        }
        setClosedStopId(null);
        setIsPopupOpen(true);

        if (map && stop.gpslong && stop.gpslati) {
            map.easeTo({
                center: [stop.gpslong, stop.gpslati],
                offset: [0, -120],
                duration: 350,
            });
        }
    }, [isDesktop, stop, map]);

    const handlePopupClose = useCallback(() => {
        setClosedStopId(stop.nodeid);
        setIsPopupOpen(false);
        onClearInitialOpen?.();
    }, [stop.nodeid, onClearInitialOpen]);

    // Close when other popups or bus list requests closing
    useEffect(() => {
        if (typeof window === "undefined") return;
        const handleClosePopups = () => {
            setClosedStopId(stop.nodeid);
            setIsPopupOpen(false);
            onClearInitialOpen?.();
        };
        window.addEventListener("wbus:close-popups", handleClosePopups);
        window.addEventListener("wbus:close-stop-popup", handleClosePopups);
        return () => {
            window.removeEventListener("wbus:close-popups", handleClosePopups);
            window.removeEventListener("wbus:close-stop-popup", handleClosePopups);
        };
    }, [stop.nodeid, onClearInitialOpen]);

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                handlePopupClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, handlePopupClose]);

    const handleSelectRouteFromPopup = useCallback(
        (nextRoute: string) => {
            setClosedStopId(stop.nodeid);
            setIsPopupOpen(false);
            onClearInitialOpen?.();
            onRouteChange?.(nextRoute);
        },
        [stop.nodeid, onRouteChange, onClearInitialOpen]
    );

    const borderColor = isFavorite ? "#f59e0b" : isRouteStop ? color : "#64748b";
    const effectiveZIndex = isHovered || isOpen ? 50 : isFavorite ? 22 : isRouteStop ? 18 : 12;

    const placementClasses = useMemo(() => {
        switch (labelPlacement) {
            case "left":
                return "right-full mr-1.5 top-1/2 -translate-y-1/2";
            case "top":
                return "bottom-full mb-1.5 left-1/2 -translate-x-1/2";
            case "bottom":
                return "top-full mt-1.5 left-1/2 -translate-x-1/2";
            case "right":
            default:
                return "left-full ml-1.5 top-1/2 -translate-y-1/2";
        }
    }, [labelPlacement]);

    return (
        <>
            <Marker
                longitude={stop.gpslong}
                latitude={stop.gpslati}
                onClick={handleMarkerClick}
                anchor="center"
                style={{pointerEvents: "auto", cursor: "pointer", zIndex: effectiveZIndex}}
            >
                <div
                    className="relative flex items-center justify-center select-none group"
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    {isRouteStop ? (
                        <div
                            title={`${stop.nodenm} (현재 노선 정류장)`}
                            className={`relative flex items-center justify-center w-6 h-6 rounded-lg text-white shadow-md border-2 group-hover:scale-110 transition-transform cursor-pointer shrink-0 z-10 before:absolute before:-inset-2 before:content-[''] ${
                                isFavorite ? "border-amber-300 ring-2 ring-amber-400/60" : "border-white/90"
                            }`}
                            style={{backgroundColor: color}}
                        >
                            <BusFront className="w-3.5 h-3.5 fill-current"/>
                            {isFavorite && (
                                <span
                                    className="absolute -top-1.5 -right-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-400 text-slate-950 shadow-xs border border-white">
                                    <Star className="w-2 h-2 fill-current"/>
                                </span>
                            )}
                        </div>
                    ) : isFavorite ? (
                        <div
                            title={`${stop.nodenm} (즐겨찾는 정류장)`}
                            className="relative flex items-center justify-center w-6 h-6 rounded-lg bg-amber-500 text-white shadow-md border-2 border-white group-hover:scale-110 transition-transform cursor-pointer shrink-0 z-10 ring-2 ring-amber-400/50 before:absolute before:-inset-2 before:content-['']"
                        >
                            <Star className="w-3.5 h-3.5 fill-current"/>
                        </div>
                    ) : (
                        <div
                            title={`${stop.nodenm} (주변 정류장 · 클릭하여 도착정보 확인)`}
                            className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-700/90 dark:bg-slate-600/90 text-white shadow-sm border-[1.5px] border-white/85 opacity-85 group-hover:opacity-100 group-hover:scale-125 group-hover:bg-blue-600 transition-all cursor-pointer shrink-0 z-10 before:absolute before:-inset-2 before:content-['']"
                        >
                            <div className="w-1.5 h-1.5 rounded-full bg-white"/>
                        </div>
                    )}

                    {(showLabel || isFavorite || isHovered || isOpen) && (
                        <div
                            className={`absolute px-2 py-0.5 rounded-md bg-[#18191c]/95 shadow-md backdrop-blur-md pointer-events-auto whitespace-nowrap group-hover:scale-105 transition-all z-20 flex items-center gap-1.5 ${placementClasses}`}
                            style={{
                                border: `1.2px solid ${borderColor}`,
                            }}
                        >
                            {isFavorite && <Star className="w-2.5 h-2.5 text-amber-400 fill-amber-400 shrink-0"/>}
                            <span
                                className="text-white font-bold text-[11px] sm:text-[12px] tracking-tight leading-none">
                                {stop.nodenm}
                            </span>
                            {disambiguationLabel && (
                                <span
                                    className="text-[9px] font-mono font-bold px-1 py-0.2 rounded bg-white/15 text-slate-300">
                                    {disambiguationLabel}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </Marker>

            <BusStopBottomSheet
                isOpen={isOpen}
                stop={stop}
                cityCode={cityCode}
                currentRouteName={currentRouteName}
                isRouteStop={isRouteStop}
                isFavorite={isFavorite}
                color={color}
                pairedOppositeStop={pairedOppositeStop}
                onToggleFavorite={onToggleFavorite}
                onSelectOppositeStop={onSelectOppositeStop}
                onSelectRoute={handleSelectRouteFromPopup}
                onClose={handlePopupClose}
            />
        </>
    );
});

BusStopMarkerItem.displayName = "BusStopMarkerItem";
