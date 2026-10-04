import "server-only";
import { randomBytes } from "node:crypto";
import { AffiliateReferralType, AffiliateStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AFFILIATE_PROGRAM, calculateCommission } from "@/lib/affiliate/config";
import type { ReferralAttribution } from "@/lib/affiliate/referral-cookie";

export class AffiliateServiceError extends Error {
    constructor(message: string, readonly status: number) {
        super(message);
    }
}

export type AffiliateRegistrationInput = {
    address: string;
    city: string;
    state: string;
    pincode: string;
    accountHolderName: string;
    bankName: string;
    branchName: string;
    accountNumber: string;
    ifscCode: string;
    upiId: string;
};

export type AffiliateVendorInput = {
    name: string;
    category: "RESTAURANT" | "FURNITURE" | "ELECTRONICS";
    description: string;
    address: string;
    locality: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
    email: string;
};

function newAffiliateCode() {
    return `REF${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function registerAffiliate(userId: string, input: AffiliateRegistrationInput) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, userType: true } });
    if (!user || user.userType !== "END_USER") throw new AffiliateServiceError("Only an existing ZIDDU end user can join the affiliate program.", 403);
    const existing = await prisma.affiliate.findUnique({ where: { userId } });
    if (existing?.status === "SUSPENDED") throw new AffiliateServiceError("This affiliate profile is suspended. Contact support for help.", 403);
    if (existing?.status === "ACTIVE") throw new AffiliateServiceError("You already have an active affiliate profile.", 409);

    for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
            return await prisma.$transaction(async (tx) => {
                const affiliate = existing
                    ? await tx.affiliate.update({ where: { id: existing.id }, data: { status: "ACTIVE" } })
                    : await tx.affiliate.create({ data: { userId, affiliateCode: newAffiliateCode() } });
                await tx.user.update({ where: { id: userId }, data: { address: input.address, city: input.city, state: input.state, pincode: input.pincode } });
                const payoutAccount = await tx.affiliateBankAccount.create({
                    data: {
                        affiliateId: affiliate.id,
                        accountHolderName: input.accountHolderName,
                        bankName: input.bankName,
                        branchName: input.branchName || null,
                        accountLast4: input.accountNumber.slice(-4),
                        ifscCode: input.ifscCode,
                        upiId: input.upiId || null,
                        verified: true,
                    }
                });
                return { affiliate, payoutAccount };
            });
        } catch (error) {
            const raced = await prisma.affiliate.findUnique({ where: { userId } });
            if (raced?.status === "ACTIVE") throw new AffiliateServiceError("Affiliate registration was already completed.", 409);
            if (attempt === 3) throw error;
        }
    }
    throw new AffiliateServiceError("Could not complete affiliate registration.", 500);
}

export async function createAffiliateVendorAccount(userId: string, input: AffiliateVendorInput) {
    return prisma.$transaction(async (tx) => {
        const affiliate = await tx.affiliate.findFirst({ where: { userId, status: "ACTIVE" }, select: { id: true } });
        if (!affiliate) throw new AffiliateServiceError("Active affiliate access is required.", 403);

        const location = await tx.location.create({
            data: {
                address: input.address,
                locality: input.locality,
                city: input.city,
                state: input.state,
                pincode: input.pincode,
            },
        });
        const handle = `${input.name}-${input.locality}-${randomBytes(4).toString("hex")}`
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, "-")
            .replace(/-+/g, "-")
            .replace(/^-|-$/g, "");
        const shop = await tx.shop.create({
            data: {
                name: input.name,
                handle,
                category: input.category,
                status: "Pending verification",
                rating: 0,
                initials: input.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(),
                image: input.category === "RESTAURANT"
                    ? "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=900&q=85"
                    : input.category === "FURNITURE"
                        ? "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=900&q=85"
                        : "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=900&q=85",
                description: input.description || null,
                email: input.email || null,
                phone: input.phone,
                ownerId: userId,
                locationId: location.id,
            },
        });
        await tx.user.update({ where: { id: userId }, data: { userType: "VENDOR" } });
        return shop;
    });
}

export async function deactivateAffiliate(userId: string) {
    const affiliate = await prisma.affiliate.findUnique({ where: { userId }, select: { id: true, status: true } });
    if (!affiliate) throw new AffiliateServiceError("Affiliate profile not found.", 404);
    if (affiliate.status === "SUSPENDED") throw new AffiliateServiceError("This affiliate profile is suspended. Contact support for help.", 403);
    return prisma.affiliate.update({ where: { id: affiliate.id }, data: { status: "INACTIVE" } });
}

export async function getActiveAffiliateByCode(affiliateCode: string) {
    return prisma.affiliate.findFirst({ where: { affiliateCode, status: AffiliateStatus.ACTIVE }, select: { id: true, affiliateCode: true } });
}

export async function recordAffiliateClick(affiliateId: string, referralType: AffiliateReferralType, referralCode: string) {
    return prisma.affiliateClick.create({ data: { affiliateId, referralType, referralCode } });
}

export async function attributeCustomerSignup(userId: string, attribution: ReferralAttribution) {
    if (attribution.type !== "CUSTOMER") return false;
    const [user, click, affiliate, existingReferral] = await Promise.all([
        prisma.user.findUnique({ where: { id: userId }, select: { id: true, createdAt: true, userType: true } }),
        prisma.affiliateClick.findFirst({ where: { id: attribution.clickId, affiliateId: attribution.affiliateId, referralType: "CUSTOMER", createdAt: { gte: new Date(attribution.issuedAt - 60_000) } } }),
        prisma.affiliate.findFirst({ where: { id: attribution.affiliateId, status: "ACTIVE" }, select: { id: true } }),
        prisma.affiliateReferral.findFirst({ where: { referredUserId: userId }, select: { id: true } }),
    ]);
    if (!user || user.userType !== "END_USER" || user.createdAt.getTime() < attribution.issuedAt || !click || !affiliate || existingReferral) return false;

    try {
        await prisma.affiliateReferral.create({ data: { affiliateId: affiliate.id, referralKey: `CUSTOMER:${userId}`, referralType: "CUSTOMER", referredUserId: userId, status: "REGISTERED" } });
        await prisma.affiliateClick.update({ where: { id: click.id }, data: { converted: true } });
        return true;
    } catch {
        return Boolean(await prisma.affiliateReferral.findFirst({ where: { referredUserId: userId }, select: { id: true } }));
    }
}

export async function createCustomerOrderCommission(tx: Prisma.TransactionClient, userId: string, billId: string, amount: number) {
    const referral = await tx.affiliateReferral.findFirst({ where: { referralType: "CUSTOMER", referredUserId: userId, status: { in: ["REGISTERED", "CONVERTED"] }, affiliate: { status: "ACTIVE" } }, include: { affiliate: true } });
    if (!referral || !Number.isFinite(amount) || amount <= 0) return null;

    const commissionAmount = calculateCommission(amount, AFFILIATE_PROGRAM.commission.CUSTOMER_ORDER);
    const commission = await tx.affiliateCommission.upsert({
        where: { eventKey: `BILL:${billId}` },
        update: {},
        create: { affiliateId: referral.affiliateId, referralId: referral.id, eventKey: `BILL:${billId}`, commissionType: "CUSTOMER_ORDER", sourceBillId: billId, baseAmount: amount, commissionRate: AFFILIATE_PROGRAM.commission.CUSTOMER_ORDER.rate, commissionAmount, status: "PENDING" },
    });
    await tx.affiliateReferral.update({ where: { id: referral.id }, data: { status: "CONVERTED", convertedAt: new Date() } });
    return commission;
}

export async function attributeVendorRegistration(userId: string, shopId: string, attribution: ReferralAttribution) {
    if (attribution.type !== "VENDOR") return false;
    const [shop, click, affiliate, existingReferral] = await Promise.all([
        prisma.shop.findFirst({ where: { id: shopId, ownerId: userId }, select: { id: true } }),
        prisma.affiliateClick.findFirst({ where: { id: attribution.clickId, affiliateId: attribution.affiliateId, referralType: "VENDOR", createdAt: { gte: new Date(attribution.issuedAt - 60_000) } } }),
        prisma.affiliate.findFirst({ where: { id: attribution.affiliateId, status: "ACTIVE" }, select: { id: true } }),
        prisma.affiliateReferral.findFirst({ where: { referredShopId: shopId }, select: { id: true } }),
    ]);
    if (!shop || !click || !affiliate || existingReferral) return false;

    try {
        await prisma.$transaction(async (tx) => {
            const referral = await tx.affiliateReferral.create({ data: { affiliateId: affiliate.id, referralKey: `VENDOR:${shop.id}`, referralType: "VENDOR", referredShopId: shop.id, status: "CONVERTED", convertedAt: new Date() } });
            const rule = AFFILIATE_PROGRAM.commission.VENDOR_REGISTRATION;
            await tx.affiliateCommission.create({ data: { affiliateId: affiliate.id, referralId: referral.id, eventKey: `SHOP:${shop.id}`, commissionType: "VENDOR_REGISTRATION", baseAmount: 0, fixedAmount: rule.fixedAmount, commissionAmount: calculateCommission(0, rule), status: "PENDING" } });
            await tx.affiliateClick.update({ where: { id: click.id }, data: { converted: true } });
        });
        return true;
    } catch {
        return Boolean(await prisma.affiliateReferral.findFirst({ where: { referredShopId: shopId }, select: { id: true } }));
    }
}

export async function createVendorDineInCommission(tx: Prisma.TransactionClient, billId: string, shopId: string, amount: number) {
    const referral = await tx.affiliateReferral.findFirst({ where: { referralType: "VENDOR", referredShopId: shopId, status: "CONVERTED", affiliate: { status: "ACTIVE" } } });
    if (!referral || !Number.isFinite(amount) || amount <= 0) return null;
    const rule = AFFILIATE_PROGRAM.commission.VENDOR_DINE_IN;
    return tx.affiliateCommission.upsert({
        where: { eventKey: `DINEIN:${billId}` },
        update: {},
        create: { affiliateId: referral.affiliateId, referralId: referral.id, eventKey: `DINEIN:${billId}`, commissionType: "VENDOR_DINE_IN", sourceBillId: billId, baseAmount: amount, commissionRate: rule.rate, commissionAmount: calculateCommission(amount, rule), status: "PENDING" },
    });
}

export async function getAffiliateDashboard(userId: string) {
    const affiliate = await prisma.affiliate.findUnique({ where: { userId }, include: { user: { select: { name: true, email: true, image: true, phoneNumber: true, createdAt: true } } } });
    if (!affiliate) return null;

    const [clickCount, customerCount, vendorCount, commissions, withdrawals, recentReferrals] = await Promise.all([
        prisma.affiliateClick.count({ where: { affiliateId: affiliate.id } }),
        prisma.affiliateReferral.count({ where: { affiliateId: affiliate.id, referralType: "CUSTOMER", status: "CONVERTED" } }),
        prisma.affiliateReferral.count({ where: { affiliateId: affiliate.id, referralType: "VENDOR" } }),
        prisma.affiliateCommission.findMany({ where: { affiliateId: affiliate.id }, select: { commissionAmount: true, status: true, commissionType: true, createdAt: true } }),
        prisma.affiliateWithdrawal.findMany({ where: { affiliateId: affiliate.id }, select: { amount: true, status: true } }),
        prisma.affiliateReferral.findMany({ where: { affiliateId: affiliate.id }, take: 5, orderBy: { createdAt: "desc" }, include: { referredUser: { select: { name: true } }, referredShop: { select: { name: true } }, commissions: { select: { commissionAmount: true, status: true } } } }),
    ]);
    const totalEarnings = commissions.reduce((sum, item) => sum + (["PENDING", "APPROVED", "PAID"].includes(item.status) ? item.commissionAmount : 0), 0);
    const pendingBalance = commissions.reduce((sum, item) => sum + (item.status === "PENDING" ? item.commissionAmount : 0), 0);
    const withdrawn = withdrawals.reduce((sum, item) => sum + (item.status === "COMPLETED" ? item.amount : 0), 0);
    const reserved = withdrawals.reduce((sum, item) => sum + (["PENDING", "PROCESSING", "COMPLETED"].includes(item.status) ? item.amount : 0), 0);
    const availableBalance = Math.max(0, totalEarnings - reserved);
    const origin = process.env.BETTER_AUTH_URL ?? "";

    return {
        affiliate: { code: affiliate.affiliateCode, status: affiliate.status, createdAt: affiliate.createdAt.toISOString(), user: affiliate.user },
        links: { customer: `${origin}/affiliate/track-click?ref=${affiliate.affiliateCode}&type=CUSTOMER&redirect=%2Flogin`, vendor: `${origin}/affiliate/track-click?ref=${affiliate.affiliateCode}&type=VENDOR&redirect=%2F` },
        stats: { clicks: clickCount, convertedCustomers: customerCount, vendorsReferred: vendorCount, totalEarnings, availableBalance, pendingBalance, withdrawn },
        recentReferrals: recentReferrals.map((referral) => ({ id: referral.id, type: referral.referralType, name: referral.referredUser?.name ?? referral.referredShop?.name ?? "Pending registration", status: referral.status, registeredAt: referral.registeredAt.toISOString(), earned: referral.commissions.reduce((sum, commission) => sum + (commission.status === "APPROVED" || commission.status === "PAID" ? commission.commissionAmount : 0), 0) })),
        payoutAccounts: await prisma.affiliateBankAccount.findMany({ where: { affiliateId: affiliate.id }, select: { id: true, accountHolderName: true, bankName: true, accountLast4: true, ifscCode: true, verified: true } }),
        minimumWithdrawal: AFFILIATE_PROGRAM.minimumWithdrawalInr,
        commissionRules: AFFILIATE_PROGRAM.commission,
    };
}

export async function requestAffiliateWithdrawal(userId: string, amount: number, bankAccountId: string, requestKey: string) {
    if (!Number.isFinite(amount) || amount < AFFILIATE_PROGRAM.minimumWithdrawalInr) throw new AffiliateServiceError(`Minimum withdrawal is ₹${AFFILIATE_PROGRAM.minimumWithdrawalInr}.`, 400);
    const existing = await prisma.affiliateWithdrawal.findUnique({ where: { requestKey } });
    if (existing) {
        const owner = await prisma.affiliate.findUnique({ where: { userId }, select: { id: true } });
        if (owner?.id === existing.affiliateId) return existing;
        throw new AffiliateServiceError("Invalid withdrawal request.", 409);
    }

    const affiliate = await prisma.affiliate.findUnique({ where: { userId }, select: { id: true, status: true, withdrawalRevision: true } });
    if (!affiliate || affiliate.status !== "ACTIVE") throw new AffiliateServiceError("Active affiliate access is required.", 403);
    const account = await prisma.affiliateBankAccount.findFirst({ where: { id: bankAccountId, affiliateId: affiliate.id, verified: true }, select: { id: true } });
    if (!account) throw new AffiliateServiceError("Choose a verified payout account.", 400);

    const [commissions, withdrawals] = await Promise.all([
        prisma.affiliateCommission.aggregate({ where: { affiliateId: affiliate.id, status: { in: ["APPROVED", "PAID"] } }, _sum: { commissionAmount: true } }),
        prisma.affiliateWithdrawal.aggregate({ where: { affiliateId: affiliate.id, status: { in: ["PENDING", "PROCESSING", "COMPLETED"] } }, _sum: { amount: true } }),
    ]);
    const availableBalance = (commissions._sum.commissionAmount ?? 0) - (withdrawals._sum.amount ?? 0);
    if (amount > availableBalance) throw new AffiliateServiceError("Withdrawal amount exceeds your available balance.", 400);

    try {
        return await prisma.$transaction(async (tx) => {
            const reserved = await tx.affiliate.updateMany({ where: { id: affiliate.id, status: "ACTIVE", withdrawalRevision: affiliate.withdrawalRevision }, data: { withdrawalRevision: { increment: 1 } } });
            if (reserved.count !== 1) throw new AffiliateServiceError("Your balance changed. Refresh and try again.", 409);
            return tx.affiliateWithdrawal.create({ data: { affiliateId: affiliate.id, amount: Math.round(amount * 100) / 100, bankAccountId: account.id, requestKey } });
        });
    } catch (error) {
        const retry = await prisma.affiliateWithdrawal.findUnique({ where: { requestKey } });
        if (retry?.affiliateId === affiliate.id) return retry;
        throw error;
    }
}

export async function addMaskedPayoutAccount(userId: string, input: { accountHolderName: string; bankName: string; accountLast4: string; ifscCode: string }) {
    const affiliate = await prisma.affiliate.findUnique({ where: { userId }, select: { id: true, status: true } });
    if (!affiliate || affiliate.status !== "ACTIVE") throw new AffiliateServiceError("Active affiliate access is required.", 403);
    return prisma.affiliateBankAccount.create({ data: { affiliateId: affiliate.id, ...input, verified: true } });
}
