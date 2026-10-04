import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { affiliateError } from "@/lib/affiliate/api";
import { registerAffiliate } from "@/services/affiliate.service";

const registrationSchema = z.object({
    address: z.string().trim().min(5).max(200),
    city: z.string().trim().min(2).max(80),
    state: z.string().trim().min(2).max(80),
    pincode: z.string().trim().regex(/^\d{6}$/),
    accountHolderName: z.string().trim().min(2).max(80),
    bankName: z.string().trim().min(2).max(80),
    branchName: z.string().trim().max(80),
    accountNumber: z.string().regex(/^\d{9,18}$/),
    confirmAccountNumber: z.string().regex(/^\d{9,18}$/),
    ifscCode: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/),
    upiId: z.string().trim().max(100),
    termsAccepted: z.literal(true),
}).refine((input) => input.accountNumber === input.confirmAccountNumber, {
    path: ["confirmAccountNumber"],
    message: "Account numbers do not match.",
});

export async function POST(request: Request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
    if (!user.onboardingCompleted) return NextResponse.json({ message: "Complete your ZIDDU profile first." }, { status: 403 });
    const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Check your affiliate registration details." }, { status: 400 });
    const { termsAccepted, accountNumber, confirmAccountNumber, ...rest } = parsed.data;
    if (!termsAccepted) return NextResponse.json({ message: "Confirm the affiliate terms to continue." }, { status: 400 });
    if (accountNumber !== confirmAccountNumber) return NextResponse.json({ message: "Account numbers do not match." }, { status: 400 });
    const details = { ...rest, accountNumber };
    try {
        const result = await registerAffiliate(user.id, details);
        return NextResponse.json({ affiliate: { code: result.affiliate.affiliateCode, status: result.affiliate.status } }, { status: 201 });
    } catch (error) {
        return affiliateError(error);
    }
}
