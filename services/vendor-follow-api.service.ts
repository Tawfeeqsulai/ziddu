import "server-only";

import { getSharedLikeUserId } from "@/services/likes-api.service";

const FOLLOW_API = "https://zoggy-backend-api.vercel.app/api/follow";

type FollowPayload = {
  success?: boolean;
  data?: {
    is_following?: boolean;
    followed?: boolean;
    follower_count?: number;
  };
};

function parseFollowPayload(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const payload = value as FollowPayload;
  const data = payload.data;
  if (!data || typeof data !== "object") return null;
  const followed = typeof data.is_following === "boolean" ? data.is_following : data.followed;
  const followerCount = Number(data.follower_count);
  return {
    ...(typeof followed === "boolean" ? { followed } : {}),
    ...(Number.isFinite(followerCount) && followerCount >= 0 ? { followerCount } : {}),
  };
}

export async function getVendorFollowState(vendorId: number, appUserId?: string) {
  const sharedUserId = await getSharedLikeUserId(appUserId);
  const query = new URLSearchParams({ vendor_id: String(vendorId) });
  if (sharedUserId !== null) query.set("user_id", String(sharedUserId));
  const response = await fetch(`${FOLLOW_API}?${query}`, {
    // Anonymous counts are the same for everyone, so share them briefly; a
    // signed-in viewer always gets their own fresh state.
    ...(sharedUserId === null ? { next: { revalidate: 5 } } : { cache: "no-store" as const }),
    signal: AbortSignal.timeout(8_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  return parseFollowPayload(await response.json());
}

export async function updateVendorFollow(vendorId: number, appUserId: string, followed: boolean) {
  const sharedUserId = await getSharedLikeUserId(appUserId);
  if (sharedUserId === null) throw new Error("Add a phone number linked to your vendor account before following vendors.");
  const response = await fetch(FOLLOW_API, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ vendor_id: vendorId, user_id: sharedUserId, followed }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const data = parseFollowPayload(payload);
    throw new Error(data ? "Vendor follow could not be updated." : `Vendor follow service rejected the request (${response.status}).`);
  }
  return parseFollowPayload(payload) ?? { followed };
}
