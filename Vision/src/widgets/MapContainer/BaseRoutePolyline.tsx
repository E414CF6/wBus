"use client";

import React, {useEffect, useState} from "react";
import {Layer, Source} from "react-map-gl/maplibre";
import {getSegmentsJSON} from "@entities/route/api";

export default function BaseRoutePolyline() {
    const [geoJson, setGeoJson] = useState<any>({
        type: "FeatureCollection",
        features: []
    });

    useEffect(() => {
        getSegmentsJSON().then(data => {
            const features = Object.entries(data).map(([id, coords]) => ({
                type: "Feature",
                id,
                geometry: {
                    type: "LineString",
                    coordinates: coords, // [lng, lat] format is natively expected by MapLibre
                },
                properties: {}
            }));
            setGeoJson({
                type: "FeatureCollection" as const,
                features
            });
        }).catch(console.error);
    }, []);

    return (
        <Source id="base-polyline" type="geojson" data={geoJson}>
            <Layer
                id="base-polyline-layer"
                type="line"
                paint={{
                    "line-color": "#d1d5db", // Tailwind gray-300
                    "line-width": 3,
                    "line-opacity": 0.5,
                }}
                layout={{
                    "line-cap": "round",
                    "line-join": "round",
                }}
            />
        </Source>
    );
}
