import { MapPin, Navigation } from "lucide-react";
import Link from "next/link";
import type { Shop } from "@/types/commerce";

type DirectionsButtonProps = { shop: Shop; label?: string; className?: string; compact?: boolean; icon?: "pin" | "navigation"; count?: number; onClick?: () => void };

export function DirectionsButton({ shop, label = "Directions", className = "", compact = false, icon = "navigation", count, onClick }: DirectionsButtonProps) {
    const Icon = icon === "pin" ? MapPin : Navigation;
    return <Link aria-label={`${label} to ${shop.name}${count === undefined ? "" : `, ${count} requests`}`} className={`${className} directions-trigger`} href={`/directions/${shop.id}`} onClick={onClick}><Icon size={compact ? 14 : 15} />{label}{count !== undefined && <span className="directions-count">{count}</span>}</Link>;
}
