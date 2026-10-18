import { MapPin, Navigation } from "lucide-react";
import Link from "next/link";
import type { Shop } from "@/types/commerce";

type DirectionsButtonProps = { shop: Shop; label?: string; className?: string; compact?: boolean; icon?: "pin" | "navigation" };

export function DirectionsButton({ shop, label = "Directions", className = "", compact = false, icon = "navigation" }: DirectionsButtonProps) {
    const Icon = icon === "pin" ? MapPin : Navigation;
    return <Link aria-label={`${label} to ${shop.name}`} className={`${className} directions-trigger`} href={`/directions/${shop.id}`}><Icon size={compact ? 14 : 15} />{label}</Link>;
}
