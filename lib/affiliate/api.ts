import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function requireActiveAffiliate() {
    const user = await getCurrentUser();
    if (!user) return { response: NextResponse.json({ message: "Sign in required." }, { status: 401 }) } as const;
    const affiliate = await prisma.affiliate.findUnique({ where: { userId: user.id }, select: { id: true, status: true } });
    if (!affiliate || affiliate.status !== "ACTIVE") return { response: NextResponse.json({ message: "Active affiliate access is required." }, { status: 403 }) } as const;
    return { user, affiliate } as const;
}

export function affiliateError(error: unknown) {
    const status = typeof error === "object" && error !== null && "status" in error && typeof error.status === "number" ? error.status : 500;
    const message = error instanceof Error && status < 500 ? error.message : "Affiliate service is temporarily unavailable.";
    return NextResponse.json({ message }, { status });
}
