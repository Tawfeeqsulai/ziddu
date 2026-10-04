import DiscoverExperience from "@/components/features/discover/discover-experience";
import { requireCurrentUser } from "@/lib/auth/session";
import { getDiscoveryData } from "@/services/discovery.service";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await requireCurrentUser();
  if (!user.onboardingCompleted) redirect("/onboarding");

  const data = await getDiscoveryData(user.id);

  return <DiscoverExperience data={data} />;
}