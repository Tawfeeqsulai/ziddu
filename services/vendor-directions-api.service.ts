import "server-only";

import { getSharedLikeUserId } from "@/services/likes-api.service";

const DIRECTION_API = "https://zoggy-backend-api.vercel.app/api/direction";

type DirectionStats = { vendorPageClicks?: number; postClicks?: number; totalClicks?: number };

function parseStats(payload: unknown): DirectionStats | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as { data?: unknown }).data;
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const number = (value: unknown) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  };
  return {
    vendorPageClicks: number(record.vendor_page_clicks),
    postClicks: number(record.post_clicks),
    totalClicks: number(record.total_clicks) ?? number(record.click_count),
  };
}

export async function getVendorDirectionStats(vendorId: number): Promise<DirectionStats | null> {
  const response = await fetch(`${DIRECTION_API}?vendor_id=${vendorId}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) return null;
  return parseStats(await response.json());
}

export async function recordVendorDirection(vendorId: number, postId: string | undefined, appUserId: string) {
  const userId = await getSharedLikeUserId(appUserId);
  if (userId === null) throw new Error("A linked vendor account is required to record this visit.");
  const response = await fetch(DIRECTION_API, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(postId && /^\d+$/.test(postId)
      ? { user_id: userId, post_id: Number(postId) }
      : { user_id: userId, vendor_id: vendorId }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string"
      ? payload.message
      : `Directions service rejected the visit (${response.status}).`;
    throw new Error(message);
  }
  return parseStats(payload);
}
