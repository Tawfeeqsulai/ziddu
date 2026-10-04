import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { createCustomerOrderCommission } from "@/services/affiliate.service";

const createOrderSchema = z.object({
    postId: z.string().regex(/^[\da-f]{24}$/i),
    quantity: z.number().int().min(1).max(20).default(1),
    paymentMethod: z.enum(["PAY_AT_SHOP", "SIMULATED_UPI", "SIMULATED_CARD"]).default("SIMULATED_CARD"),
});

function orderCode(id: string) { return `ZIDDU-${id.slice(-8).toUpperCase()}`; }

export async function GET() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
    const bills = await prisma.bill.findMany({ where: { endUserId: user.id }, orderBy: { createdAt: "desc" }, take: 50, include: { shop: { include: { location: true } } } });
    return NextResponse.json({ orders: bills.map((bill) => ({ id: bill.id, reference: orderCode(bill.id), status: bill.paymentStatus, amount: bill.totalPriceInr, paymentMethod: (bill.products as { paymentMethod?: string }).paymentMethod ?? "SIMULATED_CARD", products: bill.products, createdAt: bill.createdAt.toISOString(), shop: bill.shop })) });
}

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
    const parsed = createOrderSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ message: "Invalid order." }, { status: 400 });
    const post = await prisma.post.findUnique({ where: { id: parsed.data.postId }, include: { shop: true, offer: { include: { product: true } } } });
    if (!post || !post.offer?.product) return NextResponse.json({ message: "This offer is unavailable." }, { status: 404 });
    const price = typeof post.offer.offerValue === "object" && post.offer.offerValue !== null && "priceInr" in post.offer.offerValue ? Number(post.offer.offerValue.priceInr) : post.offer.product.priceInr;
    const total = price * parsed.data.quantity;
    const bill = await prisma.$transaction(async (tx) => {
        const createdBill = await tx.bill.create({ data: { shopId: post.shopId, endUserId: user.id, totalPriceInr: total, paymentStatus: "PAID", products: { postId: post.id, productId: post.offer!.product!.id, item: post.offer!.product!.name, offer: post.title, quantity: parsed.data.quantity, unitPrice: price, paymentMethod: parsed.data.paymentMethod } }, include: { shop: { include: { location: true } } } });
        await createCustomerOrderCommission(tx, user.id, createdBill.id, total);
        return createdBill;
    });
    return NextResponse.json({ order: { id: bill.id, reference: orderCode(bill.id), status: bill.paymentStatus, amount: bill.totalPriceInr, createdAt: bill.createdAt.toISOString(), shop: bill.shop } }, { status: 201 });
}
