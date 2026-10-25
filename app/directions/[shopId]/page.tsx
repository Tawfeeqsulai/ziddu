import { notFound } from "next/navigation";
import DirectionsExperience from "@/components/features/directions/directions-experience";
import { getShopProfile } from "@/services/shop-profile.service";
import { getCurrentUser } from "@/lib/auth/session";

export default async function DirectionsPage({ params, searchParams }: { params: Promise<{ shopId: string }>; searchParams: Promise<{ post_id?: string }> }) {
    const [{ shopId }, query] = await Promise.all([params, searchParams]);
    const user = await getCurrentUser();
    const profile = await getShopProfile(shopId, user?.id);
    if (!profile) notFound();
    return <DirectionsExperience apiKey={process.env.GOOGLE_MAPS_API_KEY ?? ""} postId={query.post_id} shop={profile.shop} />;
}
