import AffiliateHub from "@/components/features/affiliate/affiliate-hub";
import { requireAffiliatePage } from "@/lib/affiliate/page";

export default async function AffiliateReferralsPage() {
    await requireAffiliatePage();
    return <AffiliateHub section="referrals" />;
}
