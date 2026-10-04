import { redirect } from "next/navigation";
import AffiliateHub from "@/components/features/affiliate/affiliate-hub";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function AffiliatePage() {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    if (!user.onboardingCompleted) redirect("/onboarding");
    const affiliate = await prisma.affiliate.findUnique({ where: { userId: user.id }, select: { status: true } });
    if (affiliate?.status === "SUSPENDED") return <main className="affiliate-page"><section className="affiliate-join"><div><span className="section-kicker">AFFILIATE ACCESS</span><h1>Affiliate access is paused</h1><p>Your ZIDDU account remains available. Contact support if you think this is a mistake.</p></div></section></main>;
    if (!affiliate || affiliate.status === "INACTIVE") redirect("/affiliate/register");
    return <AffiliateHub section="dashboard" />;
}
