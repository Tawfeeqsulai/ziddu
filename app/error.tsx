"use client";

import { ErrorState } from "@/components/ui/states";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="feed-error"><ErrorState description="We couldn't load your feed right now." onAction={reset} title="Couldn't load your feed" /></main>;
}
