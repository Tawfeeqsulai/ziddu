import { NextResponse } from "next/server";
import { coordinatesSchema } from "@/lib/location";
import { locationProvider } from "@/services/location.service";

export async function POST(request: Request) {
    const body = await request.json().catch(() => null);
    const parsed = coordinatesSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ message: "Invalid coordinates." }, { status: 400 });
    try {
        const location = await locationProvider.reverseGeocode(parsed.data.latitude, parsed.data.longitude);
        if (!location) return NextResponse.json({ message: "No location found." }, { status: 404 });
        return NextResponse.json({ location });
    } catch {
        return NextResponse.json({ message: "Location lookup is unavailable." }, { status: 503 });
    }
}
