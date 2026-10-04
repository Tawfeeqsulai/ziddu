import ReelsExperience from "@/components/features/reels/reels-experience";
import { requireCurrentUser } from "@/lib/auth/session";
import { getReels } from "@/services/reels.service";

export default async function ReelsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const postId = typeof params.post === "string" ? params.post : undefined;
  const reels = await getReels(user.id, 1, postId);
  return <ReelsExperience authenticated initial={reels} />;
}
