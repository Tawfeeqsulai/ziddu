import { MapPin, Navigation } from "lucide-react";
import Link from "next/link";
import type { Shop } from "@/types/commerce";
import { useLoginPrompt } from "@/components/features/auth/login-prompt-provider";

type DirectionsButtonProps = { shop: Shop; label?: string; className?: string; compact?: boolean; icon?: "pin" | "navigation"; count?: number; postId?: string; onClick?: () => void };

export function DirectionsButton({ shop, label = "Directions", className = "", compact = false, icon = "navigation", count, postId, onClick }: DirectionsButtonProps) {
    const Icon = icon === "pin" ? MapPin : Navigation;
    const { authenticated, requireLogin } = useLoginPrompt();
    const href = postId ? `/directions/${shop.id}?post_id=${encodeURIComponent(postId)}` : `/directions/${shop.id}`;
    return <Link aria-label={`${label} to ${shop.name}${count === undefined ? "" : `, ${count} requests`}`} className={`${className} directions-trigger`} href={href} onClick={(event) => { if (!authenticated && !requireLogin()) { event.preventDefault(); return; } onClick?.(); }}><Icon size={compact ? 14 : 15} />{label}{count !== undefined && <span className="directions-count">{count}</span>}</Link>;
}
