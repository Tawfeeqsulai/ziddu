import "server-only";

export const AFFILIATE_PROGRAM = {
    attributionWindowDays: 30,
    minimumWithdrawalInr: 100,
    commission: {
        CUSTOMER_ORDER: { rate: 0.05 },
        VENDOR_REGISTRATION: { fixedAmount: 200 },
        VENDOR_DINE_IN: { rate: 0.02 },
    },
} as const;

export const AFFILIATE_ATTRIBUTION_WINDOW_SECONDS = AFFILIATE_PROGRAM.attributionWindowDays * 24 * 60 * 60;

export function calculateCommission(baseAmount: number, rule: { rate?: number; fixedAmount?: number }) {
    const amount = rule.fixedAmount ?? baseAmount * (rule.rate ?? 0);
    return Math.round(amount * 100) / 100;
}