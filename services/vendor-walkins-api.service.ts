import "server-only";

const WALKIN_API = "https://zoggy-backend-api.vercel.app/api/walkin";

type WalkinPayload = { success?: boolean; message?: string; data?: { walkin_id?: number } };

// Stores one walk-in for the vendor; the vendor app counts these records.
export async function recordVendorWalkin(vendorId: number, userId: number) {
  const response = await fetch(WALKIN_API, {
    method: "POST",
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ vendor_id: vendorId, user_id: userId }),
  });
  const payload = await response.json().catch(() => null) as WalkinPayload | null;
  if (!response.ok || payload?.success === false) {
    throw new Error(typeof payload?.message === "string" ? payload.message : `Walk-in service rejected the visit (${response.status}).`);
  }
  return { walkinId: typeof payload?.data?.walkin_id === "number" ? payload.data.walkin_id : null };
}
