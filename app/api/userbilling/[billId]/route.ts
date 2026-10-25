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

// Same line shape the vendor billing API writes; `bills.products` must stay a plain array of these.
type BillProduct = { price: number; item_id: number; quantity: number; category_id: number | null; total_price: number; sub_category_id: number | null };

const LOCKED_STATUSES = ["paid", "success", "completed", "cancelled", "rejected", "ready"];
// Request ids of recent updates, so a retried request is not added twice.
const REQUEST_TTL_MS = 10 * 60 * 1000;
const recentRequests = new Map<string, { billId: number; expires: number }>();

function rememberRequest(requestId: string, billId: number) {
  const now = Date.now();
  for (const [id, entry] of recentRequests) if (entry.expires < now) recentRequests.delete(id);
  recentRequests.set(requestId, { billId, expires: now + REQUEST_TTL_MS });
}

function optionalId(value: unknown) {
  const id = Number(value);
  return value != null && Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeBillProducts(value: unknown): BillProduct[] {
  // Older updates wrapped the lines as { products: [...], _updateRequestIds: [...] }.
  const lines = Array.isArray(value) ? value : value && typeof value === "object" && Array.isArray((value as { products?: unknown }).products) ? (value as { products: unknown[] }).products : [];

  return lines.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const product = row.product && typeof row.product === "object" ? row.product as Record<string, unknown> : {};
    const itemId = Number(row.item_id ?? row.itemId ?? product.item_id ?? product.itemId ?? product.id);
    const quantity = Number(row.quantity);
    const price = Number(row.price ?? row.unit_price ?? row.unitPrice ?? product.price ?? product.unit_price ?? product.unitPrice);
    if (!Number.isInteger(itemId) || itemId <= 0 || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(price) || price < 0) return [];
    const total = Number(row.total_price ?? quantity * price);
    return [{
      price,
      item_id: itemId,
      quantity,
      category_id: optionalId(row.category_id ?? row.categoryId),
      total_price: Number.isFinite(total) && total >= 0 ? total : Math.round(quantity * price * 100) / 100,
      sub_category_id: optionalId(row.sub_category_id ?? row.subCategoryId),
    }];
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

  const bill = await sharedPrisma.sharedBill.findFirst({ where: { id: billId, endUserId: orderingUser.id, vendorId: parsed.data.vendorId }, select: { id: true, vendorId: true, totalPrice: true } });
  if (!bill) return NextResponse.json({ message: "Order not found." }, { status: 404 });
  if (recentRequests.get(parsed.data.requestId)?.billId === bill.id) return NextResponse.json({ billId: bill.id, total: Number(bill.totalPrice), duplicate: true });

  const uniqueItemIds = [...new Set(parsed.data.items.map((item) => item.itemId))];
  const [items, offers] = await Promise.all([
    sharedPrisma.sharedMenuItem.findMany({ where: { vendorId: bill.vendorId, id: { in: uniqueItemIds } }, select: { id: true, price: true, menuCategoryId: true, menuSubCategoryId: true } }),
    sharedPrisma.sharedOffer.findMany({ where: { vendorId: bill.vendorId, offerTargetId: { in: uniqueItemIds } }, select: { offerTargetId: true, offerTargetType: true, offerType: true, offerValue: true, validityFrom: true, validityTo: true } }),
  ]);
  if (items.length !== uniqueItemIds.length) return NextResponse.json({ message: "One or more menu items are unavailable." }, { status: 409 });
  const itemById = new Map(items.map((item) => [item.id, item]));
  const now = new Date();
  const additions: BillProduct[] = parsed.data.items.map((requested) => {
    const item = itemById.get(requested.itemId)!;
    const active = offers.find((offer) => {
      const targetType = offer.offerTargetType?.toUpperCase();
      return offer.offerTargetId === requested.itemId && (!targetType || /ITEM|PRODUCT|MENU/.test(targetType)) && (!offer.validityFrom || offer.validityFrom <= now) && (!offer.validityTo || offer.validityTo >= now);
    });
    const line = calculateOfferLine(Number(item.price), requested.quantity, offerPricing(active?.offerType, active?.offerValue));
    // Preserve the discounted line total while using an effective per-served-unit
    // price so the vendor's quantity × price calculation stays consistent.
    const appliedUnitPrice = line.total / line.billedQuantity;
    return {
      price: Math.round(appliedUnitPrice * 100) / 100,
      item_id: requested.itemId,
      quantity: line.billedQuantity,
      category_id: item.menuCategoryId,
      total_price: Math.round(line.total * 100) / 100,
      sub_category_id: item.menuSubCategoryId,
    };
  });

  // Lock the bill row while merging so two quick "add more" requests cannot overwrite each other.
  const result = await sharedPrisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM bills WHERE id = ${bill.id} FOR UPDATE`;
    const fresh = await tx.sharedBill.findUnique({ where: { id: bill.id }, select: { products: true, paymentStatus: true } });
    if (!fresh || LOCKED_STATUSES.includes(fresh.paymentStatus.toLowerCase())) return null;

    const merged = normalizeBillProducts(fresh.products);
    // Fill in categories for older lines that were saved without them.
    const missingIds = [...new Set(merged.filter((line) => line.category_id === null && !itemById.has(line.item_id)).map((line) => line.item_id))];
    const extraItems = missingIds.length ? await tx.sharedMenuItem.findMany({ where: { id: { in: missingIds } }, select: { id: true, menuCategoryId: true, menuSubCategoryId: true } }) : [];
    const categories = new Map([...items, ...extraItems].map((item) => [item.id, item]));
    for (const line of merged) {
      const item = categories.get(line.item_id);
      if (item && line.category_id === null) {
        line.category_id = item.menuCategoryId;
        line.sub_category_id = item.menuSubCategoryId;
      }
    }
    for (const requested of additions) {
      const existing = merged.find((line) => line.item_id === requested.item_id && line.price === requested.price);
      if (existing) {
        existing.quantity += requested.quantity;
        existing.total_price = Math.round((existing.total_price + requested.total_price) * 100) / 100;
      } else {
        merged.push(requested);
      }
    }
    const total = Math.round(merged.reduce((sum, line) => sum + line.total_price, 0) * 100) / 100;
    const updated = await tx.sharedBill.update({ where: { id: bill.id }, data: { products: merged, totalPrice: total, updatedAt: new Date(Math.floor(Date.now() / 1000) * 1000) } });
    return { updated, merged };
  });
  if (!result) return NextResponse.json({ message: "This order can no longer be changed." }, { status: 409 });

  rememberRequest(parsed.data.requestId, bill.id);
  return NextResponse.json({ billId: result.updated.id, total: Number(result.updated.totalPrice), products: result.merged, status: result.updated.paymentStatus });
}
