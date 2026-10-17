import { NextResponse } from "next/server";
import { z } from "zod";
import { affiliateError, requireActiveAffiliate } from "@/lib/affiliate/api";
import { prisma } from "@/lib/db/prisma";
import { addMaskedPayoutAccount, getAffiliateDashboard } from "@/services/affiliate.service";

const payoutAccountSchema = z.object({
    accountHolderName: z.string().trim().min(2).max(80),
    bankName: z.string().trim().min(2).max(80),
    accountLast4: z.string().regex(/^\d{4}$/),
    ifscCode: z.string().trim().toUpperCase().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/),
});

export async function GET() {
    const access = await requireActiveAffiliate();
    if ("response" in access) return access.response;
    const [dashboard, user] = await Promise.all([
        getAffiliateDashboard(access.user.id),
        prisma.user.findUnique({ where: { id: access.user.id }, select: { name: true, phoneNumber: true, image: true, username: true, createdAt: true } }),
    ]);
    return NextResponse.json({ profile: { affiliate: dashboard?.affiliate, user, accounts: dashboard?.payoutAccounts ?? [] } });
}

export async function POST(request: Request) {
    const access = await requireActiveAffiliate();
    if ("response" in access) return access.response;
    const parsed = payoutAccountSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ message: "Enter valid payout account display details." }, { status: 400 });
    try {
        const account = await addMaskedPayoutAccount(access.user.id, parsed.data);
        return NextResponse.json({ account: { id: account.id, accountHolderName: account.accountHolderName, bankName: account.bankName, accountLast4: account.accountLast4, ifscCode: account.ifscCode, verified: account.verified } }, { status: 201 });
    } catch (error) {
        return affiliateError(error);
    }
}
