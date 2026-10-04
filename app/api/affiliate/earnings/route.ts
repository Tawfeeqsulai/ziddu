import { NextResponse } from "next/server";
import { requireActiveAffiliate } from "@/lib/affiliate/api";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: Request) {
    const access = await requireActiveAffiliate();
    if ("response" in access) return access.response;
    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Math.min(Number.parseInt(params.get("page") ?? "1", 10) || 1, 1000));
    const pageSize = 20;
    const [commissions, total, grouped] = await Promise.all([
        prisma.affiliateCommission.findMany({ where: { affiliateId: access.affiliate.id }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { referral: { include: { referredUser: { select: { name: true } }, referredShop: { select: { name: true } } } } } }),
        prisma.affiliateCommission.count({ where: { affiliateId: access.affiliate.id } }),
        prisma.affiliateCommission.groupBy({ by: ["commissionType", "status"], where: { affiliateId: access.affiliate.id }, _sum: { commissionAmount: true }, _count: { _all: true } }),
    ]);
    return NextResponse.json({ commissions: commissions.map((item) => ({ id: item.id, type: item.commissionType, description: item.referral.referredUser?.name ?? item.referral.referredShop?.name ?? item.commissionType.replaceAll("_", " "), amount: item.commissionAmount, baseAmount: item.baseAmount, commissionRate: item.commissionRate, status: item.status, date: item.createdAt.toISOString() })), breakdown: grouped.map((item) => ({ type: item.commissionType, status: item.status, amount: item._sum.commissionAmount ?? 0, count: item._count._all })), page, pageSize, total, pages: Math.ceil(total / pageSize) });
}
