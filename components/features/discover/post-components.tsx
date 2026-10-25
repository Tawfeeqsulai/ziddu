"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  MapPin,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { DirectionsButton } from "@/components/ui/directions-button";
import { PostContainer } from "@/components/ui/post-container";
import { SocialActions } from "@/components/ui/social-actions";
import type { FeedPost, Shop } from "@/types/commerce";

export type PostCoreProps = {
  post: FeedPost;
  shop: Shop;
  distanceLabel?: string;
  followed: boolean;
  liked: boolean;
  saved: boolean;
  onFollow: () => void;
  onLike: () => void;
  onSave: () => void;
  onOpenShop: () => void;
  onCheckout: () => void;
  hideFollow?: boolean;
};

export type PostEngagement = {
  shareLabel: string;
  shareCount: number;
  onShare: () => void;
};

export type PostPresentationProps = PostCoreProps & {
  engagement: PostEngagement;
};

export function ShopAvatar({ shop, size = 42 }: { shop: Shop; size?: number }) {
  return <Avatar alt={shop.name} className="post-shop-avatar" image={shop.image} initials={shop.initials} size="md" style={{ height: size, width: size }} />;
}

export function ShopInfo({ shop, distanceLabel }: { shop: Shop; distanceLabel?: string }) {
  const rawDistance = distanceLabel || (shop.distance !== "Nearby" ? `${shop.distance} away` : "Nearby");
  const numericDistance = rawDistance.match(/^(\d+(?:\.\d+)?)\s*(m|km)(?:\s+away)?$/i);
  const distanceKm = numericDistance
    ? Number(numericDistance[1]) * (numericDistance[2].toLowerCase() === "m" ? 0.001 : 1)
    : null;
  const distance = distanceKm === null
    ? rawDistance
    : distanceKm < 1
      ? `${Math.max(1, Math.round(distanceKm * 1000))} m away`
      : `${Number(distanceKm.toFixed(1))} km away`;
  return (
    <Link className="post-shop-identity" href={`/shops/${shop.id}`}>
      <ShopAvatar shop={shop} />
      <span className="post-shop-details">
        <strong>{shop.name}</strong>
        <span className="post-shop-location">
          <MapPin size={12} />
          <span className="post-location-distance">{distance}</span>
        </span>
      </span>
    </Link>
  );
}

export function LocationInfo({ shop, overlay = false }: { shop: Shop; overlay?: boolean }) {
  const locationText = shop.area || shop.city || "Location not added";
  return <DirectionsButton className={`${overlay ? "reel-location" : ""} social-location`} compact={overlay} icon={overlay ? "pin" : "navigation"} label={overlay ? "Direction" : locationText} shop={shop} />;
}

export function PostHeader({ shop, followed, onFollow, distanceLabel, hideFollow = false }: PostCoreProps) {
  return (
    <header className="social-post-header">
      <ShopInfo distanceLabel={distanceLabel} shop={shop} />
      {!hideFollow && <div className="post-header-actions">
        <button aria-label={`${followed ? "Unfollow" : "Follow"} ${shop.name}`} className={`post-follow ${followed ? "is-following" : ""}`} onClick={onFollow} type="button">
          {followed ? <><Check size={13} /> Following</> : "Follow"}
        </button>
      </div>}
    </header>
  );
}

export function PostActions({ liked, saved, shop, post, onLike, onSave, engagement, layout = "inline" }: PostCoreProps & { engagement: PostEngagement; layout?: "inline" | "reel" }) {
  const overlay = layout === "reel";
  const likeCount = Math.max(0, post.likes + (liked === Boolean(post.liked) ? 0 : liked ? 1 : -1));
  const saveCount = Math.max(0, (post.saves ?? 0) + (saved === Boolean(post.saved) ? 0 : saved ? 1 : -1));
  const [directionCount, setDirectionCount] = useState(post.directionCount ?? 0);
  useEffect(() => setDirectionCount(post.directionCount ?? 0), [post.directionCount, post.id]);
  function recordDirection() {
    setDirectionCount((count) => count + 1);
    void fetch("/api/feed/interactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "direction", postId: post.id }),
      keepalive: true,
    }).then(async (response) => {
      if (!response.ok) throw new Error("Direction count unavailable");
      const result = await response.json() as { directionCount?: number };
      if (typeof result.directionCount === "number") setDirectionCount(result.directionCount);
    }).catch(() => setDirectionCount((count) => Math.max(0, count - 1)));
  }
  return (
    <div className={`social-post-actions ${overlay ? "reel-actions" : ""}`}>
      <SocialActions accessibleName={`${overlay ? "Reel" : "post"} from ${shop.name}`} likeCount={likeCount} liked={liked} onLike={onLike} onSave={onSave} onShare={engagement.onShare} overlay={overlay} saveCount={saveCount} saved={saved} shareCount={engagement.shareCount} trailingAction={<DirectionsButton className={overlay ? "social-action post-direction-action" : "post-direction-button"} compact icon="pin" label={overlay ? "Direction" : "Get directions"} count={directionCount} onClick={recordDirection} postId={post.id} shop={shop} />} />
    </div>
  );
}

export function PostCaption({ post, overlay = false, showHashtags = true }: { post: FeedPost; overlay?: boolean; showHashtags?: boolean }) {
  return (
    <div className={`social-caption ${overlay ? "reel-caption" : ""}`}>
      <strong>{post.title}</strong>
      {showHashtags && post.hashtags.length > 0 && <span className="post-hashtags">{post.hashtags.join(" ")}</span>}
    </div>
  );
}

function relativeTimestamp(value: string, now: number) {
  const publishedAt = new Date(value).getTime();
  if (!Number.isFinite(publishedAt)) return "";
  const elapsed = Math.max(0, now - publishedAt);
  const minutes = Math.floor(elapsed / 60_000);
  const hours = Math.floor(elapsed / 3_600_000);
  const days = Math.floor(elapsed / 86_400_000);
  if (elapsed < 60_000) return "Just now";
  if (minutes < 60) return `${minutes} min${minutes === 1 ? "" : "s"} ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  if (days < 28) return `${Math.floor(days / 7)}w ago`;
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", ...(new Date(value).getFullYear() !== new Date(now).getFullYear() ? { year: "numeric" } : {}) }).format(new Date(value));
}

function PostTimestamp({ value }: { value: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return <time className="post-timestamp" dateTime={value}>{now === null ? "Recently" : relativeTimestamp(value, now)}</time>;
}

function formatOfferCountdown(validUntil: string, now: number) {
  const remaining = new Date(validUntil).getTime() - now;
  if (!Number.isFinite(remaining)) return "Limited time";
  if (remaining <= 0) return "Offer ended";
  const seconds = Math.ceil(remaining / 1_000);
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  if (days > 0) return `Ends in ${days}d ${hours}h ${minutes}m ${remainder}s`;
  if (hours > 0) return `Ends in ${hours}h ${minutes}m ${remainder}s`;
  if (minutes > 0) return `Ends in ${minutes}m ${remainder}s`;
  return `Ends in ${remainder}s`;
}

function OfferNotice({ validUntil, label }: { validUntil?: string; label?: string }) {
  const [now, setNow] = useState<number | null>(null);
  const [deadline, setDeadline] = useState<number | null>(null);
  useEffect(() => {
    const offerExpiry = validUntil ? new Date(validUntil).getTime() : Number.NaN;
    setDeadline(Number.isFinite(offerExpiry) ? offerExpiry : Date.now() + 12 * 60 * 60 * 1_000);
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [validUntil]);
  const countdown = deadline !== null && now !== null
    ? formatOfferCountdown(new Date(deadline).toISOString(), now)
    : "Ends in 12h 0m 0s";
  const countdownLabel = countdown.startsWith("Ends in ")
    ? <>Ends in <b>{countdown.slice("Ends in ".length)}</b></>
    : countdown;
  return <div aria-label={`Offer: ${label || "Special deal"}. ${countdown}`} className="post-offer-banner" role="timer">
    <strong>OFFER HOURS</strong>
    <span>{countdownLabel}</span>
    <em className="post-offer-deal">{label || "Special Deal"}</em>
  </div>;
}

function OfferEndedWatermark({ validUntil }: { validUntil?: string }) {
  const [ended, setEnded] = useState(false);
  useEffect(() => {
    if (!validUntil) return;
    const update = () => setEnded(new Date(validUntil).getTime() <= Date.now());
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, [validUntil]);
  return ended ? <div aria-label="Offer ended" className="offer-ended-watermark"><span>OFFER ENDED</span></div> : null;
}

export function ImagePost(props: PostPresentationProps) {
  const { post, shop, engagement, hideFollow = false, liked, onLike } = props;
  const lastMediaTap = useRef(0);
  const showOfferBanner = post.kind === "offer" || shop.category === "RESTAURANT";
  return (
    <PostContainer className="social-post image-post" variant="image">
      <PostHeader {...props} hideFollow={hideFollow} />
      <div className="social-post-media image-post-media" onClick={(event) => {
        if ((event.target as HTMLElement).closest("button, a")) return;
        const now = Date.now();
        if (now - lastMediaTap.current < 350) {
          event.preventDefault();
          lastMediaTap.current = 0;
          if (!liked) onLike();
        } else {
          lastMediaTap.current = now;
        }
      }}>
        <Image alt={post.imageAlt} fill loading="lazy" sizes="(max-width: 620px) 100vw, 680px" src={post.image} unoptimized />
        {showOfferBanner && post.kind === "offer" && <OfferEndedWatermark validUntil={post.offerValidUntil} />}
      </div>
      {showOfferBanner && <OfferNotice label={post.badge ?? (shop.category === "RESTAURANT" ? "50% OFF" : undefined)} validUntil={post.offerValidUntil} />}
      <div className="social-post-body">
        <PostActions {...props} engagement={engagement} />
        <div className="post-location-time">
          {post.hashtags.length > 0 && <span className="post-hashtags">{post.hashtags.join(" ")}</span>}
          <PostTimestamp value={post.publishedAt} />
        </div>
        <span aria-live="polite" className="share-feedback">{engagement.shareLabel}</span>
      </div>
    </PostContainer>
  );
}

function ReelVideo({ post, muted, videoRef }: { post: FeedPost; muted: boolean; videoRef: React.RefObject<HTMLVideoElement | null> }) {

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) void video.play().catch(() => undefined);
      else video.pause();
    }, { threshold: 0.55 });
    observer.observe(video);
    return () => observer.disconnect();
  }, [videoRef]);

  return <video aria-label={post.imageAlt} controls={false} loop muted={muted} playsInline poster={post.image} preload="metadata" ref={videoRef} src={post.mediaUrl} />;
}

export function VideoPost(props: PostPresentationProps) {
  const { post, shop, followed, liked, saved, onFollow, onLike, onSave, onOpenShop, onCheckout, engagement, hideFollow = false } = props;
  const showOfferBanner = post.kind === "offer" || shop.category === "RESTAURANT";
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const openVideoTimer = useRef<number | null>(null);
  const [muted, setMuted] = useState(true);

  function toggleSound(event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const nextMuted = !muted;
    setMuted(nextMuted);
    if (videoRef.current) videoRef.current.muted = nextMuted;
  }

  function handleStageDoubleTap(event: React.MouseEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest("button, a")) return;
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const position = bounds.width ? (event.clientX - bounds.left) / bounds.width : 0.5;
    const video = videoRef.current;
    if (position < 1 / 3) {
      if (video && Number.isFinite(video.duration)) video.currentTime = Math.max(0, video.currentTime - 10);
    } else if (position > 2 / 3) {
      if (video && Number.isFinite(video.duration)) video.currentTime = Math.min(video.duration, video.currentTime + 10);
    } else {
      if (!liked) onLike();
    }
  }

  return (
    <PostContainer className="video-post" variant="reel">
      <div className="reel-stage" onClick={(event) => {
        if ((event.target as HTMLElement).closest("button, a")) return;
        if (openVideoTimer.current !== null) {
          window.clearTimeout(openVideoTimer.current);
          openVideoTimer.current = null;
          handleStageDoubleTap(event);
          return;
        }
        openVideoTimer.current = window.setTimeout(() => {
          router.push(`/reels?post=${encodeURIComponent(post.id)}`);
          openVideoTimer.current = null;
        }, 350);
      }}>
        <Image alt={post.imageAlt} className="reel-poster" fill loading="lazy" sizes="(max-width: 620px) 100vw, 420px" src={post.image} unoptimized />
        {showOfferBanner && post.kind === "offer" && <OfferEndedWatermark validUntil={post.offerValidUntil} />}
        {post.mediaUrl && <ReelVideo muted={muted} post={post} videoRef={videoRef} />}
        <button aria-label={muted ? "Unmute video" : "Mute video"} className="reel-sound-button" onClick={toggleSound} type="button">{muted ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
        <div aria-hidden="true" className="reel-readability-shade" />
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
          {showOfferBanner && <OfferNotice label={post.badge ?? (shop.category === "RESTAURANT" ? "50% OFF" : undefined)} validUntil={post.offerValidUntil} />}
          <div className="reel-business-line">
            <button className="reel-shop-name" onClick={onOpenShop} type="button">
              <ShopAvatar shop={shop} size={38} />
              <strong>{shop.name}</strong>
            </button>
            {!hideFollow && <button className={`post-follow reel-follow ${followed ? "is-following" : ""}`} onClick={onFollow} type="button">{followed ? "Following" : "Follow"}</button>}
          </div>
          <PostCaption overlay post={post} />
          <div className="post-location-time">
            <PostTimestamp value={post.publishedAt} />
          </div>
        </div>
        <span aria-live="polite" className="share-feedback reel-share-feedback">{engagement.shareLabel}</span>
      </div>
    </PostContainer>
  );
}
