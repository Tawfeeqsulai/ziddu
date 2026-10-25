"use client";

import { CircleCheck, Clock, ExternalLink, LocateFixed, MapPin, RotateCcw, Route } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Shop } from "@/types/commerce";
import RouteMap from "@/components/features/directions/route-map";
import { BackButton } from "@/components/ui/back-button";
import { useLoginPrompt } from "@/components/features/auth/login-prompt-provider";
import { haversineDistanceKm, WALKIN_ARRIVAL_RADIUS_METERS } from "@/lib/location";

type DirectionsExperienceProps = { apiKey: string; shop: Shop; postId?: string };
type Coordinates = { latitude: number; longitude: number };
type RouteSummary = { distance: string; duration: string };
type WalkinStatus = "idle" | "saving" | "recorded" | "already-recorded" | "failed";

// Readings less precise than this cannot reliably tell 20 m apart, so they only move the marker.
const MAX_ARRIVAL_ACCURACY_METERS = 50;

function formatMeters(meters: number) {
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(1)} km`;
}

export default function DirectionsExperience({ apiKey, shop }: DirectionsExperienceProps) {
  const router = useRouter();
  const { authenticated } = useLoginPrompt();
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const [route, setRoute] = useState<RouteSummary | null>(null);
  const [origin, setOrigin] = useState<Coordinates | null>(null);
  const [routeRequestId, setRouteRequestId] = useState(0);
  const [livePosition, setLivePosition] = useState<Coordinates | null>(null);
  const [remainingMeters, setRemainingMeters] = useState<number | null>(null);
  const [tracking, setTracking] = useState(false);
  const [arrived, setArrived] = useState(false);
  const [showArrival, setShowArrival] = useState(false);
  const [walkinStatus, setWalkinStatus] = useState<WalkinStatus>("idle");
  const [arrivalPosition, setArrivalPosition] = useState<Coordinates | null>(null);
  const [walkinMessage, setWalkinMessage] = useState("");
  const watchIdRef = useRef<number | null>(null);
  const walkinRequestRef = useRef<Promise<boolean> | null>(null);
  const autoStartedRef = useRef(false);
  const arrivedRef = useRef(false);
  const destinationLabel = [shop.area, shop.city].filter(Boolean).join(", ") || shop.address || shop.name;
  const destination = shop.latitude != null && shop.longitude != null
    ? { latitude: shop.latitude, longitude: shop.longitude }
    : null;
  const destinationQuery = destination ? `${destination.latitude},${destination.longitude}` : destinationLabel;
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destinationQuery)}&travelmode=driving`;

  const stopTracking = useCallback(() => {
    if (watchIdRef.current != null) navigator.geolocation.clearWatch(watchIdRef.current);
    watchIdRef.current = null;
    setTracking(false);
  }, []);

  useEffect(() => stopTracking, [stopTracking]);

  function recordWalkin(): Promise<boolean> {
    if (walkinStatus === "recorded" || walkinStatus === "already-recorded") return Promise.resolve(true);
    if (walkinRequestRef.current) return walkinRequestRef.current;
    if (!arrivalPosition) return Promise.resolve(false);

    const request = (async () => {
      setWalkinStatus("saving");
      setWalkinMessage("");
      try {
        const response = await fetch("/api/walkins", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ shopId: shop.id, ...arrivalPosition }),
        });
        const result = await response.json().catch(() => null) as { recorded?: boolean; message?: string } | null;
        if (!response.ok) {
          setWalkinMessage(result?.message || "Walk-in could not be saved. Please try again.");
          setWalkinStatus("failed");
          return false;
        }
        setWalkinStatus(result?.recorded === false ? "already-recorded" : "recorded");
        return true;
      } catch {
        setWalkinMessage("You seem to be offline. Check your connection and try again.");
        setWalkinStatus("failed");
        return false;
      } finally {
        walkinRequestRef.current = null;
      }
    })();
    walkinRequestRef.current = request;
    return request;
  }

  // Both arrival actions count the visit first; signed-out visitors just continue.
  async function finishArrival(next: () => void) {
    if (authenticated && !(await recordWalkin())) return;
    next();
  }

  const viewShop = () => router.push(`/shops/${shop.id}`);
  const closeArrival = () => setShowArrival(false);

  function handlePosition({ coords }: GeolocationPosition) {
    if (!destination) return;
    const position = { latitude: coords.latitude, longitude: coords.longitude };
    const meters = (haversineDistanceKm(position, destination) ?? Number.POSITIVE_INFINITY) * 1000;
    setLivePosition(position);
    setRemainingMeters(meters);
    if (arrivedRef.current || coords.accuracy > MAX_ARRIVAL_ACCURACY_METERS || meters > WALKIN_ARRIVAL_RADIUS_METERS) return;

    arrivedRef.current = true;
    stopTracking();
    setArrived(true);
    setShowArrival(true);
    setArrivalPosition(position);
  }

  function startTracking() {
    if (arrivedRef.current || watchIdRef.current != null) return;
    setTracking(true);
    watchIdRef.current = navigator.geolocation.watchPosition(handlePosition, (positionError) => {
      if (positionError.code !== positionError.PERMISSION_DENIED) return;
      stopTracking();
      setError("Location access is blocked, so we can't track your trip. Allow it in your browser settings, then try again.");
    }, { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 });
  }

  function findRoute() {
    if (!destination) {
      setError("This vendor has not added map coordinates yet.");
      return;
    }
    if (!navigator.geolocation) {
      setError("Location is not available in this browser.");
      return;
    }

    setLocating(true);
    setError("");
    setRoute(null);
    navigator.geolocation.getCurrentPosition((position) => {
      setLocating(false);
      setLoading(true);
      setOrigin({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setRouteRequestId((requestId) => requestId + 1);
      handlePosition(position);
      startTracking();
    }, (positionError) => {
      setError(positionError.code === positionError.PERMISSION_DENIED
        ? "Location access is blocked. Allow it in your browser settings, then try again."
        : "We could not determine your current location.");
      setLocating(false);
      setLoading(false);
    }, { enableHighAccuracy: true, maximumAge: 60_000, timeout: 12_000 });
  }

  // Opening this page is the request for directions, so start right away.
  useEffect(() => {
    if (autoStartedRef.current) return;
    autoStartedRef.current = true;
    findRoute();
  });

  const busy = locating || loading;
  const statusText = locating ? "Finding your location..." : loading ? "Finding the best route..." : arrived ? `You reached ${shop.name}` : tracking ? remainingMeters == null ? "Tracking your trip..." : `${formatMeters(remainingMeters)} to go · live tracking` : null;

  return <main className="directions-page">
    <header className="directions-page-header">
      <BackButton label="Go back" />
      <div>
        <span className="section-kicker">ZIDDU DIRECTIONS</span>
        <h1>{shop.name}</h1>
        <p className="directions-page-address"><MapPin size={13} />{destinationLabel}</p>
      </div>
    </header>
    <section className="directions-page-content">
      {destination ? <div className="directions-map-frame">
        <RouteMap
          apiKey={apiKey}
          destination={destination}
          vendorName={shop.name}
          onRouteError={setError}
          onRouteLoading={setLoading}
          onRouteSummary={setRoute}
          origin={origin}
          livePosition={livePosition}
          routeRequestId={routeRequestId}
        />
        {busy && <span className="directions-map-badge"><span className="directions-map-badge-dot" />{locating ? "Locating you" : "Plotting route"}</span>}
      </div> : <div className="directions-map-unavailable">The vendor needs to add latitude and longitude before a map route can be shown.</div>}

      <div className="directions-trip">
        <div className="directions-trip-summary">
          <span className="directions-trip-icon"><Route size={20} /></span>
          {route ? <div>
            <strong>{route.duration}</strong>
            <span>{route.distance} · driving with live traffic</span>
          </div> : <div>
            <strong>{busy ? "Getting directions" : error ? "Route unavailable" : "Directions"}</strong>
            <span>{busy ? "This takes just a moment" : `To ${shop.name}`}</span>
          </div>}
          {destination && <button aria-label="Refresh route" className="directions-trip-refresh" disabled={busy} onClick={findRoute} type="button"><RotateCcw className={busy ? "is-spinning" : undefined} size={16} /></button>}
        </div>

        {statusText && <div className={`directions-tracking${arrived ? " is-arrived" : ""}`} role="status">
          {arrived ? <CircleCheck size={15} /> : busy ? <Clock size={15} /> : <LocateFixed className="directions-tracking-pulse" size={15} />}
          <span>{statusText}</span>
          {tracking && !busy && <button onClick={stopTracking} type="button">Stop</button>}
        </div>}

        {error && <div className="directions-error" role="alert"><span>{error}</span>{destination && <button onClick={findRoute} type="button"><RotateCcw size={13} /> Try again</button>}</div>}

        <a className="directions-google-link" href={mapsUrl} rel="noreferrer" target="_blank"><ExternalLink size={15} /> Open in Google Maps</a>
      </div>
    </section>
    {showArrival && <div className="modal-backdrop">
      <div aria-labelledby="walkin-arrival-title" aria-modal="true" className="walkin-arrival" role="dialog">
        <span className="walkin-arrival-icon"><CircleCheck size={30} /></span>
        <span className="section-kicker">YOU HAVE ARRIVED</span>
        <h2 id="walkin-arrival-title">You reached {shop.name}</h2>
        <p aria-live="polite" className={walkinStatus === "failed" ? "is-error" : undefined}>
          {!authenticated ? "Sign in next time so the shop can count your visit."
            : walkinStatus === "saving" ? "Checking you in..."
              : walkinStatus === "recorded" ? "You're checked in. Enjoy your visit!"
                : walkinStatus === "already-recorded" ? "You're already checked in here. Enjoy your visit!"
                  : walkinStatus === "failed" ? walkinMessage
                    : "Tap below to check in and let the shop know you're here."}
        </p>
        <div className="walkin-arrival-actions">
          {walkinStatus === "failed" ? <>
            <button className="confirm-button" onClick={() => void recordWalkin()} type="button">Try again</button>
            <button className="walkin-arrival-close" onClick={closeArrival} type="button">Skip</button>
          </> : <>
            <Link className="confirm-button" href={`/shops/${shop.id}`} aria-disabled={walkinStatus === "saving"} onClick={(event) => {
              event.preventDefault();
              if (walkinStatus !== "saving") void finishArrival(viewShop);
            }}>View shop</Link>
            <button className="walkin-arrival-close" disabled={walkinStatus === "saving"} onClick={() => void finishArrival(closeArrival)} type="button">Done</button>
          </>}
        </div>
      </div>
    </div>}
  </main>;
}
