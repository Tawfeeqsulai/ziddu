import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ShopProfileExperience from "@/components/features/shop/shop-profile-experience";
import { getCurrentUser } from "@/lib/auth/session";
import { getShopProfile } from "@/services/shop-profile.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const profile = await getShopProfile(id);
  if (!profile) return { title: "Shop not found — ZIDDU" };
  return { title: `${profile.shop.name} — ZIDDU`, description: `${profile.shop.description} ${profile.shop.area}, ${profile.shop.city}.` };
}

export default async function ShopPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  const profile = await getShopProfile(id, user?.id);
  if (!profile) notFound();

  return <ShopProfileExperience key={id} profile={profile} authenticated={Boolean(user)} />;
}
