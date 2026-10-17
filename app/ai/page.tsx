import { redirect } from "next/navigation";
import AIExperience from "@/components/features/ai/ai-experience";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export default async function AIPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.onboardingCompleted) redirect("/onboarding");
  const profile = await prisma.user.findUnique({ where: { id: user.id }, select: { city: true, locality: true } });
  return <AIExperience location={profile ?? undefined} />;
}
