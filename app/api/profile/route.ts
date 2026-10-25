import { NextResponse } from "next/server";
import { Prisma } from "@/lib/db/generated/main";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { normalizeUsername, profileInputSchema, profileValues } from "@/lib/profile";
import { AFFILIATE_REFERRAL_COOKIE, readReferralCookieValue } from "@/lib/affiliate/referral-cookie";
import { attributeCustomerSignup } from "@/services/affiliate.service";
import { syncSharedOrderingUser } from "@/lib/userbilling/shared-user";

async function saveProfile(request: Request, complete: boolean) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  const userId = currentUser.id;

  const body = await request.json().catch(() => null);
  const parsed = profileInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Check your profile details." }, { status: 400 });
  }

  const values = profileValues(parsed.data);
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      phoneNumber: true,
      phoneNumberVerified: true,
    },
  });
  if (!account) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  if (complete && !values.phoneNumber) {
    return NextResponse.json({ message: "Mobile number is required to complete onboarding." }, { status: 400 });
  }
  if (complete && values.phoneNumber) {
    if (!account.phoneNumberVerified || account.phoneNumber !== values.phoneNumber) {
      return NextResponse.json({ message: "Verify your mobile number before completing onboarding." }, { status: 400 });
    }
  }
  if (parsed.data.username && !normalizeUsername(parsed.data.username)) {
    return NextResponse.json({ message: "Use 3-24 lowercase letters, numbers, or underscores for your username." }, { status: 400 });
  }

  if (values.username) {
    const existing = await prisma.user.findFirst({ where: { username: values.username, NOT: { id: userId } }, select: { id: true } });
    if (existing) return NextResponse.json({ message: "That username is already taken." }, { status: 409 });
  }
  if (values.phoneNumber) {
    const existing = await prisma.user.findFirst({ where: { phoneNumber: values.phoneNumber, NOT: { id: userId } }, select: { id: true } });
    if (existing) return NextResponse.json({ message: "That mobile number is already linked to another account." }, { status: 409 });
  }
  if (complete && account.phoneNumber) {
    try {
      await syncSharedOrderingUser(account.phoneNumber);
    } catch {
      return NextResponse.json({ message: "We couldn't connect your ordering account. Please try again." }, { status: 503 });
    }
  }
  let user;
  try {
    user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...values,
        ...(complete ? { onboardingCompleted: true } : {}),
      },
      select: { id: true, name: true, username: true, image: true, bio: true, city: true, locality: true, interests: true, onboardingCompleted: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const target = error.meta?.target;
      const targetFields = Array.isArray(target) ? target.map(String) : typeof target === "string" ? [target] : [];
      if (targetFields.some((field) => field.includes("phoneNumber"))) {
        return NextResponse.json({ message: "That mobile number is already linked to another account." }, { status: 409 });
      }
      if (targetFields.some((field) => field.includes("username"))) {
        return NextResponse.json({ message: "That username is already taken." }, { status: 409 });
      }
    }
    throw error;
  }
  const response = NextResponse.json({ user });
  if (complete) {
    const cookieHeader = request.headers.get("cookie") ?? "";
    const cookieValue = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${AFFILIATE_REFERRAL_COOKIE}=`))?.slice(AFFILIATE_REFERRAL_COOKIE.length + 1);
    const attribution = readReferralCookieValue(cookieValue);
    if (attribution?.type === "CUSTOMER") {
      await attributeCustomerSignup(userId, attribution).catch(() => false);
      response.cookies.delete(AFFILIATE_REFERRAL_COOKIE);
    }
  }
  return response;
}

export function POST(request: Request) {
  return saveProfile(request, true);
}

export function PATCH(request: Request) {
  return saveProfile(request, false);
}
