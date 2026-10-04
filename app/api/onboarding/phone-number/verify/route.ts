import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { normalizeIndianPhone } from "@/lib/auth/phone";
import { verifyAndConsumeOtp } from "@/lib/auth/phone-otp";
import { prisma } from "@/lib/db/prisma";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

  const body = await request.json().catch(() => null) as { phoneNumber?: unknown; code?: unknown } | null;
  const phoneNumber = typeof body?.phoneNumber === "string" ? normalizeIndianPhone(body.phoneNumber) : null;
  const code = typeof body?.code === "string" ? body.code : "";
  if (!phoneNumber || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ message: "Enter the 6-digit simulated code." }, { status: 400 });
  }

  const verified = await verifyAndConsumeOtp({ phoneNumber, code });
  if (!verified) return NextResponse.json({ message: "That code is incorrect or has expired. Request a new one to try again." }, { status: 400 });

  try {
    await prisma.user.update({
      where: { id: user.id },
      data: { phoneNumber, phoneNumberVerified: true },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return NextResponse.json({ message: "That mobile number is already linked to another account." }, { status: 409 });
    }
    throw error;
  }

  return NextResponse.json({ phoneNumberVerified: true });
}
