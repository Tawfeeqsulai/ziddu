import { NextResponse } from "next/server";
import { z } from "zod";

const coordinates = z.object({ latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180) });
const requestSchema = z.object({ origin: coordinates, destination: coordinates });
type RoutePoint = { latitude: number; longitude: number };

function decodePolyline(encoded: string): RoutePoint[] {
  const points: RoutePoint[] = [];
  let index = 0;
  let latitude = 0;
  let longitude = 0;

  while (index < encoded.length) {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    latitude += result & 1 ? ~(result >> 1) : result >> 1;

    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20 && index < encoded.length);
    longitude += result & 1 ? ~(result >> 1) : result >> 1;
    points.push({ latitude: latitude / 1e5, longitude: longitude / 1e5 });
  }

  return points;
}

export async function POST(request: Request) {
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid route coordinates." }, { status: 400 });

  const apiKey = process.env.GOOGLE_ROUTES_API_KEY;
  if (!apiKey) return NextResponse.json({ message: "Add GOOGLE_ROUTES_API_KEY to enable driving routes." }, { status: 503 });

  try {
    const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: parsed.data.origin.latitude, longitude: parsed.data.origin.longitude } } },
        destination: { location: { latLng: { latitude: parsed.data.destination.latitude, longitude: parsed.data.destination.longitude } } },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        languageCode: "en-IN",
        regionCode: "IN",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });

    const payload = await response.json().catch(() => null) as {
      error?: { message?: string; status?: string };
      routes?: Array<{ distanceMeters?: number; duration?: string; polyline?: { encodedPolyline?: string } }>;
    } | null;

    if (!response.ok) {
      const googleMessage = payload?.error?.message?.trim();
      const message = googleMessage
        ? `Google Routes API rejected the request: ${googleMessage}`
        : response.status === 403
          ? "Google Routes API denied the request. Enable Routes API, check billing, and ensure the server key allows Routes API requests."
          : "Google could not calculate a route right now. Please try again.";
      return NextResponse.json({ message }, { status: 503 });
    }

    const route = payload?.routes?.[0];
    const encodedPolyline = route?.polyline?.encodedPolyline;
    if (!route || !encodedPolyline) return NextResponse.json({ message: "No driving route was found." }, { status: 404 });

    const durationSeconds = Number.parseFloat(route.duration ?? "");
    return NextResponse.json({
      route: {
        distanceKm: Number(((route.distanceMeters ?? 0) / 1000).toFixed(1)),
        durationMinutes: Number.isFinite(durationSeconds) ? Math.max(1, Math.round(durationSeconds / 60)) : null,
        path: decodePolyline(encodedPolyline),
      },
    });
  } catch {
    return NextResponse.json({ message: "Google directions are temporarily unavailable. Please try again." }, { status: 503 });
  }
}
