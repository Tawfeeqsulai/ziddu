import DiscoverExperience from "@/components/features/discover/discover-experience";
import { requireCurrentUser } from "@/lib/auth/session";
import { getDiscoveryData } from "@/services/discovery.service";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await requireCurrentUser();
  if (!user.onboardingCompleted) redirect("/onboarding");

  const data = await getDiscoveryData(user.id);
  const profileLocation = await prisma.user.findUnique({
    where: { id: user.id },
    select: { city: true, locality: true },
  });

  return <DiscoverExperience data={data} initialLocation={profileLocation ?? undefined} />;
}
