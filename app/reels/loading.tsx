import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return <main className="reels-page reels-loading"><Skeleton className="reels-loading-video" /><Skeleton className="reels-loading-copy" /></main>;
}
