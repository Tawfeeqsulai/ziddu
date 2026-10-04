import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { authSecret } from "@/lib/auth-secret";
import { AFFILIATE_ATTRIBUTION_WINDOW_SECONDS } from "@/lib/affiliate/config";

export const AFFILIATE_REFERRAL_COOKIE = "ziddu_affiliate_referral";

export type ReferralAttribution = {
    affiliateId: string;
    clickId: string;
    type: "CUSTOMER" | "VENDOR";
    issuedAt: number;
    expiresAt: number;
};

function sign(payload: string) {
    return createHmac("sha256", authSecret).update(payload).digest("base64url");
}

export function createReferralCookieValue(input: Omit<ReferralAttribution, "issuedAt" | "expiresAt">) {
    const issuedAt = Date.now();
    const payload: ReferralAttribution = {
        ...input,
        issuedAt,
        expiresAt: issuedAt + AFFILIATE_ATTRIBUTION_WINDOW_SECONDS * 1000,
    };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
    return `${encoded}.${sign(encoded)}`;
}

export function readReferralCookieValue(value: string | undefined): ReferralAttribution | null {
    if (!value) return null;
    const [encoded, signature, ...extra] = value.split(".");
    if (!encoded || !signature || extra.length > 0) return null;
    const expected = Buffer.from(sign(encoded));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;

    try {
        const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Partial<ReferralAttribution>;
        const validType = payload.type === "CUSTOMER" || payload.type === "VENDOR";
        const validIds = typeof payload.affiliateId === "string" && /^[\da-f]{24}$/i.test(payload.affiliateId)
            && typeof payload.clickId === "string" && /^[\da-f]{24}$/i.test(payload.clickId);
        if (!validType || !validIds || typeof payload.issuedAt !== "number" || typeof payload.expiresAt !== "number") return null;
        if (payload.issuedAt > Date.now() || payload.expiresAt <= Date.now()) return null;
        if (payload.expiresAt - payload.issuedAt > AFFILIATE_ATTRIBUTION_WINDOW_SECONDS * 1000) return null;
        return payload as ReferralAttribution;
    } catch {
        return null;
    }
}