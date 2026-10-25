import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { sharedPrisma } from "@/lib/db/shared-prisma";
import { coordinatesSchema, haversineDistanceKm, WALKIN_ARRIVAL_RADIUS_METERS } from "@/lib/location";
import { normalizeVendorLocation } from "@/lib/vendor-location";
import { getSharedLikeUserId } from "@/services/likes-api.service";
import { recordVendorWalkin } from "@/services/vendor-walkins-api.service";

// Repeat arrivals at the same vendor inside this window count as one walk-in.
const WALKIN_COOLDOWN_SECONDS = 2 * 60 * 60;

const walkinSchema = coordinatesSchema.extend({
  shopId: z.string().regex(/^\d+$/),
});

const cooldownCookieName = (vendorId: number, userId: number) => `ziddu_walkin_${vendorId}_${userId}`;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.id) return NextResponse.json({ message: "Sign in to check in at this shop." }, { status: 401 });

  const parsed = walkinSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Invalid walk-in." }, { status: 400 });
  const { shopId, latitude, longitude } = parsed.data;

  try {
    const vendor = await sharedPrisma.sharedVendor.findUnique({ where: { id: Number(shopId) }, select: { id: true, address: true } });
    if (!vendor) return NextResponse.json({ message: "Shop not found." }, { status: 404 });

    const distanceKm = haversineDistanceKm({ latitude, longitude }, normalizeVendorLocation(vendor.address));
    if (distanceKm == null) return NextResponse.json({ message: "This shop has no map location." }, { status: 400 });
    if (distanceKm * 1000 > WALKIN_ARRIVAL_RADIUS_METERS) {
      return NextResponse.json({ message: "You are not at the shop yet." }, { status: 400 });
    }

    const sharedUserId = await getSharedLikeUserId(user.id);
    if (sharedUserId === null) {
      return NextResponse.json({ message: "Add your phone number to your profile so shops can count your visits." }, { status: 409 });
    }

    const cookieStore = await cookies();
    const cookieName = cooldownCookieName(vendor.id, sharedUserId);
    const recentWalkinId = cookieStore.get(cookieName)?.value;
    if (recentWalkinId) return NextResponse.json({ recorded: false, walkinId: Number(recentWalkinId) || null });

    const walkin = await recordVendorWalkin(vendor.id, sharedUserId);
    cookieStore.set(cookieName, String(walkin.walkinId ?? 1), {
      httpOnly: true,
      maxAge: WALKIN_COOLDOWN_SECONDS,
      path: "/api/walkins",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return NextResponse.json({ recorded: true, walkinId: walkin.walkinId }, { status: 201 });
  } catch (error) {
    // Database errors carry internal details; only the walk-in service's own messages are user-facing.
    const isDatabaseError = error instanceof Error && error.name.startsWith("PrismaClient");
    if (isDatabaseError) console.error("Walk-in database error", error);
    const message = error instanceof Error && !isDatabaseError ? error.message : "We're busy right now. Please try again in a moment.";
    return NextResponse.json({ message }, { status: 503 });
  }
}
