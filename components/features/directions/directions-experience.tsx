"use client";

import { ExternalLink, MapPin, Navigation, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { Shop } from "@/types/commerce";
import RouteMap from "@/components/features/directions/route-map";
import { BackButton } from "@/components/ui/back-button";

type DirectionsExperienceProps = { apiKey: string; shop: Shop };
type Coordinates = { latitude: number; longitude: number };
type RouteSummary = { distance: string; duration: string };

export default function DirectionsExperience({ apiKey, shop }: DirectionsExperienceProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [route, setRoute] = useState<RouteSummary | null>(null);
  const [origin, setOrigin] = useState<Coordinates | null>(null);
  const [routeRequestId, setRouteRequestId] = useState(0);
  const destinationLabel = [shop.area, shop.city].filter(Boolean).join(", ") || shop.address || shop.name;
  const destination = shop.latitude != null && shop.longitude != null
    ? { latitude: shop.latitude, longitude: shop.longitude }
    : null;
  const destinationQuery = destination ? `${destination.latitude},${destination.longitude}` : destinationLabel;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationQuery)}&travelmode=driving`;

  function findRoute() {
    if (!destination) {
      setError("This vendor has not added map coordinates yet.");
      return;
    }
    if (!navigator.geolocation) {
      setError("Location is not available in this browser.");
      return;
    }

    setLoading(true);
    setError("");
    setRoute(null);
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setOrigin({ latitude: coords.latitude, longitude: coords.longitude });
      setRouteRequestId((requestId) => requestId + 1);
    }, (positionError) => {
      setError(positionError.code === positionError.PERMISSION_DENIED
        ? "Location access is blocked. Allow it in your browser settings, then try again."
        : "We could not determine your current location.");
      setLoading(false);
    }, { enableHighAccuracy: true, maximumAge: 60_000, timeout: 12_000 });
  }

  return <main className="directions-page">
    <header className="directions-page-header"><BackButton label="Go back" /><div><span className="section-kicker">ZIDDU DIRECTIONS</span><h1>{shop.name}</h1></div></header>
    <section className="directions-page-content">
      <div className="directions-destination"><MapPin size={16} /><span>{destinationLabel}</span></div>
      {destination && <RouteMap
        apiKey={apiKey}
        destination={destination}
        vendorName={shop.name}
        onRouteError={setError}
        onRouteLoading={setLoading}
        onRouteSummary={setRoute}
        origin={origin}
        routeRequestId={routeRequestId}
      />}
      {!destination && <div className="directions-map-unavailable">The vendor needs to add latitude and longitude before a map route can be shown.</div>}
      <div className="directions-page-actions">
        <button className="confirm-button" disabled={loading || !destination} onClick={findRoute} type="button"><Navigation size={15} />{loading ? "Finding route..." : route ? "Refresh route" : "Get directions"}</button>
        {route && <span className="directions-route-summary"><strong>{route.duration}</strong><span>{route.distance}</span><small>Driving · live traffic estimate</small></span>}
        <a className="directions-google-link" href={mapsUrl} rel="noreferrer" target="_blank"><ExternalLink size={14} /> Open Google Maps</a>
      </div>
      {error && <div className="directions-error" role="alert"><span>{error}</span>{destination && <button onClick={findRoute} type="button"><RotateCcw size={13} /> Try again</button>}</div>}
      {!route && !error && <p className="directions-empty">The vendor is marked on the map. Use your location to see the driving route and estimated arrival time.</p>}
    </section>
  </main>;
}
