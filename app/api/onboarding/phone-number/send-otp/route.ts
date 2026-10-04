import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { normalizeIndianPhone } from "@/lib/auth/phone";
import { deliverDevelopmentOtp } from "@/lib/auth/phone-otp";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

  const body = await request.json().catch(() => null) as { phoneNumber?: unknown } | null;
  const phoneNumber = typeof body?.phoneNumber === "string" ? normalizeIndianPhone(body.phoneNumber) : null;
  if (!phoneNumber) return NextResponse.json({ message: "Enter a valid 10-digit Indian mobile number." }, { status: 400 });

  const existing = await prisma.user.findFirst({
    where: { phoneNumber, NOT: { id: user.id } },
    select: { id: true },
  });
  if (existing) return NextResponse.json({ message: "That mobile number is already linked to another account." }, { status: 409 });

  try {
    await deliverDevelopmentOtp({ phoneNumber, code: "" });
  } catch (error) {
    if (error instanceof Error && error.message === "OTP resend cooldown is active.") {
      return NextResponse.json({ message: error.message }, { status: 429 });
    }
    throw error;
  }

  return NextResponse.json({ phoneNumber });
}
