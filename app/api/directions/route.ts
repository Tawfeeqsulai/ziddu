import { NextResponse } from "next/server";
import { z } from "zod";

const coordinates = z.object({ latitude: z.number().finite().min(-90).max(90), longitude: z.number().finite().min(-180).max(180) });
const requestSchema = z.object({ origin: coordinates, destination: coordinates });

type RoutingStep = { maneuver?: { instruction?: string }; name?: string; distance?: number };

export async function POST(request: Request) {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ message: "Invalid route coordinates." }, { status: 400 });
    const { origin, destination } = parsed.data;
    const baseUrl = process.env.LOCATION_ROUTING_API_URL ?? "https://router.project-osrm.org";
    const url = `${baseUrl}/route/v1/driving/${origin.longitude},${origin.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson&steps=true`;
    try {
        const response = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "ZIDDU local discovery app" }, signal: AbortSignal.timeout(8000) });
        if (!response.ok) return NextResponse.json({ message: "Directions are temporarily unavailable." }, { status: 503 });
        const payload = await response.json() as { code?: string; routes?: Array<{ distance?: number; duration?: number; geometry?: { coordinates?: Array<[number, number]> }; legs?: Array<{ steps?: RoutingStep[] }> }> };
        const route = payload.routes?.[0];
        if (payload.code !== "Ok" || !route) return NextResponse.json({ message: "No driving route was found." }, { status: 404 });
        const steps = (route.legs?.flatMap((leg) => leg.steps ?? []) ?? []).map((step) => step.maneuver?.instruction ?? (step.name ? `Continue on ${step.name}` : "Continue ahead")).filter(Boolean).slice(0, 12);
        return NextResponse.json({ route: { distanceKm: Number(((route.distance ?? 0) / 1000).toFixed(1)), durationMinutes: Math.max(1, Math.round((route.duration ?? 0) / 60)), steps, geometry: route.geometry?.coordinates ?? [] } });
    } catch {
        return NextResponse.json({ message: "Directions are temporarily unavailable." }, { status: 503 });
    }
}
