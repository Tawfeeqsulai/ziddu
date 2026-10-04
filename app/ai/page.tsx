import { redirect } from "next/navigation";
import AIExperience from "@/components/features/ai/ai-experience";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getDiscoveryData } from "@/services/discovery.service";

export default async function AIPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboardingCompleted) redirect("/onboarding");
  const data = await getDiscoveryData(user.id);
  const profile = await prisma.user.findUnique({ where: { id: user.id }, select: { city: true, locality: true } });
  return <AIExperience data={data} location={profile ?? undefined} />;
}
