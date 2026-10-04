import type { ReactNode } from "react";

export const POST_MAX_WIDTH = "680px";

type PostContainerProps = { children: ReactNode; variant?: "image" | "reel"; className?: string };

export function PostContainer({ children, variant = "image", className = "" }: PostContainerProps) {
  return <article className={`ui-post-container ui-post-${variant} ${className}`}>{children}</article>;
}
