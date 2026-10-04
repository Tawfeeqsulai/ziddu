import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function requireAffiliatePage() {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    if (!user.onboardingCompleted) redirect("/onboarding");
    const affiliate = await prisma.affiliate.findUnique({ where: { userId: user.id }, select: { status: true } });
    if (!affiliate || affiliate.status !== "ACTIVE") redirect("/affiliate");
    return user;
}
