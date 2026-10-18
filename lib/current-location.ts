import { z } from "zod";
import { normalizedLocationSchema } from "@/lib/location";

const reverseGeocodeResponseSchema = z.object({
  location: normalizedLocationSchema.optional(),
  message: z.string().optional(),
});

function geolocationError(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location access is blocked. Allow it in your browser settings, then try again.";
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Your current location is unavailable. Try again or enter your area manually.";
  }
  return "Finding your location took too long. Try again or enter your area manually.";
}

export async function getCurrentLocation() {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    throw new Error("Location is not available in this browser. Enter your area manually.");
  }

  const requestPosition = (options: PositionOptions) => new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => reject(error),
      options,
    );
  });

  let coordinates: { latitude: number; longitude: number };
  try {
    // Balanced accuracy favors a quick network-assisted fix for neighborhood discovery.
    coordinates = await requestPosition({ enableHighAccuracy: false, maximumAge: 30_000, timeout: 12_000 });
  } catch (cause) {
    const error = cause as GeolocationPositionError;
    if (error.code === error.PERMISSION_DENIED) throw new Error(geolocationError(error));
    try {
      // Retry with GPS precision if the browser could not provide a balanced location.
      coordinates = await requestPosition({ enableHighAccuracy: true, maximumAge: 0, timeout: 12_000 });
    } catch (fallbackCause) {
      throw new Error(geolocationError(fallbackCause as GeolocationPositionError));
    }
  }

  const response = await fetch("/api/location/reverse-geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(coordinates),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  const result = reverseGeocodeResponseSchema.safeParse(await response.json().catch(() => null));
  if (!response.ok) {
    throw new Error(result.success ? result.data.message ?? "Location lookup is unavailable." : "Location lookup is unavailable. Try again or enter your area manually.");
  }
  if (!result.success || !result.data.location) {
    throw new Error("We couldn't identify your area. Enter your location manually.");
  }

  return {
    ...result.data.location,
    // Keep the exact browser fix for distance calculations, even if the geocoder snaps
    // its returned point to a nearby road or building.
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
  };
}
