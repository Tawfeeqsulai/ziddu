import { z } from "zod";
import { normalizedLocationSchema } from "@/lib/location";

const reverseGeocodeResponseSchema = z.object({
  location: normalizedLocationSchema.optional(),
  message: z.string().optional(),
});

function geolocationError(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) {
    return "Location permission was denied. Allow location access or enter your area manually.";
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return "Your current location is unavailable. Try again or enter your area manually.";
  }
  return "Finding your location took too long. Try again or enter your area manually.";
}

export async function getCurrentLocation() {
  if (!navigator.geolocation) {
    throw new Error("Location is not available in this browser. Enter your area manually.");
  }

  const coordinates = await new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      (error) => reject(new Error(geolocationError(error))),
      { enableHighAccuracy: true, maximumAge: 300_000, timeout: 15_000 },
    );
  });

  const response = await fetch("/api/location/reverse-geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(coordinates),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const result = reverseGeocodeResponseSchema.safeParse(await response.json().catch(() => null));
  if (!response.ok) {
    throw new Error(result.success ? result.data.message ?? "Location lookup is unavailable." : "Location lookup is unavailable. Try again or enter your area manually.");
  }
  if (!result.success || !result.data.location) {
    throw new Error("We couldn't identify your area. Enter your location manually.");
  }

  return result.data.location;
}
