import "server-only";

import { getSharedLikeUserId } from "@/services/likes-api.service";

const SHARES_API = "https://zoggy-backend-api.vercel.app/api/shares";

export async function getVendorPostShareCounts(vendorIds: number[]) {
  const counts = new Map<string, number>();
  await Promise.all([...new Set(vendorIds.filter(Number.isInteger))].map(async (vendorId) => {
    try {
      const response = await fetch(`${SHARES_API}?vendor_id=${vendorId}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) return;
      const payload: unknown = await response.json();
      const data = payload && typeof payload === "object" && "data" in payload && payload.data && typeof payload.data === "object"
        ? payload.data as Record<string, unknown>
        : {};
      if (!Array.isArray(data.posts)) return;
      for (const item of data.posts) {
        if (!item || typeof item !== "object") continue;
        const post = item as Record<string, unknown>;
        const postId = String(post.post_id ?? "");
        const shareCount = Number(post.share_count);
        if (/^\d+$/.test(postId) && Number.isFinite(shareCount) && shareCount >= 0) counts.set(postId, shareCount);
      }
    } catch {
      // Keep the app's local share counts as a fallback when the API is unavailable.
    }
  }));
  return counts;
}

export async function recordVendorPostShare(postId: number, appUserId: string) {
  const userId = await getSharedLikeUserId(appUserId);
  if (userId === null) throw new Error("A linked vendor account is required to record this share.");

  const response = await fetch(SHARES_API, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId, post_id: postId }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : `Shares service rejected the request (${response.status}).`;
    throw new Error(message);
  }

  const data = payload && typeof payload === "object" && "data" in payload && payload.data && typeof payload.data === "object"
    ? payload.data as Record<string, unknown>
    : {};
  const number = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  };
  return { shareCount: number(data.post_share_count), vendorShareCount: number(data.vendor_share_count) };
}
