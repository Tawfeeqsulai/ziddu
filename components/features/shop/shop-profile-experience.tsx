"use client";

import { BadgeCheck, Check, ChevronDown, Clock3, MapPin, Phone, Share2, Star, Tag } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import PostCard from "@/components/features/discover/post-card";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { Button } from "@/components/ui/button";
import { DirectionsButton } from "@/components/ui/directions-button";
import { EmptyState } from "@/components/ui/states";
import { publishFollowChange, useFollowSync } from "@/lib/follow-sync";
import { BUSINESS_CATEGORY_LABELS, type FeedPost } from "@/types/commerce";
import type { ShopProfile } from "@/services/shop-profile.service";

type ShopProfileExperienceProps = { profile: ShopProfile; authenticated: boolean };
type PostFilter = "All" | "Posts" | "Reels";
type ShopSection = "about" | "menu" | "offers" | "posts";

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export default function ShopProfileExperience({ profile, authenticated }: ShopProfileExperienceProps) {
  const router = useRouter();
  const { followed, followerCount, updateFollowed } = useFollowSync(
    profile.shop.id,
    Boolean(profile.shop.followed),
    profile.shop.followerCount,
  );
  const [activeSection, setActiveSection] = useState<ShopSection>("posts");
  const [filter, setFilter] = useState<PostFilter>("All");
  const [liked, setLiked] = useState(() => profile.posts.filter((post) => post.liked).map((post) => post.id));
  const [saved, setSaved] = useState(() => profile.posts.filter((post) => post.saved).map((post) => post.id));
  const [interactionError, setInteractionError] = useState("");
  const [shareFeedback, setShareFeedback] = useState("");

  const posts = profile.posts.filter((post) => filter === "All" || filter === "Posts" && post.mediaType === "image" || filter === "Reels" && post.mediaType === "video");

  async function interact(action: "follow" | "like" | "save", id: string) {
    if (!authenticated) {
      router.push("/login");
      return;
    }
    setInteractionError("");
    const wasActive = action === "follow" ? followed : action === "like" ? liked.includes(id) : saved.includes(id);
    const update = (active: boolean) => {
      if (action === "follow") updateFollowed(active);
      if (action === "like") setLiked((current) => active ? [...current.filter((item) => item !== id), id] : current.filter((item) => item !== id));
      if (action === "save") setSaved((current) => active ? [...current.filter((item) => item !== id), id] : current.filter((item) => item !== id));
    };
    update(!wasActive);
    const payload = action === "follow" ? { action, shopId: id } : { action, postId: id };
    try {
      const response = await fetch("/api/feed/interactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, active: !wasActive }) });
      if (response.status === 401) { router.push("/login"); throw new Error("Sign in required"); }
      if (!response.ok) throw new Error("Interaction unavailable");
      if (action === "follow") {
        const result = await response.json() as { active?: boolean; followerCount?: number };
        if (typeof result.followerCount === "number" && result.active === !wasActive) {
          publishFollowChange({ shopId: profile.shop.id, active: result.active, followerCount: result.followerCount });
        }
      }
    } catch {
      update(wasActive);
      setInteractionError("That action could not be saved. Please try again.");
    }
  }

  function shopForPost(): ShopProfile["shop"] {
    return profile.shop;
  }

  async function shareShop() {
    const url = window.location.href;
    const text = `Check out ${profile.shop.name} on ZIDDU in ${profile.shop.area}, ${profile.shop.city}.`;
    setShareFeedback("");
    try {
      if (navigator.share) {
        await navigator.share({ title: profile.shop.name, text, url });
      } else {
        await navigator.clipboard.writeText(url);
        setShareFeedback("Shop link copied");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setShareFeedback("Could not share shop link");
    }
  }

  return (
    <main className="shop-profile-page">
      {(interactionError || shareFeedback) && <p aria-live="polite" className="share-feedback" role="status">{interactionError || shareFeedback}</p>}
      <header className="shop-profile-topbar"><BackButton className="shop-back" label="Go back" /><Link aria-label="ZIDDU home" className="brand-lockup" href="/"><span className="brand-mark">z</span><span className="brand-name">ziddu<span>.</span></span></Link></header>
      <section className="shop-profile-header" aria-labelledby="shop-profile-name">
        <div className="shop-profile-identity"><Avatar alt={profile.shop.name} image={profile.shop.image} initials={profile.shop.initials} size="lg" /><div><span className="section-kicker">{BUSINESS_CATEGORY_LABELS[profile.shop.category]}</span><h1 id="shop-profile-name">{profile.shop.name} <BadgeCheck aria-label="Verified shop" className="shop-verified" size={19} /></h1><div className="shop-profile-rating"><Star aria-hidden="true" size={15} fill="currentColor" /> <strong>{profile.shop.rating.toFixed(1)}</strong> <span>({new Intl.NumberFormat("en-IN").format(followerCount)} followers)</span></div><div className="shop-profile-location"><MapPin size={14} /> {profile.shop.area}, {profile.shop.city}</div><div className="shop-profile-status"><span className={`shop-status-dot ${profile.shop.status === "Closed" ? "is-closed" : ""}`} /> <strong>{profile.shop.status}</strong>{profile.shop.businessHours && <span>· {profile.shop.businessHours}</span>}</div></div></div>
        <div className="shop-profile-actions"><Button aria-label="Share shop" className="shop-share-button" onClick={() => { void shareShop(); }} variant="outline"><Share2 size={15} /> Share</Button><Button className={followed ? "shop-following" : ""} onClick={() => { void interact("follow", profile.shop.id); }} variant={followed ? "outline" : "primary"}>{followed ? <><Check size={15} /> Following</> : "Follow"}</Button></div>
      </section>
      <div className="shop-profile-contact"><span><MapPin size={15} />{profile.shop.address}{profile.shop.pincode ? `, ${profile.shop.pincode}` : ""}</span>{profile.shop.phone && <a href={`tel:${profile.shop.phone.replace(/\s/g, "")}`}><Phone size={15} /> Call</a>}</div>
      <nav className="shop-profile-tabs" aria-label="Shop profile sections" role="tablist">{([["posts", `Posts · ${profile.posts.length}`], ["offers", `Offers${profile.offers.length ? ` · ${profile.offers.length}` : ""}`], ["about", "About"], ["menu", profile.shop.category === "RESTAURANT" ? "Menu" : "Products"]] as const).map(([value, label]) => <button aria-selected={activeSection === value} className={activeSection === value ? "is-active" : ""} key={value} onClick={() => setActiveSection(value)} role="tab" type="button">{label}</button>)}</nav>
      {activeSection === "posts" && <section className="shop-posts" aria-labelledby="shop-posts-title"><div className="shop-section-heading"><div><span className="section-kicker">FROM THE SHOP</span><h2 id="shop-posts-title">Posts</h2></div><span className="shop-post-count">{profile.posts.length}</span></div><div className="shop-post-tabs" role="tablist" aria-label="Filter shop posts">{(["All", "Posts", "Reels"] as PostFilter[]).map((item) => <button aria-selected={filter === item} className={filter === item ? "is-active" : ""} key={item} onClick={() => setFilter(item)} role="tab" type="button">{item}<ChevronDown size={12} /></button>)}</div>{posts.length === 0 ? <EmptyState description="This shop has not shared anything in this format yet." title="No posts yet" /> : <div className="shop-post-list">{posts.map((post: FeedPost) => <PostCard followed={followed} key={post.id} liked={liked.includes(post.id)} onCheckout={() => undefined} onFollow={() => { void interact("follow", profile.shop.id); }} onLike={() => { void interact("like", post.id); }} onOpenShop={() => undefined} onSave={() => { void interact("save", post.id); }} post={post} saved={saved.includes(post.id)} shop={shopForPost()} />)}</div>}</section>}
      {activeSection === "about" && <section className="shop-profile-about" aria-labelledby="shop-about-title"><div className="shop-section-heading"><div><span className="section-kicker">KNOW THE BUSINESS</span><h2 id="shop-about-title">About</h2></div></div><p>{profile.shop.description}</p><div className="shop-profile-details"><span><Tag size={15} />{BUSINESS_CATEGORY_LABELS[profile.shop.category]}{profile.shop.distanceLabel ? ` · ${profile.shop.distanceLabel}` : ""}</span><span><MapPin size={15} />{profile.shop.address}{profile.shop.pincode ? `, ${profile.shop.pincode}` : ""}</span>{profile.shop.phone && <a href={`tel:${profile.shop.phone.replace(/\s/g, "")}`}><Phone size={15} />{profile.shop.phone}</a>}<span><Clock3 size={15} />{profile.shop.businessHours ?? (profile.shop.workingDays.length > 0 ? `${profile.shop.workingDays.slice(0, 3).join(" · ")}${profile.shop.workingDays.length > 3 ? " · ..." : ""}` : "Hours not listed")}</span><span><span className={`shop-status-dot ${profile.shop.status === "Closed" ? "is-closed" : ""}`} />{profile.shop.status}</span></div><DirectionsButton className="shop-directions" label="Get directions" shop={profile.shop} /></section>}
      {activeSection === "offers" && <section className="shop-offers" aria-labelledby="shop-offers-title"><div className="shop-section-heading"><div><span className="section-kicker">GOOD THINGS TO KNOW</span><h2 id="shop-offers-title">Offers from here</h2></div><Tag size={18} /></div>{profile.offers.length === 0 ? <p className="shop-compact-empty">No active offers right now.</p> : <div className="shop-offer-list">{profile.offers.map((offer) => <article className="shop-offer" key={offer.postId}><div><strong>{offer.badge ?? "Local offer"}</strong><span>{offer.title}</span>{offer.description && <small>{offer.description}</small>}{offer.validUntil && <small>Valid until {new Date(offer.validUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</small>}</div>{offer.price !== undefined && <b>{offer.originalPrice !== undefined && <del>{money(offer.originalPrice)} </del>}{money(offer.price)}</b>}</article>)}</div>}</section>}
      {activeSection === "menu" && <section className="shop-menu" aria-labelledby="shop-menu-title"><div className="shop-section-heading"><div><span className="section-kicker">WHAT&apos;S AVAILABLE</span><h2 id="shop-menu-title">{profile.shop.category === "RESTAURANT" ? "Menu" : "Products"}</h2></div><span className="shop-post-count">{profile.products.length} items</span></div>{profile.products.length === 0 ? <p className="shop-compact-empty">{profile.shop.category === "RESTAURANT" ? "No menu items available." : "No products listed yet."}</p> : <div className="shop-menu-groups">{Array.from(new Map(profile.products.map((product) => [product.category, profile.products.filter((item) => item.category === product.category)])).entries()).map(([category, products]) => <section className="shop-menu-group" key={category}><h3>{category}</h3>{products.map((product) => <article className="shop-product" key={product.id}>{product.image ? <Image alt={product.name} height={52} src={product.image} unoptimized width={52} /> : <span className="shop-product-placeholder"><Tag size={16} /></span>}<div><strong>{product.name}</strong><p>{product.description}</p></div><div className="shop-product-price"><b>{money(product.offer?.price ?? product.price)}</b>{product.offer?.originalPrice && <del>{money(product.offer.originalPrice)}</del>}</div></article>)}</section>)}</div>}</section>}
    </main>
  );
}
