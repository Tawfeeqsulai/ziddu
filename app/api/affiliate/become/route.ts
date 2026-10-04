import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { affiliateError } from "@/lib/affiliate/api";
import { deactivateAffiliate } from "@/services/affiliate.service";

export async function DELETE() {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
    try {
        await deactivateAffiliate(user.id);
        return NextResponse.json({ status: "INACTIVE" });
    } catch (error) {
        return affiliateError(error);
    }
}
