import { NextResponse } from "next/server";
import { z } from "zod";
import { affiliateError, requireActiveAffiliate } from "@/lib/affiliate/api";
import { createAffiliateVendorAccount } from "@/services/affiliate.service";

const vendorSchema = z.object({
    name: z.string().trim().min(2).max(100),
    category: z.enum(["RESTAURANT", "FURNITURE", "ELECTRONICS"]),
    description: z.string().trim().max(500),
    address: z.string().trim().min(5).max(240),
    locality: z.string().trim().min(2).max(100),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().min(2).max(100),
    pincode: z.string().trim().regex(/^[1-9]\d{5}$/),
    phone: z.string().trim().regex(/^\+?[1-9]\d{7,14}$/),
    email: z.union([z.string().trim().email().max(254), z.literal("")]),
});

export async function POST(request: Request) {
    const access = await requireActiveAffiliate();
    if ("response" in access) return access.response;

    const parsed = vendorSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
        return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Check your vendor account details." }, { status: 400 });
    }

    try {
        const shop = await createAffiliateVendorAccount(access.user.id, parsed.data);
        return NextResponse.json({ shop: { id: shop.id, handle: shop.handle, status: shop.vendorStatus } }, { status: 201 });
    } catch (error) {
        return affiliateError(error);
    }
}