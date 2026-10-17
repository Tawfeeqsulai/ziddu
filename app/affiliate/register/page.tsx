import { redirect } from "next/navigation";
import AffiliateRegistrationForm from "@/components/features/affiliate/affiliate-registration-form";
import { getCurrentUser } from "@/lib/auth/session";
import { AFFILIATE_PROGRAM } from "@/lib/affiliate/config";
import { prisma } from "@/lib/db/prisma";

export default async function AffiliateRegistrationPage() {
    const sessionUser = await getCurrentUser();
    if (!sessionUser) redirect("/login");
    if (!sessionUser.onboardingCompleted) redirect("/onboarding");

    const [user, affiliate] = await Promise.all([
        prisma.user.findUnique({ where: { id: sessionUser.id }, select: { name: true, phoneNumber: true, address: true, city: true, state: true, pincode: true } }),
        prisma.affiliate.findUnique({ where: { userId: sessionUser.id }, select: { status: true } }),
    ]);
    if (!user) redirect("/login");
    if (affiliate?.status === "ACTIVE") redirect("/affiliate");
    if (affiliate?.status === "SUSPENDED") redirect("/affiliate");

    return <AffiliateRegistrationForm commissionRate={AFFILIATE_PROGRAM.commission.CUSTOMER_ORDER.rate} identity={user} />;
}
