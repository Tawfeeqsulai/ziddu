import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ShopProfileExperience from "@/components/features/shop/shop-profile-experience";
import { getCurrentUser } from "@/lib/auth/session";
import { getShopProfile } from "@/services/shop-profile.service";
import { getPurchaseHistory } from "@/services/purchase-history.service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const profile = await getShopProfile(id);
  if (!profile) return { title: "Shop not found — ZIDDU" };
  return { title: `${profile.shop.name} — ZIDDU`, description: `${profile.shop.description} ${profile.shop.area}, ${profile.shop.city}.` };
}

export default async function ShopPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ order?: string }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  const profile = await getShopProfile(id, user?.id);
  if (!profile) notFound();
  const history = user ? await getPurchaseHistory(user.id) : undefined;
  const orders = history?.all.records.filter((record) => record.vendorId === id) ?? [];
  const initialOrderId = orders.some((order) => order.billId === query.order && !["paid", "success", "completed", "cancelled", "rejected", "ready"].includes(order.status.toLowerCase())) ? query.order : undefined;

  return <ShopProfileExperience initialOrderId={initialOrderId} key={id} orders={orders} profile={profile} authenticated={Boolean(user)} />;
}
