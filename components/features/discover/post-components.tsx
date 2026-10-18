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

export function ShopAvatar({ shop, size = 42 }: { shop: Shop; size?: number }) {
  return <Avatar alt={shop.name} className="post-shop-avatar" image={shop.image} initials={shop.initials} size="md" style={{ height: size, width: size }} />;
}

export function ShopInfo({ shop }: { shop: Shop }) {
  const locationText = shop.area || shop.city || "Location not added";
  return (
    <Link className="post-shop-identity" href={`/shops/${shop.id}`}>
      <ShopAvatar shop={shop} />
      <span className="post-shop-details">
        <strong>{shop.name}</strong>
        <span className="post-shop-location">
          <MapPin size={12} />
          <span className="post-location-preview">{locationText}</span>
          <span className="post-location-text">{locationText}</span>
          <i className={`open-status-dot ${shop.status === "Closed" ? "is-closed" : ""}`} />
          <span className="post-open-status">{shop.status}</span>
        </span>
      </span>
    </Link>
  );
}

export function LocationInfo({ shop, overlay = false }: { shop: Shop; overlay?: boolean }) {
  const locationText = shop.area || shop.city || "Location not added";
  return <DirectionsButton className={`${overlay ? "reel-location" : ""} social-location`} compact={overlay} icon={overlay ? "pin" : "navigation"} label={overlay ? "Direction" : locationText} shop={shop} />;
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
      <SocialActions accessibleName={`${overlay ? "Reel" : "post"} from ${shop.name}`} liked={liked} onLike={onLike} onSave={onSave} onShare={engagement.onShare} overlay={overlay} saved={saved} trailingAction={<Button aria-label={`Direction to ${shop.name}`} className="social-action" onClick={() => router.push(`/directions/${shop.id}`)} variant="icon"><MapPin size={overlay ? 27 : 24} />{overlay && <span>Direction</span>}</Button>} />
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

function PostStats({ post, liked }: { post: FeedPost; liked: boolean }) {
  return <div className="social-post-stats">{formatCount(post.likes + (liked ? 1 : 0))} likes</div>;
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

function OfferNotice({ validUntil }: { validUntil?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1_000);
    return () => window.clearInterval(timer);
  }, []);
  const countdown = validUntil && now !== null ? formatOfferCountdown(validUntil, now) : "Limited time";
  const countdownLabel = countdown.startsWith("Ends in ")
    ? <>Ends in <b>{countdown.slice("Ends in ".length)}</b></>
    : countdown;
  return <div aria-label={`Offer. ${countdown}`} className="post-offer-banner" role="timer">
    <strong>OFFER</strong>
    <span>{countdownLabel}</span>
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
  const { post, shop, liked, onOpenShop, engagement } = props;
  return (
    <PostContainer className="social-post image-post" variant="image">
      <PostHeader {...props} />
      <div className="social-post-media image-post-media">
        <Image alt={post.imageAlt} fill loading="lazy" sizes="(max-width: 620px) 100vw, 680px" src={post.image} unoptimized />
        {post.kind === "offer" && <OfferEndedWatermark validUntil={post.offerValidUntil} />}
      </div>
      {post.kind === "offer" && <OfferNotice validUntil={post.offerValidUntil} />}
      <div className="social-post-body">
        <PostActions {...props} engagement={engagement} />
        <PostStats liked={liked} post={post} />
        <PostCaption onOpenShop={onOpenShop} post={post} shopName={shop.name} />
        <div className="post-location-time">
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
  const { post, shop, followed, liked, saved, onFollow, onLike, onSave, onOpenShop, onCheckout, engagement } = props;
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

  return (
    <PostContainer className="video-post" variant="reel">
      <div className="reel-stage" onClick={(event) => { if ((event.target as HTMLElement).closest("button, a")) return; if (openVideoTimer.current !== null) window.clearTimeout(openVideoTimer.current); openVideoTimer.current = window.setTimeout(() => router.push(`/reels?post=${encodeURIComponent(post.id)}`), 260); }} onDoubleClick={(event) => { if ((event.target as HTMLElement).closest("button, a")) return; event.preventDefault(); if (openVideoTimer.current !== null) window.clearTimeout(openVideoTimer.current); openVideoTimer.current = null; onLike(); }}>
        <Image alt={post.imageAlt} className="reel-poster" fill loading="lazy" sizes="(max-width: 620px) 100vw, 420px" src={post.image} unoptimized />
        {post.kind === "offer" && <OfferEndedWatermark validUntil={post.offerValidUntil} />}
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
          {post.kind === "offer" && <OfferNotice validUntil={post.offerValidUntil} />}
          <div className="reel-business-line">
            <button className="reel-shop-name" onClick={onOpenShop} type="button">
              <ShopAvatar shop={shop} size={38} />
              <strong>{shop.name}</strong>
            </button>
            <button className={`post-follow reel-follow ${followed ? "is-following" : ""}`} onClick={onFollow} type="button">{followed ? "Following" : "Follow"}</button>
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
