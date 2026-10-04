import { NextResponse } from "next/server";
import { requireActiveAffiliate } from "@/lib/affiliate/api";
import { getAffiliateDashboard } from "@/services/affiliate.service";

export async function GET(request: Request) {
    const access = await requireActiveAffiliate();
    if ("response" in access) return access.response;
    const dashboard = await getAffiliateDashboard(access.user.id);
    if (!dashboard) return NextResponse.json({ message: "Affiliate profile not found." }, { status: 404 });
    const origin = process.env.BETTER_AUTH_URL ?? new URL(request.url).origin;
    dashboard.links.customer = new URL(`/affiliate/track-click?ref=${dashboard.affiliate.code}&type=CUSTOMER&redirect=%2Flogin`, origin).toString();
    dashboard.links.vendor = new URL(`/affiliate/track-click?ref=${dashboard.affiliate.code}&type=VENDOR&redirect=%2F`, origin).toString();
    return NextResponse.json({ dashboard });
}
