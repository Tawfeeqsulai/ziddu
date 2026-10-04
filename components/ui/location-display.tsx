import { MapPin } from "lucide-react";

type LocationDisplayProps = { locality: string; city: string; distance?: string; status?: string; onClick?: () => void; ariaLabel?: string; className?: string };

export function LocationDisplay({ locality, city, distance, status, onClick, ariaLabel, className = "" }: LocationDisplayProps) {
  const content = <><MapPin aria-hidden="true" size={14} /><span>{locality}, {city}{distance ? ` · ${distance}` : ""}</span>{status && <span className={`ui-location-status ${status === "Closed" ? "is-closed" : ""}`}>{status}</span>}</>;
  return onClick ? <button aria-label={ariaLabel} className={`ui-location ${className}`} onClick={onClick} type="button">{content}</button> : <div className={`ui-location ${className}`}>{content}</div>;
}
