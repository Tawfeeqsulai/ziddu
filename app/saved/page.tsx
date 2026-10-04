import SavedExperience from "@/components/features/saved/saved-experience";
import { requireCurrentUser } from "@/lib/auth/session";
import { getSavedData } from "@/services/discovery.service";

export default async function SavedPage() {
    const user = await requireCurrentUser();
    const data = await getSavedData(user.id);
    return <SavedExperience initial={data} />;
}