"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

type RouteMapProps = { origin: { latitude: number; longitude: number }; destination: { latitude: number; longitude: number }; geometry: Array<[number, number]> };

export default function RouteMap({ origin, destination, geometry }: RouteMapProps) {
    const mapElement = useRef<HTMLDivElement>(null);
    useEffect(() => {
        let active = true;
        let map: import("leaflet").Map | undefined;
        let layers: import("leaflet").Layer[] = [];
        void import("leaflet").then((leaflet) => {
            if (!active || !mapElement.current) return;
            map = leaflet.map(mapElement.current, { zoomControl: true }).setView([destination.latitude, destination.longitude], 14);
            leaflet.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors" }).addTo(map);
            const points = geometry.map(([longitude, latitude]) => [latitude, longitude] as [number, number]);
            const bounds = leaflet.latLngBounds([[origin.latitude, origin.longitude], [destination.latitude, destination.longitude], ...points]);
            layers = [leaflet.polyline(points, { color: "#176fe5", weight: 5, opacity: .9 }).addTo(map), leaflet.marker([origin.latitude, origin.longitude]).addTo(map).bindTooltip("You"), leaflet.marker([destination.latitude, destination.longitude]).addTo(map).bindTooltip("Shop")];
            map.fitBounds(bounds, { padding: [24, 24] });
        });
        return () => { active = false; layers.forEach((layer) => layer.remove()); map?.remove(); };
    }, [destination.latitude, destination.longitude, geometry, origin.latitude, origin.longitude]);
    return <div aria-label="Driving route map" className="route-map" ref={mapElement} />;
}