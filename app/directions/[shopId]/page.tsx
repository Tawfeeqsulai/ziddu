import { notFound } from "next/navigation";
import DirectionsExperience from "@/components/features/directions/directions-experience";
import { getShopProfile } from "@/services/shop-profile.service";
import { getCurrentUser } from "@/lib/auth/session";

export default async function DirectionsPage({ params }: { params: Promise<{ shopId: string }> }) {
    const { shopId } = await params;
    const user = await getCurrentUser();
    const profile = await getShopProfile(shopId, user?.id);
    if (!profile) notFound();
    return <DirectionsExperience apiKey={process.env.GOOGLE_MAPS_API_KEY ?? ""} shop={profile.shop} />;
}
