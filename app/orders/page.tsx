import { redirect } from "next/navigation";
import PurchaseHistoryExperience from "@/components/features/orders/purchase-history-experience";
import { getCurrentUser } from "@/lib/auth/session";
import { getPurchaseHistory } from "@/services/purchase-history.service";

export default async function OrdersPage() {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    const history = await getPurchaseHistory(user.id);
    return <PurchaseHistoryExperience history={history} />;
}
