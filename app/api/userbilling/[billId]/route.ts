import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { normalizeIndianPhone } from "@/lib/auth/phone";
import { prisma } from "@/lib/db/prisma";
import { sharedPrisma } from "@/lib/db/shared-prisma";

const updateSchema = z.object({
  vendorId: z.coerce.number().int().positive(),
  requestId: z.string().min(8).max(100),
  items: z.array(z.object({ itemId: z.coerce.number().int().positive(), quantity: z.coerce.number().int().positive().max(100) })).min(1),
});

type BillProduct = { item_id: number; quantity: number; price: number; total_price: number };
type BillPayload = { products?: BillProduct[]; _updateRequestIds?: string[] };

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
  if (["completed", "cancelled", "rejected", "ready"].includes(bill.paymentStatus.toLowerCase())) return NextResponse.json({ message: "This order can no longer be changed." }, { status: 409 });

  const current = bill.products && typeof bill.products === "object" && !Array.isArray(bill.products) ? bill.products as BillPayload : { products: Array.isArray(bill.products) ? bill.products as BillProduct[] : [] };
  if ((current._updateRequestIds ?? []).includes(parsed.data.requestId)) return NextResponse.json({ billId: bill.id, total: Number(bill.totalPrice), duplicate: true });
  const uniqueItemIds = [...new Set(parsed.data.items.map((item) => item.itemId))];
  const items = await sharedPrisma.sharedMenuItem.findMany({ where: { vendorId: bill.vendorId, id: { in: uniqueItemIds } }, select: { id: true, price: true } });
  if (items.length !== uniqueItemIds.length) return NextResponse.json({ message: "One or more menu items are unavailable." }, { status: 409 });
  const prices = new Map(items.map((item) => [item.id, Number(item.price)]));
  const merged = [...(current.products ?? [])];
  for (const requested of parsed.data.items) {
    const price = prices.get(requested.itemId)!;
    const existing = merged.find((item) => item.item_id === requested.itemId);
    if (existing) {
      existing.quantity += requested.quantity;
      existing.total_price = Math.round(existing.quantity * existing.price * 100) / 100;
    } else {
      merged.push({ item_id: requested.itemId, quantity: requested.quantity, price, total_price: Math.round(price * requested.quantity * 100) / 100 });
    }
  }
  const total = Math.round(merged.reduce((sum, item) => sum + item.total_price, 0) * 100) / 100;
  const products = { products: merged, _updateRequestIds: [...(current._updateRequestIds ?? []), parsed.data.requestId].slice(-20) };
  const updated = await sharedPrisma.sharedBill.update({ where: { id: bill.id }, data: { products, totalPrice: total } });
  return NextResponse.json({ billId: updated.id, total: Number(updated.totalPrice), products: merged, status: updated.paymentStatus });
}
