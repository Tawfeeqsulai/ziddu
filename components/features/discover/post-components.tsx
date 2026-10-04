"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  MapPin,
  Navigation,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DirectionsButton } from "@/components/ui/directions-button";
import { PostContainer } from "@/components/ui/post-container";
import { SocialActions } from "@/components/ui/social-actions";
import type { FeedPost, Shop } from "@/types/commerce";

export type PostCoreProps = {
  post: FeedPost;
  shop: Shop;
  followed: boolean;
  liked: boolean;
  saved: boolean;
  onFollow: () => void;
  onLike: () => void;
  onSave: () => void;
  onOpenShop: () => void;
  onCheckout: () => void;
};

export type PostEngagement = {
  shareLabel: string;
  onShare: () => void;
};

export type PostPresentationProps = PostCoreProps & {
  engagement: PostEngagement;
};

function formatCount(count: number) {
  return count >= 1000 ? `${(count / 1000).toFixed(1)}K` : String(count);
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

export function ShopAvatar({ shop, size = 42 }: { shop: Shop; size?: number }) {
  return <Avatar alt={shop.name} className="post-shop-avatar" image={shop.image} initials={shop.initials} size="md" style={{ height: size, width: size }} />;
}

export function ShopInfo({ shop }: { shop: Shop }) {
  return (
    <Link className="post-shop-identity" href={`/shops/${shop.id}`}>
      <ShopAvatar shop={shop} />
      <span className="post-shop-details">
        <strong>{shop.name}</strong>
        <span className="post-shop-location">
          <MapPin size={12} />
          <span className="post-location-text">{shop.area}, {shop.city} · {shop.distance}</span>
          <i className={`open-status-dot ${shop.status === "Closed" ? "is-closed" : ""}`} />
          <span className="post-open-status">{shop.status}</span>
        </span>
      </span>
    </Link>
  );
}

export function LocationInfo({ shop, overlay = false }: { shop: Shop; overlay?: boolean }) {
  return <DirectionsButton className={`${overlay ? "reel-location" : ""} social-location`} compact={overlay} label={overlay ? "Location" : `${shop.area}, ${shop.city}`} shop={shop} />;
}

export function PostHeader({ shop, followed, onFollow }: PostCoreProps) {
  return (
    <header className="social-post-header">
      <ShopInfo shop={shop} />
      <div className="post-header-actions">
        <button aria-label={`${followed ? "Unfollow" : "Follow"} ${shop.name}`} className={`post-follow ${followed ? "is-following" : ""}`} onClick={onFollow} type="button">
          {followed ? <><Check size={13} /> Following</> : "Follow"}
        </button>
      </div>
    </header>
  );
}

export function PostActions({ liked, saved, shop, onLike, onSave, engagement, layout = "inline" }: PostCoreProps & { engagement: PostEngagement; layout?: "inline" | "reel" }) {
  const router = useRouter();
  const overlay = layout === "reel";
  return (
    <div className={`social-post-actions ${overlay ? "reel-actions" : ""}`}>
      <SocialActions accessibleName={`${overlay ? "Reel" : "post"} from ${shop.name}`} liked={liked} onLike={onLike} onSave={onSave} onShare={engagement.onShare} overlay={overlay} saved={saved} trailingAction={overlay ? <Button aria-label={`Location to ${shop.name}`} className="social-action" onClick={() => router.push(`/directions/${shop.id}`)} variant="icon"><Navigation size={23} /><span>Location</span></Button> : undefined} />
    </div>
  );
}

export function PostCaption({ post, overlay = false, shopName, onOpenShop }: { post: FeedPost; overlay?: boolean; shopName?: string; onOpenShop?: () => void }) {
  return (
    <div className={`social-caption ${overlay ? "reel-caption" : ""}`}>
      {shopName && onOpenShop && <button className="caption-shop-name" onClick={onOpenShop} type="button">{shopName}</button>}
      <strong>{post.title}</strong>
      <span>{post.description}</span>
      {post.hashtags.length > 0 && <span className="post-hashtags">{post.hashtags.join(" ")}</span>}
    </div>
  );
}

export function OfferInfo({ post, onCheckout, overlay = false }: { post: FeedPost; onCheckout: () => void; overlay?: boolean }) {
  if (post.price === undefined) return null;
  return (
    <div className={`social-offer-row ${overlay ? "reel-offer-row" : ""}`}>
      <span><strong>{formatPrice(post.price)}</strong>{post.originalPrice && <del>{formatPrice(post.originalPrice)}</del>}</span>
      <button onClick={onCheckout} type="button">{post.badge ?? "View offer"}</button>
    </div>
  );
}

function PostStats({ post, liked }: { post: FeedPost; liked: boolean }) {
  return <div className="social-post-stats">{formatCount(post.likes + (liked ? 1 : 0))} likes</div>;
}

function PostTimestamp({ value }: { value: string }) {
  return <div className="post-timestamp">{value} ago</div>;
}

export function ImagePost(props: PostPresentationProps) {
  const { post, shop, liked, onOpenShop, onCheckout, engagement } = props;
  return (
    <PostContainer className="social-post image-post" variant="image">
      <PostHeader {...props} />
      <OfferInfo onCheckout={onCheckout} post={post} />
      <div className="social-post-media image-post-media">
        <Image alt={post.imageAlt} fill loading="lazy" sizes="(max-width: 620px) 100vw, 680px" src={post.image} unoptimized />
      </div>
      <div className="social-post-body">
        <PostActions {...props} engagement={engagement} />
        <PostStats liked={liked} post={post} />
        <PostCaption onOpenShop={onOpenShop} post={post} shopName={shop.name} />
        <LocationInfo shop={shop} />
        <PostTimestamp value={post.publishedAt} />
        <span aria-live="polite" className="share-feedback">{engagement.shareLabel}</span>
      </div>
    </PostContainer>
  );
}

function ReelVideo({ post }: { post: FeedPost }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void video.play().catch(() => undefined);
      else video.pause();
    }, { threshold: 0.55 });
    observer.observe(video);
    return () => observer.disconnect();
  }, []);

  return <video aria-label={post.imageAlt} controls loop muted playsInline poster={post.image} preload="metadata" ref={videoRef}><source src={post.mediaUrl} type="video/mp4" /></video>;
}

export function VideoPost(props: PostPresentationProps) {
  const { post, shop, followed, liked, saved, onFollow, onLike, onSave, onOpenShop, onCheckout, engagement } = props;
  return (
    <PostContainer className="video-post" variant="reel">
      <div className="reel-stage">
        <Image alt={post.imageAlt} className="reel-poster" fill loading="lazy" sizes="(max-width: 620px) 100vw, 420px" src={post.image} unoptimized />
        {post.mediaUrl && <ReelVideo post={post} />}
        <div aria-hidden="true" className="reel-readability-shade" />
        <OfferInfo onCheckout={onCheckout} overlay post={post} />
        <PostActions
          engagement={engagement}
          layout="reel"
          liked={liked}
          onLike={onLike}
          onOpenShop={onOpenShop}
          onSave={onSave}
          post={post}
          saved={saved}
          shop={shop}
          followed={followed}
          onFollow={onFollow}
          onCheckout={onCheckout}
        />
        <div className="reel-bottom-info">
          <div className="reel-business-line">
            <button className="reel-shop-name" onClick={onOpenShop} type="button">
              <ShopAvatar shop={shop} size={38} />
              <strong>{shop.name}</strong>
            </button>
            <button className={`post-follow reel-follow ${followed ? "is-following" : ""}`} onClick={onFollow} type="button">{followed ? "Following" : "Follow"}</button>
          </div>
          <PostCaption overlay post={post} />
          <PostTimestamp value={post.publishedAt} />
        </div>
        <span aria-live="polite" className="share-feedback reel-share-feedback">{engagement.shareLabel}</span>
      </div>
    </PostContainer>
  );
}