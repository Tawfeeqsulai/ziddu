import { NextResponse } from "next/server";
import { locationProvider } from "@/services/location.service";

export async function GET(request: Request) {
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 120) ?? "";
    if (query.length < 2) return NextResponse.json({ locations: [] });
    try {
        return NextResponse.json({ locations: await locationProvider.search(query) });
    } catch {
        return NextResponse.json({ message: "Location search is unavailable." }, { status: 503 });
    }
}
