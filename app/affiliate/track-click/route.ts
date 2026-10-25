import { AffiliateReferralType } from "@/lib/db/generated/main";
import { NextResponse } from "next/server";
import { AFFILIATE_ATTRIBUTION_WINDOW_SECONDS } from "@/lib/affiliate/config";
import { createReferralCookieValue, AFFILIATE_REFERRAL_COOKIE } from "@/lib/affiliate/referral-cookie";
import { getActiveAffiliateByCode, recordAffiliateClick } from "@/services/affiliate.service";

export async function GET(request: Request) {
    const url = new URL(request.url);
    const code = (url.searchParams.get("ref") ?? "").trim().toUpperCase();
    const typeValue = url.searchParams.get("type");
    const type = typeValue === "VENDOR" ? AffiliateReferralType.VENDOR : typeValue === "CUSTOMER" ? AffiliateReferralType.CUSTOMER : null;
    const redirectPath = url.searchParams.get("redirect") ?? "/";
    const safePath = redirectPath.startsWith("/") && !redirectPath.startsWith("//") && !redirectPath.includes("\\") ? redirectPath : "/";
    try {
        const affiliate = type ? await getActiveAffiliateByCode(code) : null;
        if (!affiliate || !type) return NextResponse.redirect(new URL("/", url.origin));
        const click = await recordAffiliateClick(affiliate.id, type, code);
        const response = NextResponse.redirect(new URL(safePath, url.origin));
        response.cookies.set(AFFILIATE_REFERRAL_COOKIE, createReferralCookieValue({ affiliateId: affiliate.id, clickId: click.id, type }), {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: AFFILIATE_ATTRIBUTION_WINDOW_SECONDS,
        });
        return response;
    } catch {
        return NextResponse.redirect(new URL("/", url.origin));
    }
}
