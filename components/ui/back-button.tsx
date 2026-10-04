"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function BackButton({ children, className, label = "Go back" }: { children?: ReactNode; className?: string; label?: string }) {
  const router = useRouter();

  return (
    <button aria-label={label} className={className} onClick={() => router.back()} type="button">
      <ArrowLeft aria-hidden="true" size={19} />{children}
    </button>
  );
}
