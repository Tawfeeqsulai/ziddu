import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MapPin, Store, Tag } from "lucide-react";
import SharedPostExperience from "@/components/features/discover/shared-post-experience";
import { BackButton } from "@/components/ui/back-button";
import { getCurrentUser } from "@/lib/auth/session";
import { decodePostShareId } from "@/lib/post-share-id";
import { getDiscoveryData } from "@/services/discovery.service";
import { getSharedPost } from "@/services/shared-post.service";
import { getShopProfile } from "@/services/shop-profile.service";
import type { FeedPost, Shop } from "@/types/commerce";

/**
 * A vendor post shared from the ZIDDU vendor app:
 * /posts/<Base64 of the post id> (see lib/post-share-id.ts). Public — no
 * sign-in — so it opens for whoever the link was sent to, and its Open Graph
 * tags give WhatsApp / Instagram a preview of the poster.
 */

async function loadPost(segment: string) {
  const id = decodePostShareId(segment);
  return id ? getSharedPost(id) : null;
}

/**
 * The post as the feed shows it (with the viewer's like / save / follow state),
 * so the share page can render the same card and actions. Falls back to the
 * vendor's profile posts when the feed does not include it.
 */
async function loadFeedPost(postId: string, shopId: string, userId?: string): Promise<{ post: FeedPost; shop: Shop } | null> {
  try {
    const feed = await getDiscoveryData(userId);
    const post = feed.posts.find((item) => item.id === postId);
    const shop = post && feed.shops.find((item) => item.id === post.shopId);
    if (post && shop) return { post, shop };
  } catch {
    // Try the vendor profile below.
  }
  try {
    const profile = await getShopProfile(shopId, userId);
    const post = profile?.posts.find((item) => item.id === postId);
    if (profile && post) return { post, shop: profile.shop };
  } catch {
    // Keep the simple share view below.
  }
  return null;
}

export async function generateMetadata({ params }: PageProps<"/posts/[id]">): Promise<Metadata> {
  const { id } = await params;
  const post = await loadPost(id);
  if (!post) return { title: "Post not found | ZIDDU" };

  const title = post.offer && !post.offer.ended
    ? `${post.offer.label}${post.offer.productName ? ` on ${post.offer.productName}` : ""} at ${post.shop.name}`
    : `${post.shop.name} on ZIDDU`;
  const description = [post.category, post.shop.address].filter(Boolean).join(" · ") || "See this post on ZIDDU.";

  return {
    title: `${title} | ZIDDU`,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      ...(post.type === "poster" ? { images: [{ url: post.mediaUrl, alt: title }] } : { videos: [{ url: post.mediaUrl }] }),
    },
    twitter: {
      card: post.type === "poster" ? "summary_large_image" : "summary",
      title,
      description,
      ...(post.type === "poster" ? { images: [post.mediaUrl] } : {}),
    },
  };
}

export default async function SharedPostPage({ params }: PageProps<"/posts/[id]">) {
  const { id } = await params;
  const post = await loadPost(id);
  if (!post) notFound();

  const user = await getCurrentUser();
  const feedPost = await loadFeedPost(String(post.id), post.shop.id, user?.id);
  if (feedPost) return <SharedPostExperience post={feedPost.post} shop={feedPost.shop} />;

  const posted = post.createdAt?.toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });
  const validTill = post.offer?.validTill?.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

  return (
    <main className="shared-post-page">
      <header className="orders-header">
        <BackButton label="Go back" destination="/" />
        <div>
          <span className="section-kicker">{post.offer ? "OFFER" : "POST"}</span>
          <h1>{post.shop.name}</h1>
        </div>
      </header>

      <section className="shared-post-card">
        <div className="shared-post-shop">
          {post.shop.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="shared-post-logo" src={post.shop.logoUrl} alt="" />
          ) : (
            <span className="shared-post-logo shared-post-logo-fallback"><Store size={18} /></span>
          )}
          <div>
            <strong>{post.shop.name}</strong>
            {post.shop.address ? <span><MapPin size={13} /> {post.shop.address}</span> : null}
          </div>
        </div>

        {post.type === "poster" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="shared-post-media" src={post.mediaUrl} alt={`Poster from ${post.shop.name}`} />
        ) : (
          <video className="shared-post-media" src={post.mediaUrl} controls playsInline preload="metadata" />
        )}

        {post.offer ? (
          <div className={`shared-post-offer${post.offer.ended ? " shared-post-offer-ended" : ""}`}>
            <Tag size={15} />
            <div>
              <strong>{post.offer.label}{post.offer.productName ? ` · ${post.offer.productName}` : ""}</strong>
              {validTill ? <span>{post.offer.ended ? `Ended ${validTill}` : `Valid till ${validTill}`}</span> : null}
            </div>
          </div>
        ) : null}

        <div className="shared-post-footer">
          {posted ? <span>Posted {posted}</span> : <span />}
          <Link className="shared-post-visit" href={`/shops/${post.shop.id}`}>Visit shop</Link>
        </div>
      </section>
    </main>
  );
}
