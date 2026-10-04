import { redirect } from "next/navigation";
import AffiliateVendorRegistrationForm from "@/components/features/affiliate/affiliate-vendor-registration-form";
import { requireAffiliatePage } from "@/lib/affiliate/page";
import { prisma } from "@/lib/db/prisma";

export default async function AffiliateVendorRegistrationPage() {
    const user = await requireAffiliatePage();
    const identity = await prisma.user.findUnique({
        where: { id: user.id },
        select: { address: true, locality: true, city: true, state: true, pincode: true, phoneNumber: true, email: true },
    });
    if (!identity) redirect("/affiliate");

    return <AffiliateVendorRegistrationForm initial={{
        address: identity.address ?? "",
        locality: identity.locality ?? "",
        city: identity.city ?? "",
        state: identity.state ?? "",
        pincode: identity.pincode ?? "",
        phone: identity.phoneNumber ?? "",
        email: identity.email,
    }} />;
}