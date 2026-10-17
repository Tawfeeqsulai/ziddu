import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { sharedPrisma } from "@/lib/db/shared-prisma";
import { normalizeIndianPhone } from "@/lib/auth/phone";
import { prisma } from "@/lib/db/prisma";

const BILLING_API_URL = "https://zoggy-backend-api.vercel.app/api/userbilling";

const billingSchema = z.object({
  vendorId: z.coerce.number().int().positive(),
  items: z.array(z.object({ itemId: z.coerce.number().int().positive(), quantity: z.coerce.number().int().positive().max(100) })).min(1),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

  const parsed = billingSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ message: "Add at least one valid menu item." }, { status: 400 });

  // Read the phone from the database instead of the session object. The
  // session can still contain the pre-verification user snapshot.
  const account = await prisma.user.findUnique({ where: { id: user.id }, select: { phoneNumber: true, phoneNumberVerified: true } });
  const phoneNumber = normalizeIndianPhone(account?.phoneNumber ?? user.phoneNumber ?? "");
  if (!phoneNumber) return NextResponse.json({ message: "Add and verify a valid Indian mobile number in your profile before ordering." }, { status: 400 });

  // The legacy vendor database contains phone numbers in both +91XXXXXXXXXX
  // and XXXXXXXXXX formats. Match both representations to find the same user.
  const nationalNumber = phoneNumber.slice(3);
  const phoneVariants = [phoneNumber, nationalNumber, `91${nationalNumber}`, `0${nationalNumber}`];

  const [endUser, vendor] = await Promise.all([
    sharedPrisma.sharedUser.findFirst({ where: { phoneNumber: { in: phoneVariants } } }),
    sharedPrisma.sharedVendor.findUnique({ where: { id: parsed.data.vendorId }, select: { id: true } }),
  ]);
  if (!endUser) return NextResponse.json({ message: "We couldn't match your mobile number to an ordering account. Make sure you use the same number registered with this vendor system." }, { status: 400 });
  if (!vendor) return NextResponse.json({ message: "This vendor is unavailable." }, { status: 404 });

  const requestedItemIds = [...new Set(parsed.data.items.map((item) => item.itemId))];
  const menuItems = await sharedPrisma.sharedMenuItem.findMany({ where: { vendorId: vendor.id, id: { in: requestedItemIds } }, select: { id: true, price: true } });
  const prices = new Map(menuItems.map((item) => [item.id, Number(item.price)]));
  if (menuItems.length !== requestedItemIds.length) return NextResponse.json({ message: "One or more menu items are no longer available." }, { status: 409 });

  const products = parsed.data.items.map((item) => {
    const price = prices.get(item.itemId)!;
    return { item_id: item.itemId, quantity: item.quantity, price, total_price: Math.round(price * item.quantity * 100) / 100 };
  });
  const totalPrice = Math.round(products.reduce((total, product) => total + product.total_price, 0) * 100) / 100;
  const payload = { vendor_id: vendor.id, end_user_id: endUser.id, products, total_price: totalPrice };

  try {
    const response = await fetch(BILLING_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const responseBody = await response.json().catch(() => null);
    if (!response.ok) return NextResponse.json({ message: responseBody?.message ?? "The billing service rejected this order." }, { status: 502 });
    return NextResponse.json({ billing: responseBody, payload }, { status: response.status || 201 });
  } catch {
    return NextResponse.json({ message: "The billing service is unavailable. Please try again." }, { status: 502 });
  }
}
