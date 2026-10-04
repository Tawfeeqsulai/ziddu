import Image from "next/image";
import type { CSSProperties } from "react";

type AvatarProps = { image?: string | null; initials: string; alt?: string; size?: "sm" | "md" | "lg"; className?: string; style?: CSSProperties };

export function Avatar({ image, initials, alt = "", size = "md", className = "", style }: AvatarProps) {
  return <span aria-label={alt || undefined} className={`ui-avatar ui-avatar-${size} ${className}`} style={style}>{image ? <Image alt={alt} fill sizes="64px" src={image} unoptimized /> : <span>{initials.slice(0, 2).toUpperCase()}</span>}</span>;
}
