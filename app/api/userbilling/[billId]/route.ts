import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { normalizeIndianPhone } from "@/lib/auth/phone";
import { prisma } from "@/lib/db/prisma";
import { sharedPrisma } from "@/lib/db/shared-prisma";
import { calculateOfferLine, offerPricing } from "@/lib/offer-pricing";

const updateSchema = z.object({
  vendorId: z.coerce.number().int().positive(),
  requestId: z.string().min(8).max(100),
  items: z.array(z.object({ itemId: z.coerce.number().int().positive(), quantity: z.coerce.number().int().positive().max(100) })).min(1),
});

type BillProduct = { item_id: number; quantity: number; price: number; total_price: number };
type BillPayload = { products?: unknown[]; _updateRequestIds?: string[] };

function normalizeBillProducts(value: unknown): BillProduct[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const product = row.product && typeof row.product === "object" ? row.product as Record<string, unknown> : {};
    const itemId = Number(row.item_id ?? row.itemId ?? product.item_id ?? product.itemId ?? product.id);
    const quantity = Number(row.quantity);
    const price = Number(row.price ?? row.unit_price ?? row.unitPrice ?? product.price ?? product.unit_price ?? product.unitPrice);
    if (!Number.isInteger(itemId) || itemId <= 0 || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) return [];
    const total = Number(row.total_price ?? quantity * price);
    return [{ item_id: itemId, quantity, price, total_price: Number.isFinite(total) && total >= 0 ? total : Math.round(quantity * price * 100) / 100 }];
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ billId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Add at least one valid menu item." }, { status: 400 });
  const billId = Number((await params).billId);
  if (!Number.isInteger(billId) || billId <= 0) return NextResponse.json({ message: "That order is invalid." }, { status: 400 });

  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { phoneNumber: true } });
  const phoneNumber = normalizeIndianPhone(account?.phoneNumber ?? user.phoneNumber ?? "");
  if (!phoneNumber) return NextResponse.json({ message: "Add and verify your phone number before updating an order." }, { status: 400 });
  const nationalNumber = phoneNumber.slice(3);
  const orderingUser = await sharedPrisma.sharedUser.findFirst({ where: { phoneNumber: { in: [phoneNumber, nationalNumber, `91${nationalNumber}`, `0${nationalNumber}`] } }, select: { id: true } });
  if (!orderingUser) return NextResponse.json({ message: "Your ordering account could not be found." }, { status: 400 });

  const bill = await sharedPrisma.sharedBill.findFirst({ where: { id: billId, endUserId: orderingUser.id, vendorId: parsed.data.vendorId } });
  if (!bill) return NextResponse.json({ message: "Order not found." }, { status: 404 });
  if (["paid", "success", "completed", "cancelled", "rejected", "ready"].includes(bill.paymentStatus.toLowerCase())) return NextResponse.json({ message: "This order can no longer be changed." }, { status: 409 });

  const current = bill.products && typeof bill.products === "object" && !Array.isArray(bill.products) ? bill.products as BillPayload : { products: Array.isArray(bill.products) ? bill.products : [] };
  if ((current._updateRequestIds ?? []).includes(parsed.data.requestId)) return NextResponse.json({ billId: bill.id, total: Number(bill.totalPrice), duplicate: true });
  const uniqueItemIds = [...new Set(parsed.data.items.map((item) => item.itemId))];
  const [items, offers] = await Promise.all([
    sharedPrisma.sharedMenuItem.findMany({ where: { vendorId: bill.vendorId, id: { in: uniqueItemIds } }, select: { id: true, price: true } }),
    sharedPrisma.sharedOffer.findMany({ where: { vendorId: bill.vendorId, offerTargetId: { in: uniqueItemIds } }, select: { offerTargetId: true, offerTargetType: true, offerType: true, offerValue: true, validityFrom: true, validityTo: true } }),
  ]);
  if (items.length !== uniqueItemIds.length) return NextResponse.json({ message: "One or more menu items are unavailable." }, { status: 409 });
  const prices = new Map(items.map((item) => [item.id, Number(item.price)]));
  const now = new Date();
  const additions = parsed.data.items.map((requested) => {
    const price = prices.get(requested.itemId)!;
    const active = offers.find((offer) => {
      const targetType = offer.offerTargetType?.toUpperCase();
      return offer.offerTargetId === requested.itemId && (!targetType || /ITEM|PRODUCT|MENU/.test(targetType)) && (!offer.validityFrom || offer.validityFrom <= now) && (!offer.validityTo || offer.validityTo >= now);
    });
    const line = calculateOfferLine(price, requested.quantity, offerPricing(active?.offerType, active?.offerValue));
    const appliedUnitPrice = line.total / line.billedQuantity;
    return { item_id: requested.itemId, quantity: line.billedQuantity, price: Math.round(appliedUnitPrice * 100) / 100, total_price: Math.round(line.total * 100) / 100 };
  });
  // Preserve the discounted line total while using an effective per-served-unit
  // price so the vendor's quantity × price calculation stays consistent.
  const merged = normalizeBillProducts(current.products);
  for (const requested of additions) {
    const existing = merged.find((item) => item.item_id === requested.item_id && item.price === requested.price);
    if (existing) {
      existing.quantity += requested.quantity;
      existing.total_price = Math.round((existing.total_price + requested.total_price) * 100) / 100;
    } else {
      merged.push(requested);
    }
  }
  const total = Math.round(merged.reduce((sum, item) => sum + item.total_price, 0) * 100) / 100;
  const products = { products: merged, _updateRequestIds: [...(current._updateRequestIds ?? []), parsed.data.requestId].slice(-20) };
  const updated = await sharedPrisma.sharedBill.update({ where: { id: bill.id }, data: { products, totalPrice: total } });
  return NextResponse.json({ billId: updated.id, total: Number(updated.totalPrice), products: merged, status: updated.paymentStatus });
}
