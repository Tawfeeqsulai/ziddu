import { NextResponse } from "next/server";
import { z } from "zod";
import { affiliateError, requireActiveAffiliate } from "@/lib/affiliate/api";
import { prisma } from "@/lib/db/prisma";
import { requestAffiliateWithdrawal } from "@/services/affiliate.service";

const withdrawalSchema = z.object({ amount: z.number().finite().positive(), bankAccountId: z.string().regex(/^[\da-f]{24}$/i), requestKey: z.string().uuid() });

export async function GET() {
    const access = await requireActiveAffiliate();
    if ("response" in access) return access.response;
    const withdrawals = await prisma.affiliateWithdrawal.findMany({ where: { affiliateId: access.affiliate.id }, orderBy: { requestedAt: "desc" }, take: 50, include: { bankAccount: { select: { bankName: true, accountLast4: true } } } });
    return NextResponse.json({ withdrawals: withdrawals.map((item) => ({ id: item.id, amount: item.amount, status: item.status, requestedAt: item.requestedAt.toISOString(), processedAt: item.processedAt?.toISOString(), bank: item.bankAccount ? `${item.bankAccount.bankName} ····${item.bankAccount.accountLast4}` : "Payout account removed" })) });
}

export async function POST(request: Request) {
    const access = await requireActiveAffiliate();
    if ("response" in access) return access.response;
    const parsed = withdrawalSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ message: "Check the withdrawal amount and payout account." }, { status: 400 });
    try {
        const withdrawal = await requestAffiliateWithdrawal(access.user.id, parsed.data.amount, parsed.data.bankAccountId, parsed.data.requestKey);
        return NextResponse.json({ withdrawal: { id: withdrawal.id, amount: withdrawal.amount, status: withdrawal.status } }, { status: 201 });
    } catch (error) {
        return affiliateError(error);
    }
}
