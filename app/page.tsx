import DiscoverExperience from "@/components/features/discover/discover-experience";
import { getCurrentUser } from "@/lib/auth/session";
import { getDiscoveryData } from "@/services/discovery.service";
import { prisma } from "@/lib/db/prisma";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await getCurrentUser();
  if (user && !user.onboardingCompleted) redirect("/onboarding");

  const [data, profileLocation] = await Promise.all([
    getDiscoveryData(user?.id),
    user ? prisma.user.findUnique({
      where: { id: user.id },
      select: { city: true, locality: true, latitude: true, longitude: true },
    }) : Promise.resolve(null),
  ]);

  return <DiscoverExperience authenticated={Boolean(user)} data={data} initialLocation={profileLocation ?? undefined} />;
}
