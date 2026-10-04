import { Navigation } from "lucide-react";
import Link from "next/link";
import type { Shop } from "@/types/commerce";

type DirectionsButtonProps = { shop: Shop; label?: string; className?: string; compact?: boolean };

export function DirectionsButton({ shop, label = "Directions", className = "", compact = false }: DirectionsButtonProps) {
    return <Link aria-label={`${label} to ${shop.name}`} className={`${className} directions-trigger`} href={`/directions/${shop.id}`}><Navigation size={compact ? 14 : 15} />{label}</Link>;
}
