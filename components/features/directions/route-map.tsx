"use client";

import { useEffect, useRef } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

type Coordinates = { latitude: number; longitude: number };
type Point = { lat: number; lng: number };
type RouteSummary = { distance: string; duration: string };
type RouteMapProps = {
  apiKey: string;
  vendorName: string;
  origin: Coordinates | null;
  destination: Coordinates;
  routeRequestId: number;
  onRouteSummary: (summary: RouteSummary | null) => void;
  onRouteLoading: (loading: boolean) => void;
  onRouteError: (message: string) => void;
};

let configuredApiKey: string | null = null;

function configureGoogleMaps(apiKey: string) {
  if (configuredApiKey && configuredApiKey !== apiKey) {
    throw new Error("Google Maps was already initialized with a different API key.");
  }
  if (!configuredApiKey) {
    setOptions({ key: apiKey, v: "weekly", region: "IN" });
    configuredApiKey = apiKey;
  }
}

function formatDuration(minutes?: number | null) {
  if (!Number.isFinite(minutes) || !minutes) return "ETA unavailable";
  const roundedMinutes = Math.max(1, Math.round(minutes));
  const hours = Math.floor(roundedMinutes / 60);
  const remainingMinutes = roundedMinutes % 60;
  return hours > 0 ? `${hours} hr${hours === 1 ? "" : "s"}${remainingMinutes ? ` ${remainingMinutes} min` : ""}` : `${roundedMinutes} min`;
}

export default function RouteMap({ apiKey, vendorName, origin, destination, routeRequestId, onRouteSummary, onRouteLoading, onRouteError }: RouteMapProps) {
  const mapElement = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let map: google.maps.Map | undefined;
    let routeLine: google.maps.Polyline | undefined;
    const markers: google.maps.marker.AdvancedMarkerElement[] = [];

    async function initialize() {
      try {
        configureGoogleMaps(apiKey);
        const [maps, markerLibrary] = await Promise.all([
          importLibrary("maps"),
          importLibrary("marker"),
        ]);
        if (!active || !mapElement.current) return;

        const vendorPoint = { lat: destination.latitude, lng: destination.longitude };
        map = new maps.Map(mapElement.current, {
          center: vendorPoint,
          zoom: 15,
          mapId: "DEMO_MAP_ID",
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: "greedy",
        });
        markers.push(new markerLibrary.AdvancedMarkerElement({ map, position: vendorPoint, title: vendorName }));

        if (!origin) {
          onRouteSummary(null);
          onRouteLoading(false);
          return;
        }

        onRouteLoading(true);
        onRouteError("");
        const startPoint = { lat: origin.latitude, lng: origin.longitude };
        const response = await fetch("/api/directions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origin, destination }),
        });
        const contentType = response.headers.get("content-type") ?? "";
        if (!contentType.includes("application/json")) {
          throw new Error(`Directions endpoint returned HTTP ${response.status} instead of JSON. Restart the local app or deploy the latest directions API.`);
        }
        const result = await response.json() as {
          message?: string;
          route?: { distanceKm: number; durationMinutes: number | null; path: Coordinates[] };
        };
        if (!response.ok) throw new Error(result.message ?? "Google directions are temporarily unavailable.");
        if (!active) return;
        const route = result.route;
        if (!route?.path.length) throw new Error("Google Maps could not find a driving route to this vendor.");

        const path = route.path.map((point) => ({ lat: point.latitude, lng: point.longitude }));
        routeLine = new maps.Polyline({ map, path, strokeColor: "#1675e8", strokeOpacity: 0.92, strokeWeight: 6 });
        markers.push(new markerLibrary.AdvancedMarkerElement({ map, position: startPoint, title: "Your location" }));
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(startPoint);
        bounds.extend(vendorPoint);
        path.forEach((point) => bounds.extend(point));
        map.fitBounds(bounds, { top: 34, right: 34, bottom: 34, left: 34 });

        const distance = `${route.distanceKm.toFixed(1)} km`;
        const duration = formatDuration(route.durationMinutes);
        onRouteSummary({ distance, duration });
        onRouteLoading(false);
      } catch (error) {
        if (!active) return;
        onRouteLoading(false);
        onRouteError(error instanceof Error ? error.message : "Directions are unavailable right now.");
      }
    }

    if (apiKey) void initialize();
    else {
      onRouteLoading(false);
      onRouteError("Add GOOGLE_MAPS_API_KEY to enable the embedded map.");
    }

    return () => {
      active = false;
      routeLine?.setMap(null);
      markers.forEach((marker) => { marker.map = null; });
      mapElement.current?.replaceChildren();
    };
  }, [apiKey, destination.latitude, destination.longitude, onRouteError, onRouteLoading, onRouteSummary, origin?.latitude, origin?.longitude, routeRequestId, vendorName]);

  return <div aria-label="Google map showing the vendor and driving route" className="route-map" ref={mapElement} />;
}
