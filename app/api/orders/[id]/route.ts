import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

function orderCode(id: string) { return `ZIDDU-${id.slice(-8).toUpperCase()}`; }

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
    const { id } = await params;
    const bill = await prisma.bill.findFirst({ where: { id, endUserId: user.id }, include: { shop: { include: { location: true } } } });
    if (!bill) return NextResponse.json({ message: "Order not found." }, { status: 404 });
    return NextResponse.json({ order: { id: bill.id, reference: orderCode(bill.id), status: bill.paymentStatus, amount: bill.totalPriceInr, products: bill.products, createdAt: bill.createdAt.toISOString(), updatedAt: bill.updatedAt.toISOString(), shop: bill.shop } });
}
