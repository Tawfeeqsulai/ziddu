import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { normalizedLocationSchema } from "@/lib/location";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
    const body = await request.json().catch(() => null);
    const parsed = normalizedLocationSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ message: "Invalid location." }, { status: 400 });
    try {
        const location = await prisma.user.update({
            where: { id: user.id },
            data: {
                address: parsed.data.address,
                locality: parsed.data.locality,
                city: parsed.data.city,
                state: parsed.data.state,
                pincode: parsed.data.pincode,
                latitude: parsed.data.latitude,
                longitude: parsed.data.longitude,
            },
            select: { city: true, locality: true, address: true, state: true, pincode: true, latitude: true, longitude: true },
        });
        return NextResponse.json({ location });
    } catch (error) {
        console.error("Unable to save the user's current location.", error);
        return NextResponse.json({ message: "Location was found but could not be saved to your account." }, { status: 500 });
    }
}
