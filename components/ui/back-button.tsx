"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function BackButton({ children, className, destination, label = "Go back" }: { children?: ReactNode; className?: string; destination?: string; label?: string }) {
  const router = useRouter();

  return (
    <button aria-label={label} className={className ? `back-button ${className}` : "back-button"} onClick={() => destination ? router.push(destination) : router.back()} type="button">
      <ArrowLeft aria-hidden="true" size={19} />{children}
    </button>
  );
}
