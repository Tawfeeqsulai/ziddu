import { Skeleton } from "@/components/ui/states";

// Shown instantly on navigation while the next page renders on the server.
export default function Loading() {
  return <main aria-busy="true" aria-label="Loading" className="route-loading">
    <span aria-hidden="true" className="route-loading-bar" />
    <div className="route-loading-card">
      <div className="route-loading-header"><Skeleton className="route-loading-avatar" /><div><Skeleton className="route-loading-line" /><Skeleton className="route-loading-line is-short" /></div></div>
      <Skeleton className="route-loading-media" />
      <Skeleton className="route-loading-line" />
    </div>
  </main>;
}
