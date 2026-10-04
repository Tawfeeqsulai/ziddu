"use client";

import { Check, MapPin, Navigation, RotateCcw } from "lucide-react";
import { useState } from "react";
import type { Shop } from "@/types/commerce";
import RouteMap from "@/components/features/directions/route-map";
import { BackButton } from "@/components/ui/back-button";

type DirectionsExperienceProps = { shop: Shop };
type RouteResult = { distanceKm: number; durationMinutes: number; steps: string[]; geometry: Array<[number, number]> };

export default function DirectionsExperience({ shop }: DirectionsExperienceProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [route, setRoute] = useState<RouteResult | null>(null);
    const [origin, setOrigin] = useState<{ latitude: number; longitude: number } | null>(null);

    function findRoute() {
        if (shop.latitude == null || shop.longitude == null) return setError("This shop does not have map coordinates yet.");
        if (!navigator.geolocation) return setError("Location is not available in this browser.");
        setLoading(true); setError("");
        navigator.geolocation.getCurrentPosition(async ({ coords }) => {
            try {
                setOrigin({ latitude: coords.latitude, longitude: coords.longitude });
                const response = await fetch("/api/directions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ origin: { latitude: coords.latitude, longitude: coords.longitude }, destination: { latitude: shop.latitude, longitude: shop.longitude } }) });
                const result = await response.json() as { route?: RouteResult; message?: string };
                if (!response.ok || !result.route) throw new Error(result.message ?? "Directions are unavailable.");
                setRoute(result.route);
            } catch (requestError) { setError(requestError instanceof Error ? requestError.message : "Directions are unavailable."); }
            finally { setLoading(false); }
        }, (positionError) => { setError(positionError.code === positionError.PERMISSION_DENIED ? "Location permission was denied. Allow it to show directions from your current location." : "We could not determine your current location."); setLoading(false); }, { maximumAge: 120000, timeout: 10000 });
    }

    return <main className="directions-page"><header className="directions-page-header"><BackButton label="Go back" /><div><span className="section-kicker">ZIDDU DIRECTIONS</span><h1>{shop.name}</h1></div></header><section className="directions-page-content"><div className="directions-destination"><MapPin size={16} /><span>{shop.address}, {shop.area}, {shop.city}</span></div>{route && origin && shop.latitude != null && shop.longitude != null && <RouteMap destination={{ latitude: shop.latitude, longitude: shop.longitude }} geometry={route.geometry} origin={origin} />}<div className="directions-page-actions"><button className="confirm-button" disabled={loading} onClick={findRoute} type="button"><Navigation size={15} />{loading ? "Building route..." : route ? "Refresh route" : "Use my location"}</button>{route && <span>{route.distanceKm.toFixed(1)} km · about {route.durationMinutes} min</span>}</div>{error && <div className="directions-error" role="alert"><span>{error}</span><button onClick={findRoute} type="button"><RotateCcw size={13} /> Try again</button></div>}{route && <ol className="directions-steps">{route.steps.map((step, index) => <li key={`${step}-${index}`}><span><Check size={13} /></span>{step}</li>)}</ol>}{!route && !error && <p className="directions-empty">Use your current location to build a route and display it on the map.</p>}</section></main>;
}
