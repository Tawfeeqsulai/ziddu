import { Skeleton } from "@/components/ui/states";

export default function Loading() {
  return <main className="shop-loading"><Skeleton className="shop-loading-avatar" /><Skeleton className="shop-loading-title" /><Skeleton className="shop-loading-copy" /><Skeleton className="shop-loading-media" /></main>;
}
