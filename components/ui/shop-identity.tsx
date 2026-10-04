import { Check, MapPin } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { Shop } from "@/types/commerce";

type ShopIdentityProps = { shop: Shop; followed?: boolean; onFollow?: () => void; onOpen?: () => void; compact?: boolean };

export function ShopIdentity({ shop, followed = false, onFollow, onOpen, compact = false }: ShopIdentityProps) {
  return <div className={`ui-shop-identity ${compact ? "is-compact" : ""}`}><button aria-label={`Open ${shop.name}`} className="ui-shop-link" onClick={onOpen} type="button"><Avatar alt={shop.name} image={shop.image} initials={shop.initials} size={compact ? "sm" : "md"} /><span><strong>{shop.name}</strong><small><MapPin aria-hidden="true" size={12} />{shop.area}, {shop.city}</small></span></button>{onFollow && <Button aria-label={followed ? `Unfollow ${shop.name}` : `Follow ${shop.name}`} className={followed ? "is-following" : ""} onClick={onFollow} variant="outline">{followed ? <><Check size={13} /> Following</> : "Follow"}</Button>}</div>;
}
