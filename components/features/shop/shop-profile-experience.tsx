"use client";

import { Bookmark, ChevronDown, Clock3, MapPin, Phone, Share2, Star, Tag } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PostCard from "@/components/features/discover/post-card";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Button } from "@/components/ui/button";
import { DirectionsButton } from "@/components/ui/directions-button";
import { EmptyState } from "@/components/ui/states";
import { publishFollowChange, useFollowSync } from "@/lib/follow-sync";
import { BUSINESS_CATEGORY_LABELS, type FeedPost } from "@/types/commerce";
import type { ShopProfile } from "@/services/shop-profile.service";
import type { PurchaseHistoryRecord } from "@/services/purchase-history.service";
import MenuOrderExperience from "@/components/features/shop/menu-order-experience";

type ShopProfileExperienceProps = { profile: ShopProfile; authenticated: boolean; orders: PurchaseHistoryRecord[]; initialOrderId?: string };
type PostFilter = "All" | "Posts" | "Videos";
type ShopSection = "about" | "menu" | "offers" | "orders" | "posts";

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function isPaidOrder(status: string) {
  return ["paid", "success", "completed"].includes(status.toLowerCase());
}

export default function ShopProfileExperience({ profile, authenticated, orders, initialOrderId }: ShopProfileExperienceProps) {
  const router = useRouter();
  const { followed, followerCount, updateFollowed } = useFollowSync(
    profile.shop.id,
    Boolean(profile.shop.followed),
    profile.shop.followerCount,
  );
  const [activeSection, setActiveSection] = useState<ShopSection>(initialOrderId ? "menu" : "posts");
  const [filter, setFilter] = useState<PostFilter>("All");
  const [liked, setLiked] = useState(() => profile.posts.filter((post) => post.liked).map((post) => post.id));
  const [saved, setSaved] = useState(() => profile.posts.filter((post) => post.saved).map((post) => post.id));
  const [interactionError, setInteractionError] = useState("");
  const [shareFeedback, setShareFeedback] = useState("");
  const [shopSaved, setShopSaved] = useState(false);
  const [orderToUpdate, setOrderToUpdate] = useState<PurchaseHistoryRecord | undefined>(() => orders.find((order) => order.billId === initialOrderId));

  useEffect(() => {
    if (activeSection !== "orders") return;
    const hasActiveOrders = orders.some((order) => !["completed", "cancelled", "rejected", "ready"].includes(order.status));
    if (!hasActiveOrders) return;
    const refreshTimer = window.setInterval(() => router.refresh(), 15000);
    return () => window.clearInterval(refreshTimer);
  }, [activeSection, orders, router]);

  const posts = profile.posts.filter((post) => filter === "All" || filter === "Posts" && post.mediaType === "image" || filter === "Videos" && post.mediaType === "video");
  const offerPosts = profile.posts.filter((post) => post.kind === "offer");
  const orderedOrders = [...orders.filter((order) => !isPaidOrder(order.status)), ...orders.filter((order) => isPaidOrder(order.status))];

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
      <header className="shop-profile-topbar"><BackButton className="shop-back" label="Go back" /><Link aria-label="ZIDDU home" className="brand-lockup" href="/"><BrandLogo alt="" /></Link></header>
      <div aria-label={`${profile.shop.name} cover image`} className="vendor-profile-cover" role="img" style={{ backgroundImage: `url("${profile.shop.coverImage || profile.posts[0]?.image || profile.shop.image}")` }}><div className="vendor-profile-cover-shade" /></div>
      <section className="shop-profile-header" aria-labelledby="shop-profile-name">
        <div className="shop-profile-identity"><div className="shop-profile-avatar-column"><Avatar alt={profile.shop.name} image={profile.shop.image} initials={profile.shop.initials} size="lg" /><div className="shop-profile-rating"><Star aria-hidden="true" size={15} fill="currentColor" /> <strong>{profile.shop.rating.toFixed(1)}</strong>{profile.shop.distanceLabel && <span>· {profile.shop.distanceLabel}</span>}</div></div><div><h1 id="shop-profile-name">{profile.shop.name}</h1>{profile.shop.description && <span className="shop-profile-subtitle">{profile.shop.description}</span>}<div className="shop-profile-location"><MapPin size={14} /> {profile.shop.area || profile.shop.city || profile.shop.address}</div><div className="shop-profile-status"><span className={`shop-status-dot ${profile.shop.status === "Closed" ? "is-closed" : ""}`} /> <strong>{profile.shop.status}</strong><span>· {profile.shop.businessHours || "10 AM – 11 PM"}</span></div></div></div>
        <div className="shop-profile-quick-actions"><a aria-label={`Call ${profile.shop.name}`} className="shop-quick-action" href={profile.shop.phone ? `tel:${profile.shop.phone.replace(/\s/g, "")}` : undefined}><Phone size={22} /><span>Call</span></a><button aria-pressed={shopSaved} className={`shop-quick-action ${shopSaved ? "is-active" : ""}`} onClick={() => setShopSaved((current) => !current)} type="button"><Bookmark size={22} fill={shopSaved ? "currentColor" : "none"} /><span>Save</span></button><button aria-label="Share shop" className="shop-quick-action" onClick={() => { void shareShop(); }} type="button"><Share2 size={22} /><span>Share</span></button></div>
      </section>
      {/* <div className="shop-profile-contact"><span><MapPin size={15} />{profile.shop.address}{profile.shop.pincode ? `, ${profile.shop.pincode}` : ""}</span></div> */}
      <nav className="shop-profile-tabs" aria-label="Shop profile sections" role="tablist">{([["posts", `Posts · ${profile.posts.length}`], ["offers", `Offers${profile.offers.length ? ` · ${profile.offers.length}` : ""}`], ["about", "About"], ["menu", profile.shop.category === "RESTAURANT" ? "Menu" : "Products"], ["orders", `Orders${orders.length ? ` · ${orders.length}` : ""}`]] as const).map(([value, label]) => <button aria-selected={activeSection === value} className={activeSection === value ? "is-active" : ""} key={value} onClick={() => setActiveSection(value)} role="tab" type="button">{label}</button>)}</nav>
      {activeSection === "posts" && <section className="shop-posts" aria-labelledby="shop-posts-title"><div className="shop-section-heading"><div><h2 id="shop-posts-title">Post</h2></div><span className="shop-post-count">{profile.posts.length}</span></div><div className="shop-post-tabs" role="tablist" aria-label="Filter shop posts">{(["All", "Poster", "Videos"] as PostFilter[]).map((item) => <button aria-selected={filter === item} className={filter === item ? "is-active" : ""} key={item} onClick={() => setFilter(item)} role="tab" type="button">{item}<ChevronDown size={12} /></button>)}</div>{posts.length === 0 ? <EmptyState description="This shop has not shared anything in this format yet." title="No posts yet" /> : <div className="shop-post-list">{posts.map((post: FeedPost) => <PostCard followed={followed} key={post.id} liked={liked.includes(post.id)} onCheckout={() => undefined} onFollow={() => { void interact("follow", profile.shop.id); }} onLike={() => { void interact("like", post.id); }} onOpenShop={() => undefined} onSave={() => { void interact("save", post.id); }} post={post} saved={saved.includes(post.id)} shop={shopForPost()} />)}</div>}</section>}
      {activeSection === "about" && <section className="shop-profile-about" aria-labelledby="shop-about-title"><div className="shop-section-heading"><div><span className="section-kicker">KNOW THE BUSINESS</span><h2 id="shop-about-title">About</h2></div></div><p>{profile.shop.description}</p><div className="shop-profile-details"><span><Tag size={15} />{BUSINESS_CATEGORY_LABELS[profile.shop.category]}{profile.shop.distanceLabel ? ` · ${profile.shop.distanceLabel}` : ""}</span><span><MapPin size={15} />{profile.shop.address}{profile.shop.pincode ? `, ${profile.shop.pincode}` : ""}</span>{profile.shop.phone && <a href={`tel:${profile.shop.phone.replace(/\s/g, "")}`}><Phone size={15} />{profile.shop.phone}</a>}<span><Clock3 size={15} />{profile.shop.businessHours ?? (profile.shop.workingDays.length > 0 ? `${profile.shop.workingDays.slice(0, 3).join(" · ")}${profile.shop.workingDays.length > 3 ? " · ..." : ""}` : "Hours not listed")}</span><span><span className={`shop-status-dot ${profile.shop.status === "Closed" ? "is-closed" : ""}`} />{profile.shop.status}</span></div><DirectionsButton className="shop-directions" label="Get directions" shop={profile.shop} /></section>}
      {activeSection === "offers" && <section className="shop-offers" aria-labelledby="shop-offers-title"><div className="shop-section-heading"><div><span className="section-kicker">GOOD THINGS TO KNOW</span><h2 id="shop-offers-title">Offers from here</h2></div><Tag size={18} /></div>{offerPosts.length > 0 ? <div className="shop-post-list">{offerPosts.map((post) => <PostCard followed={followed} key={post.id} liked={liked.includes(post.id)} onCheckout={() => undefined} onFollow={() => { void interact("follow", profile.shop.id); }} onLike={() => { void interact("like", post.id); }} onOpenShop={() => undefined} onSave={() => { void interact("save", post.id); }} post={post} saved={saved.includes(post.id)} shop={shopForPost()} />)}</div> : profile.offers.length === 0 ? <p className="shop-compact-empty">No offers from this shop yet.</p> : <div className="shop-offer-list">{profile.offers.map((offer) => <article className="shop-offer" key={offer.postId}><div><strong>{offer.badge ?? "Local offer"}</strong><span>{offer.title}</span>{offer.description && <small>{offer.description}</small>}{offer.validUntil && <small>Valid until {new Date(offer.validUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</small>}</div>{offer.price !== undefined && <b>{offer.originalPrice !== undefined && <del>{money(offer.originalPrice)} </del>}{money(offer.price)}</b>}</article>)}</div>}</section>}
      {activeSection === "menu" && <MenuOrderExperience authenticated={authenticated} existingOrder={orderToUpdate} onClose={() => { setOrderToUpdate(undefined); setActiveSection("posts"); }} products={profile.products} shop={profile.shop} />}
      {activeSection === "orders" && <section className="shop-orders" aria-labelledby="shop-orders-title"><div className="shop-section-heading"><div><h2 id="shop-orders-title">YOUR ORDERS</h2></div></div>{orders.length === 0 ? <EmptyState description="Orders from this shop will appear here." title="No orders yet" /> : <div className="shop-order-list">{orders.map((order) => { const canUpdate = !isPaidOrder(order.status) && !["cancelled", "rejected", "ready"].includes(order.status); return <article className="shop-order-card" key={order.billId}><div className="shop-order-card-top"><strong>Order #{order.billId}</strong><span className={`shop-order-status is-${order.status}`}>{order.status}</span></div><div className="shop-order-items">{order.products.map((product, index) => <span key={`${order.billId}-${product.itemId ?? index}`}>{product.itemName ?? `Item ${product.itemId ?? "purchase"}`} × {product.quantity}</span>)}</div><div className="shop-order-card-bottom"><span>{order.date ? new Date(order.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Date unavailable"}</span><strong>{money(order.total)}</strong></div><button className="shop-order-add" disabled={!authenticated || !canUpdate} onClick={() => { setOrderToUpdate(order); setActiveSection("menu"); }} type="button">Add More Items</button></article>; })}</div>}</section>}
    </main>
  );
}
