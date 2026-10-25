import { NextResponse } from "next/server";
import { AffiliateReferralType, AffiliateReferralStatus, Prisma } from "@/lib/db/generated/main";
import { requireActiveAffiliate } from "@/lib/affiliate/api";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: Request) {
    const access = await requireActiveAffiliate();
    if ("response" in access) return access.response;
    const params = new URL(request.url).searchParams;
    const page = Math.max(1, Math.min(Number.parseInt(params.get("page") ?? "1", 10) || 1, 1000));
    const pageSize = 20;
    const type = params.get("type");
    const status = params.get("status");
    const query = (params.get("q") ?? "").trim().slice(0, 80);
    const where: Prisma.AffiliateReferralWhereInput = {
        affiliateId: access.affiliate.id,
        ...(type && Object.values(AffiliateReferralType).includes(type as AffiliateReferralType) ? { referralType: type as AffiliateReferralType } : {}),
        ...(status && Object.values(AffiliateReferralStatus).includes(status as AffiliateReferralStatus) ? { status: status as AffiliateReferralStatus } : {}),
        ...(query ? { OR: [{ referredUser: { is: { name: { contains: query } } } }, { referredShop: { is: { name: { contains: query } } } }] } : {}),
    };
    const [items, total, totalClicks, registered, ordered, earned] = await Promise.all([
        prisma.affiliateReferral.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, include: { referredUser: { select: { name: true } }, referredShop: { select: { name: true } }, commissions: { select: { commissionAmount: true, status: true } } } }),
        prisma.affiliateReferral.count({ where }),
        prisma.affiliateClick.count({ where: { affiliateId: access.affiliate.id } }),
        prisma.affiliateReferral.count({ where: { affiliateId: access.affiliate.id, referralType: "CUSTOMER", status: "REGISTERED" } }),
        prisma.affiliateCommission.count({ where: { affiliateId: access.affiliate.id, commissionType: "CUSTOMER_ORDER" } }),
        prisma.affiliateCommission.aggregate({ where: { affiliateId: access.affiliate.id, status: { in: ["APPROVED", "PAID"] } }, _sum: { commissionAmount: true } }),
    ]);
    return NextResponse.json({ referrals: items.map((item) => ({ id: item.id, type: item.referralType, name: item.referredUser?.name ?? item.referredShop?.name ?? "Awaiting registration", status: item.status, registeredAt: item.registeredAt.toISOString(), earned: item.commissions.reduce((sum, commission) => sum + (["APPROVED", "PAID"].includes(commission.status) ? commission.commissionAmount : 0), 0) })), stats: { clicks: totalClicks, registered, orders: ordered, commissionEarned: earned._sum.commissionAmount ?? 0 }, page, pageSize, total, pages: Math.ceil(total / pageSize) });
}
