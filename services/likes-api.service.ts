import "server-only";
import { cache } from "react";

import { normalizeIndianPhone } from "@/lib/auth/phone";
import { prisma } from "@/lib/db/prisma";

const LIKES_API = "https://zoggy-backend-api.vercel.app/api/likes";

export type ExternalLikeState = { likeCount: number; liked: boolean };

function recordsFromPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  if (Array.isArray(record.data)) return record.data;
  if (record.data && typeof record.data === "object") return [record.data];
  if ("post_id" in record) return [record];
  return [];
}

function readLikeRecord(value: unknown): { postId: string; state: ExternalLikeState } | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const postId = record.post_id;
  const likeCount = Number(record.like_count);
  if ((typeof postId !== "number" && typeof postId !== "string") || !Number.isFinite(likeCount)) return null;
  return {
    postId: String(postId),
    state: { likeCount: Math.max(0, likeCount), liked: record.is_liked === true || record.is_liked === 1 || record.is_liked === "true" },
  };
}

// Cached per request: likes, saves and every vendor's follow state need the same lookup.
export const getSharedLikeUserId = cache(async (appUserId?: string): Promise<number | null> => {
  if (!appUserId) return null;
  const account = await prisma.user.findUnique({ where: { id: appUserId }, select: { phoneNumber: true } });
  const normalizedPhone = normalizeIndianPhone(account?.phoneNumber ?? "");
  if (!normalizedPhone) return null;

  const nationalNumber = normalizedPhone.slice(3);
  const phoneVariants = [normalizedPhone, nationalNumber, `91${nationalNumber}`, `0${nationalNumber}`];
  const sharedUser = await prisma.sharedUser.findFirst({
    where: { phoneNumber: { in: phoneVariants } },
    select: { id: true },
  });
  return sharedUser?.id ?? null;
});

export async function getExternalLikesForPosts(appUserId: string | undefined, postIds: string[]): Promise<Map<string, ExternalLikeState>> {
  const ids = [...new Set(postIds.filter((id) => /^\d+$/.test(id)))];
  if (ids.length === 0) return new Map();

  try {
    const sharedUserId = await getSharedLikeUserId(appUserId);
    const query = new URLSearchParams();
    if (sharedUserId !== null) query.set("user_id", String(sharedUserId));
    const response = await fetch(`${LIKES_API}${query.size ? `?${query}` : ""}`, {
      // Anonymous counts are the same for everyone, so share them briefly.
      ...(sharedUserId === null ? { next: { revalidate: 5 } } : { cache: "no-store" as const }),
      signal: AbortSignal.timeout(8_000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return new Map();
    const payload: unknown = await response.json();
    const wanted = new Set(ids);
    return new Map(recordsFromPayload(payload)
      .map(readLikeRecord)
      .filter((item): item is { postId: string; state: ExternalLikeState } => Boolean(item && wanted.has(item.postId)))
      .map((item) => [item.postId, item.state]));
  } catch {
    return new Map();
  }
}

export async function updateExternalLike(postId: number, userId: number, active: boolean) {
  const response = await fetch(LIKES_API, {
    method: active ? "POST" : "DELETE",
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ post_id: postId, user_id: userId }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : `Likes service rejected the request (${response.status}).`;
    throw new Error(message);
  }

  const query = new URLSearchParams({ post_id: String(postId), user_id: String(userId) });
  const stateResponse = await fetch(`${LIKES_API}?${query}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
    headers: { Accept: "application/json" },
  });
  if (!stateResponse.ok) return null;
  const statePayload: unknown = await stateResponse.json().catch(() => null);
  return recordsFromPayload(statePayload).map(readLikeRecord).find((item) => item?.postId === String(postId))?.state ?? null;
}
