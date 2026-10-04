import { Bookmark, Heart, Send } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type SocialActionsProps = { liked: boolean; saved: boolean; onLike: () => void; onSave: () => void; onShare: () => void; accessibleName?: string; overlay?: boolean; trailingAction?: ReactNode };

export function SocialActions({ liked, saved, onLike, onSave, onShare, accessibleName = "post", overlay = false, trailingAction }: SocialActionsProps) {
  return <div className={`ui-social-actions social-action-group ${overlay ? "is-overlay" : ""}`}>
    <Button aria-label={`${liked ? "Unlike" : "Like"} ${accessibleName}`} className={`social-action ${liked ? "is-active liked" : ""}`} onClick={onLike} variant="icon"><Heart fill={liked ? "currentColor" : "none"} size={overlay ? 25 : 22} />{overlay && <span>Like</span>}</Button>
    <Button aria-label={`Share ${accessibleName}`} className="social-action" onClick={onShare} variant="icon"><Send size={overlay ? 23 : 21} />{overlay && <span>Share</span>}</Button>
    <Button aria-label={`${saved ? "Remove" : "Save"} ${accessibleName}`} className={`social-action ${saved ? "is-active saved" : ""}`} onClick={onSave} variant="icon"><Bookmark fill={saved ? "currentColor" : "none"} size={overlay ? 23 : 22} />{overlay && <span>{saved ? "Saved" : "Save"}</span>}</Button>
    {trailingAction}
  </div>;
}
