"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import PostCard from "@/components/features/discover/post-card";
import { useLoginPrompt } from "@/components/features/auth/login-prompt-provider";
import { BackButton } from "@/components/ui/back-button";
import { ShopAvatar } from "@/components/features/discover/post-components";
import { publishFollowChange } from "@/lib/follow-sync";
import type { FeedPost, Shop } from "@/types/commerce";

type SharedPostExperienceProps = { post: FeedPost; shop: Shop };
type Interaction = "like" | "save" | "follow";

/** A shared vendor post rendered exactly like it is in the feed, with the same actions. */
export default function SharedPostExperience({ post, shop }: SharedPostExperienceProps) {
  const router = useRouter();
  const { authenticated, requireLogin } = useLoginPrompt();
  const [state, setState] = useState<Record<Interaction, boolean>>({
    like: Boolean(post.liked),
    save: Boolean(post.saved),
    follow: Boolean(shop.followed),
  });
  const [interactionError, setInteractionError] = useState("");

  async function toggleInteraction(action: Interaction) {
    if (!requireLogin()) return;
    setInteractionError("");
    const wasActive = state[action];
    setState((current) => ({ ...current, [action]: !wasActive }));
    const payload = action === "follow" ? { action, shopId: shop.id } : { action, postId: post.id };
    try {
      const response = await fetch("/api/feed/interactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, active: !wasActive }) });
      if (response.status === 401) { router.push("/login"); throw new Error("Sign in required"); }
      if (!response.ok) throw new Error("Interaction unavailable");
      const result = await response.json() as { active?: boolean; followerCount?: number };
      if (typeof result.active === "boolean") {
        const confirmedActive = result.active;
        setState((current) => ({ ...current, [action]: confirmedActive }));
      }
      if (action === "follow" && typeof result.active === "boolean" && typeof result.followerCount === "number") {
        publishFollowChange({ shopId: shop.id, active: result.active, followerCount: result.followerCount });
      }
    } catch {
      setState((current) => ({ ...current, [action]: wasActive }));
      setInteractionError("That action could not be saved. Please try again.");
    }
  }

  return <main className="shared-post-page">
    <header className="shared-post-header">
      <BackButton label="Go back" destination="/" />
      <div>
        <span className="section-kicker">{post.kind === "offer" ? "OFFER SHARED WITH YOU" : "SHARED WITH YOU"}</span>
        <h1>{shop.name}</h1>
      </div>
    </header>

    <div className="shared-post-feed">
      {interactionError && <p aria-live="polite" className="share-feedback" role="alert">{interactionError}</p>}
      <div className="post-list">
        <PostCard
          followed={state.follow}
          liked={state.like}
          onCheckout={() => { if (requireLogin()) router.push(`/shops/${shop.id}`); }}
          onFollow={() => { void toggleInteraction("follow"); }}
          onLike={() => { void toggleInteraction("like"); }}
          onOpenShop={() => router.push(`/shops/${shop.id}`)}
          onSave={() => { void toggleInteraction("save"); }}
          post={post}
          saved={state.save}
          shop={shop}
        />
      </div>

      <Link className="shared-post-shop-cta" href={`/shops/${shop.id}`}>
        <ShopAvatar shop={shop} size={48} />
        <span className="shared-post-shop-cta-copy">
          <strong>More from {shop.name}</strong>
          <small>See the menu, offers and latest posts</small>
        </span>
        <span aria-hidden="true" className="shared-post-shop-cta-arrow"><ArrowRight size={16} /></span>
      </Link>

      {!authenticated && <section className="shared-post-join">
        <span className="shared-post-join-icon"><Sparkles size={18} /></span>
        <div>
          <strong>Discover more offers near you</strong>
          <p>Log in to like, save and share posts, follow shops and get directions.</p>
        </div>
        <button onClick={() => router.push("/login")} type="button">Log in</button>
      </section>}

      <Link className="shared-post-explore" href="/">Explore ZIDDU</Link>
    </div>
  </main>;
}
