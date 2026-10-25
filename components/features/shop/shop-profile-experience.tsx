"use client";

import { ChevronDown, Clock3, MapPin, Phone, Share2, Star, Tag, UserRoundCheck, UserRoundPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PostCard from "@/components/features/discover/post-card";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { BrandLogo } from "@/components/ui/brand-logo";
import { DirectionsButton } from "@/components/ui/directions-button";
import { EmptyState } from "@/components/ui/states";
import { publishFollowChange, useFollowSync } from "@/lib/follow-sync";
import type { FeedPost } from "@/types/commerce";
import type { ShopProfile } from "@/services/shop-profile.service";
import type { PurchaseHistoryRecord } from "@/services/purchase-history.service";
import MenuOrderExperience from "@/components/features/shop/menu-order-experience";
import { useLoginPrompt } from "@/components/features/auth/login-prompt-provider";

type ShopProfileExperienceProps = { profile: ShopProfile; authenticated: boolean; orders: PurchaseHistoryRecord[]; initialOrderId?: string };
type PostFilter = "All" | "Poster" | "Videos";
type ShopSection = "menu" | "offers" | "orders" | "posts";

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function offerHasEnded(validUntil: string | undefined, now: number | null) {
  if (!validUntil || now === null) return false;
  const endTime = new Date(validUntil).getTime();
  return Number.isFinite(endTime) && endTime <= now;
}

function isPaidOrder(status: string) {
  return ["paid", "success", "completed"].includes(status.toLowerCase());
}

export default function ShopProfileExperience({ profile, authenticated, orders, initialOrderId }: ShopProfileExperienceProps) {
  const router = useRouter();
  const { requireLogin } = useLoginPrompt();
  const { followed, followerCount, updateFollowed } = useFollowSync(
    profile.shop.id,
    Boolean(profile.shop.followed),
    profile.shop.followerCount,
  );
  const [activeSection, setActiveSection] = useState<ShopSection>(initialOrderId ? "menu" : "posts");
  const [filter, setFilter] = useState<PostFilter>("All");
  const [pendingOfferPostId, setPendingOfferPostId] = useState<string | null>(null);
  const [liked, setLiked] = useState(() => profile.posts.filter((post) => post.liked).map((post) => post.id));
  const [saved, setSaved] = useState(() => profile.posts.filter((post) => post.saved).map((post) => post.id));
  const [interactionError, setInteractionError] = useState("");
  const [shareFeedback, setShareFeedback] = useState("");
  const [orderToUpdate, setOrderToUpdate] = useState<PurchaseHistoryRecord | undefined>(() => orders.find((order) => order.billId === initialOrderId));
  const [offerCheckTime, setOfferCheckTime] = useState<number | null>(null);

  useEffect(() => {
    const updateOfferTime = () => setOfferCheckTime(Date.now());
    updateOfferTime();
    const timer = window.setInterval(updateOfferTime, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (activeSection !== "orders") return;
    const hasActiveOrders = orders.some((order) => !["completed", "cancelled", "rejected", "ready"].includes(order.status));
    if (!hasActiveOrders) return;
    const refreshTimer = window.setInterval(() => router.refresh(), 15000);
    return () => window.clearInterval(refreshTimer);
  }, [activeSection, orders, router]);

  useEffect(() => {
    if (activeSection !== "posts" || filter !== "All" || !pendingOfferPostId) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`shop-post-${pendingOfferPostId}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
      setPendingOfferPostId(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeSection, filter, pendingOfferPostId]);

  const posts = profile.posts.filter((post) => filter === "All" || filter === "Poster" && post.mediaType === "image" || filter === "Videos" && post.mediaType === "video");
  const offerPosts = profile.posts.filter((post) => post.kind === "offer");
  const offerItems = profile.offers.length > 0 ? profile.offers : offerPosts.map((post) => ({
    id: `post:${post.id}`,
    postId: post.id,
    title: post.title,
    description: post.description,
    price: post.price,
    originalPrice: post.originalPrice,
    badge: post.badge,
    productName: post.hashtags?.[post.hashtags.length - 1]?.replace(/^#/, ""),
    validUntil: post.offerValidUntil,
  }));
  const visibleOffers = offerItems.map((offer) => ({
    ...offer,
    image: profile.products.find((product) => product.name.toLowerCase() === offer.productName?.toLowerCase())?.image
      ?? profile.posts.find((post) => post.id === offer.postId)?.image,
  })).sort((a, b) => {
    const aEnded = offerHasEnded(a.validUntil, offerCheckTime);
    const bEnded = offerHasEnded(b.validUntil, offerCheckTime);
    return Number(aEnded) - Number(bEnded);
  });
  const vendorBanner = /^\d+$/.test(profile.shop.id)
    ? `https://zoggy-backend-api.vercel.app/banner?vendor_id=${encodeURIComponent(profile.shop.id)}`
    : undefined;
  const coverImages = [profile.shop.coverImage, vendorBanner]
    .filter((image): image is string => Boolean(image));
  const coverBackground = coverImages.map((image) => `url("${image.replace(/["\\]/g, "\\$&")}")`).join(", ");

  function openOfferPost(postId: string) {
    setFilter("All");
    setPendingOfferPostId(postId);
    setActiveSection("posts");
  }
  const orderedOrders = [...orders.filter((order) => !isPaidOrder(order.status)), ...orders.filter((order) => isPaidOrder(order.status))];

  async function interact(action: "follow" | "like" | "save", id: string) {
    if (!authenticated) {
      requireLogin();
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
      const result = await response.json() as { active?: boolean; followerCount?: number };
      if (typeof result.active === "boolean") update(result.active);
      if (action === "follow") {
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
    if (!authenticated) { requireLogin(); return; }
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
      <div aria-label={`${profile.shop.name} cover image`} className="vendor-profile-cover" role="img" style={{ backgroundImage: coverBackground }} />
      <section className="shop-profile-header" aria-labelledby="shop-profile-name">
        <div className="shop-profile-identity"><div className="shop-profile-avatar-column"><Avatar alt={profile.shop.name} image={profile.shop.image} initials={profile.shop.initials} size="lg" /><div className="shop-profile-rating"><Star aria-hidden="true" size={15} fill="currentColor" /> <strong>{profile.shop.rating.toFixed(1)}</strong>{profile.shop.distanceLabel && <span>· {profile.shop.distanceLabel}</span>}</div></div><div><h1 id="shop-profile-name">{profile.shop.name}</h1>{profile.shop.description && <span className="shop-profile-subtitle">{profile.shop.description}</span>}<div className="shop-profile-location"><MapPin size={14} /> {profile.shop.area || profile.shop.city || profile.shop.address}</div><div className="shop-profile-status"><span className={`shop-status-dot ${profile.shop.status === "Closed" ? "is-closed" : ""}`} /> <strong>{profile.shop.status}</strong><span>· {profile.shop.businessHours || "10 AM – 11 PM"}</span></div>{profile.visitCount !== undefined && <div className="shop-profile-visit-count">{profile.visitCount} visits through directions</div>}</div></div>
        {profile.shop.workingHours && <details className="shop-weekly-hours"><summary>Weekly hours</summary><div className="shop-weekly-hours-list">{([ ["mon", "Monday"], ["tue", "Tuesday"], ["wed", "Wednesday"], ["thu", "Thursday"], ["fri", "Friday"], ["sat", "Saturday"], ["sun", "Sunday"] ] as const).map(([day, label]) => { const hours = profile.shop.workingHours?.[day]; const from = hours?.from?.replace(/\b(am|pm)\b/gi, (period) => period.toUpperCase()); const to = hours?.to?.replace(/\b(am|pm)\b/gi, (period) => period.toUpperCase()); return <div className="shop-weekly-hours-row" key={day}><strong>{label}</strong><span>{!hours ? "Hours unavailable" : !hours.enabled ? "Closed" : from && to ? `${from} – ${to}` : "Hours unavailable"}</span></div>; })}</div></details>}
        <div className="shop-profile-quick-actions">
          <button aria-label={`${followed ? "Unfollow" : "Follow"} ${profile.shop.name}`} aria-pressed={followed} className={`shop-quick-action shop-profile-follow${followed ? " is-active" : ""}`} onClick={() => { void interact("follow", profile.shop.id); }} type="button">{followed ? <UserRoundCheck size={22} /> : <UserRoundPlus size={22} />}<span>{followed ? "Following" : "Follow"}</span></button>
          <a aria-label={`Call ${profile.shop.name}`} className="shop-quick-action" href={profile.shop.phone ? `tel:${profile.shop.phone.replace(/\s/g, "")}` : undefined}><Phone size={22} /><span>Call</span></a>
          <button aria-label="Share shop" className="shop-quick-action" onClick={() => { void shareShop(); }} type="button"><Share2 size={22} /><span>Share</span></button>
          <DirectionsButton className="shop-quick-action shop-profile-location-action" compact icon="pin" label="Location" postId={profile.posts[0]?.id} shop={profile.shop} />
        </div>
      </section>
      {/* <div className="shop-profile-contact"><span><MapPin size={15} />{profile.shop.address}{profile.shop.pincode ? `, ${profile.shop.pincode}` : ""}</span></div> */}
      <nav className="shop-profile-tabs" aria-label="Shop profile sections" role="tablist">{([["posts", `Posts · ${profile.posts.length}`], ["offers", `Offers${profile.offers.length ? ` · ${profile.offers.length}` : ""}`], ["menu", profile.shop.category === "RESTAURANT" ? "Menu" : "Products"], ["orders", `Orders${orders.length ? ` · ${orders.length}` : ""}`]] as const).map(([value, label]) => <button aria-selected={activeSection === value} className={activeSection === value ? "is-active" : ""} key={value} onClick={() => setActiveSection(value)} role="tab" type="button">{label}</button>)}</nav>
      {activeSection === "posts" && <section className="shop-posts"><div className="shop-post-tabs" role="tablist" aria-label="Filter shop posts">{(["All", "Poster", "Videos"] as PostFilter[]).map((item) => <button aria-selected={filter === item} className={filter === item ? "is-active" : ""} key={item} onClick={() => setFilter(item)} role="tab" type="button">{item}<ChevronDown size={12} /></button>)}</div>{posts.length === 0 ? <EmptyState description="This shop has not shared anything in this format yet." title="No posts yet" /> : <div className="shop-post-list">{posts.map((post: FeedPost) => <div className="shop-post-anchor" id={`shop-post-${post.id}`} key={post.id}><PostCard distanceLabel={profile.shop.distanceLabel} followed={followed} hideFollow liked={liked.includes(post.id)} onCheckout={() => undefined} onFollow={() => { void interact("follow", profile.shop.id); }} onLike={() => { void interact("like", post.id); }} onOpenShop={() => undefined} onSave={() => { void interact("save", post.id); }} post={post} saved={saved.includes(post.id)} shop={shopForPost()} /></div>)}</div>}</section>}
      {activeSection === "offers" && <section className="shop-offers" aria-label="Shop offers">{visibleOffers.length === 0 ? <p className="shop-compact-empty">No offers from this shop yet.</p> : <div className="shop-offer-list">{visibleOffers.map((offer) => {
        const isEnded = offerHasEnded(offer.validUntil, offerCheckTime);
        const canOpenPost = !isEnded && profile.posts.some((post) => post.id === offer.postId);
        const activate = () => { if (canOpenPost) openOfferPost(offer.postId); };
        return <article className={`shop-offer${isEnded ? " is-ended" : ""}${canOpenPost ? " is-navigable" : ""}`} key={offer.id} onClick={activate} onKeyDown={(event) => { if (canOpenPost && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); activate(); } }} role={canOpenPost ? "link" : undefined} tabIndex={canOpenPost ? 0 : undefined}>
          <div className="shop-offer-copy"><strong className="shop-offer-badge"><Tag size={12} />{offer.badge ?? "Local offer"}</strong><h3>{offer.productName || offer.title}</h3>{offer.description && <p>{offer.description}</p>}{offer.price !== undefined && <div className="shop-offer-pricing">{offer.originalPrice !== undefined && <del>{money(offer.originalPrice)}</del>}<b>{money(offer.price)}</b></div>}{offer.validUntil && <small className="shop-offer-validity"><Clock3 size={12} /> Valid until {new Date(offer.validUntil).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</small>}</div>
          <div aria-label={offer.image ? `${offer.productName || offer.title} offer` : undefined} aria-hidden={!offer.image} className={`shop-offer-image${offer.image ? "" : " is-placeholder"}`} role={offer.image ? "img" : undefined} style={offer.image ? { backgroundImage: `url("${offer.image.replace(/"/g, "\\\"")}")` } : undefined} />
          {isEnded && <span aria-label="Offer ended" className="shop-offer-ended-watermark">Offer ended</span>}
        </article>;
      })}</div>}</section>}
      {activeSection === "menu" && <MenuOrderExperience authenticated={authenticated} existingOrder={orderToUpdate} onClose={() => { setOrderToUpdate(undefined); setActiveSection("posts"); }} products={profile.products} shop={profile.shop} />}
      {activeSection === "orders" && <section className="shop-orders" aria-label="Shop order bills">{orders.length === 0 ? <EmptyState description="Orders from this shop will appear here." title="No orders yet" /> : <div className="shop-order-list">{orderedOrders.map((order) => {
        const canUpdate = !isPaidOrder(order.status) && !["cancelled", "rejected", "ready"].includes(order.status);
        const subtotal = order.products.reduce((sum, product) => sum + product.total, 0);
        return <article className="shop-order-card shop-order-bill" key={order.billId}>
          <div className="shop-order-card-top"><strong>Order #{order.billId}</strong><span className={`shop-order-status is-${order.status}`}>{order.status}</span></div>
          <div aria-label="Bill items" className="shop-order-items">{order.products.map((product, index) => <div className="shop-order-line" key={`${order.billId}-${product.itemId ?? index}`}><span><strong>{product.itemName ?? `Item ${product.itemId ?? "purchase"}`}</strong><small>{product.quantity} × {money(product.price)}</small></span><b>{money(product.total)}</b></div>)}</div>
          <div className="shop-order-bill-date">{order.date ? new Date(order.date).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "Date unavailable"}</div>
          <div className="shop-order-subtotal"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>
          <div className="shop-order-total"><span>Total</span><strong>{money(order.total)}</strong></div>
          <button className="shop-order-add" disabled={!canUpdate} onClick={() => { if (!authenticated) { requireLogin(); return; } setOrderToUpdate(order); setActiveSection("menu"); }} type="button">Add More Items</button>
        </article>;
      })}</div>}</section>}
    </main>
  );
}
