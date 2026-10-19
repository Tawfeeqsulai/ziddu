import { Bookmark, Heart, Send } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

type SocialActionsProps = { liked: boolean; saved: boolean; onLike: () => void; onSave: () => void; onShare: () => void; likeCount?: number; shareCount?: number; saveCount?: number; accessibleName?: string; overlay?: boolean; trailingAction?: ReactNode };

function countLabel(count: number) { return count >= 1000 ? `${(count / 1000).toFixed(1)}K` : String(count); }

export function SocialActions({ liked, saved, onLike, onSave, onShare, likeCount = 0, shareCount = 0, saveCount = 0, accessibleName = "post", overlay = false, trailingAction }: SocialActionsProps) {
  return <div className={`ui-social-actions social-action-group ${overlay ? "is-overlay" : ""}`}>
    <span className="social-action-with-count"><Button aria-label={`${liked ? "Unlike" : "Like"} ${accessibleName}`} className={`social-action ${liked ? "is-active liked" : ""}`} onClick={onLike} variant="icon"><Heart fill={liked ? "currentColor" : "none"} size={overlay ? 29 : 22} />{overlay && <span>Like</span>}</Button>{likeCount > 0 && <span aria-label={`${likeCount} likes`} className="social-action-count">{countLabel(likeCount)}</span>}</span>
    <span className="social-action-with-count"><Button aria-label={`Share ${accessibleName}`} className="social-action" onClick={onShare} variant="icon"><Send size={overlay ? 27 : 21} />{overlay && <span>Share</span>}</Button>{shareCount > 0 && <span aria-label={`${shareCount} shares`} className="social-action-count">{countLabel(shareCount)}</span>}</span>
    <span className="social-action-with-count"><Button aria-label={`${saved ? "Remove" : "Save"} ${accessibleName}`} className={`social-action ${saved ? "is-active saved" : ""}`} onClick={onSave} variant="icon"><Bookmark fill={saved ? "currentColor" : "none"} size={overlay ? 27 : 22} />{overlay && <span>{saved ? "Saved" : "Save"}</span>}</Button>{saveCount > 0 && <span aria-label={`${saveCount} saves`} className="social-action-count">{countLabel(saveCount)}</span>}</span>
    {trailingAction}
  </div>;
}
