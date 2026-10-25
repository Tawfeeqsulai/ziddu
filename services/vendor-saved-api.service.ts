import "server-only";

import { getSharedLikeUserId } from "@/services/likes-api.service";

const SAVED_API = "https://zoggy-backend-api.vercel.app/api/issaved";

export type VendorSavedState = { saved: boolean; savedCount?: number };

function parseSavedState(value: unknown): VendorSavedState | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as { data?: { is_saved?: unknown; saved?: unknown; saved_count?: unknown } };
  const data = payload.data;
  if (!data || typeof data !== "object") return null;
  const saved = typeof data.is_saved === "boolean" ? data.is_saved : data.saved;
  const savedCount = Number(data.saved_count);
  return {
    saved: saved === true || saved === 1 || saved === "true",
    ...(Number.isFinite(savedCount) && savedCount >= 0 ? { savedCount } : {}),
  };
}

async function fetchVendorSavedState(postId: string, sharedUserId: number) {
  const query = new URLSearchParams({ post_id: postId, user_id: String(sharedUserId) });
  const response = await fetch(`${SAVED_API}?${query}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  return parseSavedState(await response.json());
}

export async function getVendorSavedState(postId: string, appUserId?: string): Promise<VendorSavedState | null> {
  if (!appUserId || !/^\d+$/.test(postId)) return null;
  let sharedUserId: number | null;
  try {
    sharedUserId = await getSharedLikeUserId(appUserId);
  } catch {
    return null;
  }
  if (sharedUserId === null) return null;
  return fetchVendorSavedState(postId, sharedUserId);
}

export async function getVendorSavedStates(postIds: string[], appUserId?: string) {
  const states = new Map<string, VendorSavedState>();
  if (!appUserId) return states;
  const ids = [...new Set(postIds.filter((id) => /^\d+$/.test(id)))];
  if (!ids.length) return states;
  let sharedUserId: number | null;
  try {
    sharedUserId = await getSharedLikeUserId(appUserId);
  } catch {
    return states;
  }
  if (sharedUserId === null) return states;
  for (let index = 0; index < ids.length; index += 8) {
    const batch = ids.slice(index, index + 8);
    const results = await Promise.all(batch.map(async (postId) => [postId, await fetchVendorSavedState(postId, sharedUserId).catch(() => null)] as const));
    for (const [postId, state] of results) if (state) states.set(postId, state);
  }
  return states;
}

export async function updateVendorSavedState(postId: number, appUserId: string, saved: boolean) {
  const sharedUserId = await getSharedLikeUserId(appUserId);
  if (sharedUserId === null) throw new Error("Add a phone number linked to your vendor account before saving vendor posts.");
  const response = await fetch(SAVED_API, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ post_id: postId, user_id: sharedUserId, saved }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : `Saved posts service rejected the request (${response.status}).`;
    throw new Error(message);
  }
  return parseSavedState(payload) ?? { saved };
}
