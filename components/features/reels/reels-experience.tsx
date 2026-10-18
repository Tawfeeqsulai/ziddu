"use client";

import { ArrowDown, ArrowUp, Check, Clapperboard, Compass, Home, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BottomNavigation } from "@/components/ui/bottom-navigation";
import { BackButton } from "@/components/ui/back-button";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { SocialActions } from "@/components/ui/social-actions";
import { DirectionsButton } from "@/components/ui/directions-button";
import ReelVideoPlayer from "@/components/features/reels/reel-video-player";
import type { ReelItem, ReelsResult } from "@/services/reels.service";

type ReelsExperienceProps = { initial: ReelsResult; authenticated: boolean };

export default function ReelsExperience({ initial, authenticated }: ReelsExperienceProps) {
  const router = useRouter();
  const [items, setItems] = useState<ReelItem[]>(initial.reels);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(Boolean(initial.failed));
  const [followed, setFollowed] = useState<string[]>(() => initial.reels.filter((item) => item.followed).map((item) => item.shop.id));
  const [liked, setLiked] = useState<string[]>(() => initial.reels.filter((item) => item.post.liked).map((item) => item.post.id));
  const [saved, setSaved] = useState<string[]>(() => initial.reels.filter((item) => item.post.saved).map((item) => item.post.id));
  const [failedVideos, setFailedVideos] = useState<string[]>([]);
  const [interactionError, setInteractionError] = useState("");

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => entries.forEach((entry) => entry.target.classList.toggle("is-visible", entry.isIntersecting)), { threshold: 0.65 });
    document.querySelectorAll(".reel-surface").forEach((surface) => observer.observe(surface));
    function onKeyDown(event: KeyboardEvent) {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const current = document.querySelector<HTMLElement>(".reel-surface.is-visible");
      if (!current) return;
      if (event.key === "ArrowDown") { event.preventDefault(); current.nextElementSibling?.scrollIntoView({ behavior: "smooth" }); }
      if (event.key === "ArrowUp") { event.preventDefault(); current.previousElementSibling?.scrollIntoView({ behavior: "smooth" }); }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => { observer.disconnect(); window.removeEventListener("keydown", onKeyDown); };
  }, [items.length]);

  async function interact(action: "like" | "save" | "follow", id: string) {
    if (!authenticated) return router.push("/login");
    setInteractionError("");
    const update = action === "like" ? setLiked : action === "save" ? setSaved : setFollowed;
    const wasActive = (action === "like" ? liked : action === "save" ? saved : followed).includes(id);
    update((current) => wasActive ? current.filter((item) => item !== id) : [...current, id]);
    const body = action === "follow" ? { action, shopId: id } : { action, postId: id };
    try {
      const response = await fetch("/api/feed/interactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, active: !wasActive }) });
      if (!response.ok) throw new Error("Interaction unavailable");
    } catch {
      update((current) => wasActive ? [...current.filter((item) => item !== id), id] : current.filter((item) => item !== id));
      setInteractionError("That action could not be saved. Please try again.");
    }
  }

  async function share(postId: string, title: string) {
    const url = `${window.location.origin}/reels?post=${encodeURIComponent(postId)}`;
    try {
      if (navigator.share) await navigator.share({ title, text: `Check out this Reel on ZIDDU: ${title}`, url });
      else { await navigator.clipboard.writeText(url); setInteractionError("Link copied"); }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setInteractionError("Could not share link");
    }
  }

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const response = await fetch(`/api/reels?page=${page + 1}`);
      if (!response.ok) throw new Error("Unable to load more Videos");
      const result = await response.json() as ReelsResult;
      setItems((current) => [...current, ...result.reels]);
      setPage((current) => current + 1);
      setHasMore(result.hasMore);
    } catch {
      setError(true);
    } finally {
      setLoadingMore(false);
    }
  }

  if (error && items.length === 0) return <main className="reels-page"><ErrorState description="Please try again in a moment." onAction={() => window.location.reload()} title="Couldn't load Videos" /></main>;
  if (items.length === 0) return <main className="reels-page"><EmptyState description="Check back later for new videos from local businesses." title="No Videos nearby yet" /></main>;

  return <main className="reels-page">
    <header className="reels-topbar"><BackButton label="Go back" /><span><span className="section-kicker">ZIDDU VIDEO</span><strong>Videos</strong></span><span className="reels-key-hint"><ArrowUp size={13} /><ArrowDown size={13} /></span></header>
    <div className="reels-scroll" onScroll={(event) => { const element = event.currentTarget; if (element.scrollTop + element.clientHeight > element.scrollHeight - element.clientHeight * 1.5) void loadMore(); }}>
      {items.map(({ post, shop }) => <article className="reel-surface" key={post.id} onDoubleClick={(event) => { if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLAnchorElement) return; void interact("like", post.id); }}>
        {failedVideos.includes(post.id) ? <div className="reel-video-failure"><span>Video couldn&apos;t connect</span><small>{shop.name} · {shop.area}, {shop.city}</small><button onClick={() => setFailedVideos((current) => current.filter((id) => id !== post.id))} type="button">Try again</button></div> : <ReelVideoPlayer alt={post.imageAlt} onError={() => setFailedVideos((current) => current.includes(post.id) ? current : [...current, post.id])} poster={post.image} src={post.mediaUrl!} />}
        <div className="reels-scrim" aria-hidden="true" />
        {post.price !== undefined && <div className="reels-offer reels-offer-top"><strong>{post.badge ?? "Local offer"}</strong><b>{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(post.price)}</b></div>}
        <div className="reels-actions"><SocialActions accessibleName={`Video from ${shop.name}`} liked={liked.includes(post.id)} onLike={() => { void interact("like", post.id); }} onSave={() => { void interact("save", post.id); }} onShare={() => { void share(post.id, post.title); }} saved={saved.includes(post.id)} overlay trailingAction={<DirectionsButton className="reels-location" compact icon="pin" label="Direction" shop={shop} />} /></div>
        <div className="reels-info"><div className="reels-business"><Link aria-label={`Open ${shop.name}`} href={`/shops/${shop.id}`}><span className="reels-avatar">{shop.initials}</span><strong>{shop.name}</strong></Link><button className={followed.includes(shop.id) ? "is-following" : ""} onClick={() => { void interact("follow", shop.id); }} type="button">{followed.includes(shop.id) ? <><Check size={13} /> Following</> : "Follow"}</button></div><h2>{post.title}</h2><p>{post.description}</p></div>
      </article>)}
      {loadingMore && <div className="reels-loading-more">Loading more Videos...</div>}
    </div>
    {interactionError && <p aria-live="polite" className="share-feedback" role="alert">{interactionError}</p>}<BottomNavigation items={[{ label: "Home", icon: Home, onClick: () => router.push("/") }, { label: "Discover", icon: Compass, onClick: () => router.push("/search") }, { label: "Videos", icon: Clapperboard, active: true }, { label: "Profile", icon: UserRound, onClick: () => router.push("/profile") }]} />
  </main>;
}
