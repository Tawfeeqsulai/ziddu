"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
  Bookmark,
  Check,
  ChevronDown,
  Clock3,
  Compass,
  CreditCard,
  Clapperboard,
  Gift,
  Heart,
  Home,
  MapPin,
  Plus,
  QrCode,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  UserRound,
  X,
} from "lucide-react";
import { BUSINESS_CATEGORY_LABELS, type DiscoveryData, type FeedPost, type Purchase, type Shop } from "@/types/commerce";
import PostCard from "@/components/features/discover/post-card";
import SessionControl from "@/components/features/auth/session-control";
import { BottomNavigation } from "@/components/ui/bottom-navigation";
import { BrandLogo } from "@/components/ui/brand-logo";
import { EmptyState } from "@/components/ui/states";
import { useRouter } from "next/navigation";
import { publishFollowChange } from "@/lib/follow-sync";
import { UpiQrScanner } from "@/components/features/payment/upi-qr-scanner";
import { getCurrentLocation } from "@/lib/current-location";
import { formatDistanceKm, haversineDistanceKm } from "@/lib/location";

type DiscoverExperienceProps = {
  data: DiscoveryData;
  initialLocation?: { city: string | null; locality: string | null; latitude: number | null; longitude: number | null };
};
type ActiveLocation = { city: string | null; locality: string | null; latitude?: number | null; longitude?: number | null; address?: string };
type PlaceResult = { address?: string; locality?: string; city?: string; state?: string; latitude?: number; longitude?: number };

const categoryFilters = ["All", "Food", "Furniture", "Electronics", "Cloths"] as const;
type CategoryFilter = (typeof categoryFilters)[number];

function categoryMatches(filter: CategoryFilter, category: keyof typeof BUSINESS_CATEGORY_LABELS) {
  if (filter === "All") return true;
  if (filter === "Food") return category === "RESTAURANT";
  if (filter === "Furniture") return category === "FURNITURE";
  if (filter === "Electronics") return category === "ELECTRONICS";
  if (filter === "Cloths") return category === "CLOTHS";
  return false;
}

function postMatchesCategory(filter: CategoryFilter, post: FeedPost, category: Shop["category"]) {
  if (filter === "All") return true;
  const content = [post.title, post.description, ...post.hashtags].join(" ").toLowerCase();
  const terms: Record<Exclude<CategoryFilter, "All">, string[]> = {
    Food: ["food", "restaurant", "cafe", "café", "meal", "dish", "bakery", "biryani"],
    Furniture: ["furniture", "sofa", "chair", "table", "bed", "cabinet", "interior"],
    Electronics: ["electronics", "electronic", "laptop", "phone", "mobile", "computer", "tv", "gadget"],
    Cloths: ["cloth", "clothes", "clothing", "fashion", "apparel", "textile", "dress", "shirt", "saree"],
  };
  const categories = Object.keys(terms) as Exclude<CategoryFilter, "All">[];
  const postCategory = categories.find((candidate) => terms[candidate].some((term) => post.hashtags.join(" ").toLowerCase().includes(term)))
    ?? categories.find((candidate) => terms[candidate].some((term) => content.includes(term)));
  return postCategory ? postCategory === filter : categoryMatches(filter, category);
}

function formatPrice(price: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(price);
}

function shopForPost(post: FeedPost, shops: Shop[]) {
  return shops.find((shop) => shop.id === post.shopId)!;
}

export default function DiscoverExperience({ data, initialLocation }: DiscoverExperienceProps) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("All");
  const [activeTab, setActiveTab] = useState("For you");
  const [following, setFollowing] = useState<string[]>(() => data.shops.filter((shop) => shop.followed).map((shop) => shop.id));
  const [purchases, setPurchases] = useState(data.purchases);
  const [likedPosts, setLikedPosts] = useState<string[]>(() => data.posts.filter((post) => post.liked).map((post) => post.id));
  const [savedPosts, setSavedPosts] = useState<string[]>(() => data.posts.filter((post) => post.saved).map((post) => post.id));
  const [cart, setCart] = useState<Record<string, number>>({});
  const [checkoutPost, setCheckoutPost] = useState<FeedPost | null>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [showAllShops, setShowAllShops] = useState(false);
  const [interactionError, setInteractionError] = useState("");
  const [showUpiScanner, setShowUpiScanner] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<ActiveLocation | undefined>(initialLocation);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [locationRadius, setLocationRadius] = useState(10);
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [placeSearchBusy, setPlaceSearchBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState("");

  useEffect(() => {
    try {
      const radius = Number(window.localStorage.getItem("ziddu:location-radius"));
      if (Number.isFinite(radius) && radius >= 1) setLocationRadius(Math.min(100, radius));
    } catch {
      // Keep the default radius when storage is unavailable.
    }
  }, []);

  async function saveLocation(location: ActiveLocation) {
    setLocationBusy(true);
    setLocationError("");
    try {
      const response = await fetch("/api/location/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...location, locality: location.locality ?? undefined, city: location.city ?? undefined }),
      });
      const result = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message ?? "This location could not be saved.");
      setCurrentLocation(location);
      setLocationPickerOpen(false);
      router.refresh();
    } catch (cause) {
      setLocationError(cause instanceof Error ? cause.message : "This location could not be saved.");
    } finally { setLocationBusy(false); }
  }

  async function updateCurrentLocation() {
    try {
      const location = await getCurrentLocation();
      await saveLocation({ ...location, city: location.city ?? null, locality: location.locality ?? null });
    } catch (cause) {
      setLocationError(cause instanceof Error ? cause.message : "We couldn't determine your location. Try again or enter your area manually.");
    }
  }

  const locationLabel = [currentLocation?.locality, currentLocation?.city].filter(Boolean).join(", ") || "Set your location";
  const locationChoices = useMemo(() => Array.from(new Map(data.shops
    .filter((shop) => (shop.area || shop.city) && !/latitude|longitude/i.test(`${shop.area} ${shop.city}`))
    .map((shop) => [`${shop.area}|${shop.city}`, shop])).values())
    .filter((shop) => `${shop.area} ${shop.city}`.toLowerCase().includes(locationQuery.trim().toLowerCase())), [data.shops, locationQuery]);

  useEffect(() => {
    const query = locationQuery.trim();
    if (!locationPickerOpen || query.length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPlaceSearchBusy(true);
      try {
        const response = await fetch(`/api/location/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const result = await response.json() as { locations?: PlaceResult[] };
        setPlaceResults(Array.isArray(result.locations) ? result.locations : []);
      } catch { if (!controller.signal.aborted) setPlaceResults([]); }
      finally { if (!controller.signal.aborted) setPlaceSearchBusy(false); }
    }, 350);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [locationPickerOpen, locationQuery]);

  useEffect(() => {
    const apply = (change: { shopId: string; active: boolean }) => {
      setFollowing((current) => change.active
        ? current.includes(change.shopId) ? current : [...current, change.shopId]
        : current.filter((id) => id !== change.shopId));
    };
    const handleEvent = (event: Event) => apply((event as CustomEvent<{ shopId: string; active: boolean }>).detail);
    window.addEventListener("ziddu:follow-change", handleEvent);
    if (!("BroadcastChannel" in window)) return () => window.removeEventListener("ziddu:follow-change", handleEvent);
    const channel = new BroadcastChannel("ziddu-follow-state");
    channel.addEventListener("message", (event: MessageEvent<{ shopId: string; active: boolean }>) => apply(event.data));
    return () => {
      window.removeEventListener("ziddu:follow-change", handleEvent);
      channel.close();
    };
  }, []);

  const filteredShops = useMemo(() => {
    const matchingShops = data.shops.filter((shop) => {
      const matchesCategory = categoryMatches(activeCategory, shop.category);
      const distance = haversineDistanceKm(currentLocation ?? {}, shop);
      return matchesCategory && (distance == null || distance <= locationRadius);
    }).sort((a, b) => (haversineDistanceKm(currentLocation ?? {}, a) ?? Infinity) - (haversineDistanceKm(currentLocation ?? {}, b) ?? Infinity));
    return showAllShops ? matchingShops : matchingShops.slice(0, 3);
  }, [activeCategory, currentLocation, data.shops, locationRadius, showAllShops]);

  const filteredPosts = useMemo(() => {
    const filtered = data.posts.filter((post) => {
      const shop = shopForPost(post, data.shops);
      const matchesCategory = postMatchesCategory(activeCategory, post, shop.category);
      const matchesFollowing = activeTab !== "Following" || following.includes(shop.id);
      const distance = haversineDistanceKm(currentLocation ?? {}, shop);
      return matchesCategory && matchesFollowing && (distance == null || distance <= locationRadius);
    });
    return filtered.sort((a, b) => {
      const shopA = data.shops.find((shop) => shop.id === a.shopId);
      const shopB = data.shops.find((shop) => shop.id === b.shopId);
      return (haversineDistanceKm(currentLocation ?? {}, shopA ?? {}) ?? Infinity) - (haversineDistanceKm(currentLocation ?? {}, shopB ?? {}) ?? Infinity);
    });
  }, [activeCategory, activeTab, currentLocation, data.posts, data.shops, following, locationRadius]);

  async function toggleInteraction(action: "like" | "save" | "follow", id: string) {
    setInteractionError("");
    const update = action === "like" ? setLikedPosts : action === "save" ? setSavedPosts : setFollowing;
    const wasActive = (action === "like" ? likedPosts : action === "save" ? savedPosts : following).includes(id);
    update((current) => wasActive ? current.filter((item) => item !== id) : [...current, id]);
    const payload = action === "follow" ? { action, shopId: id } : { action, postId: id };
    try {
      const response = await fetch("/api/feed/interactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, active: !wasActive }) });
      if (response.status === 401) { router.push("/login"); throw new Error("Sign in required"); }
      if (!response.ok) throw new Error("Interaction unavailable");
      window.dispatchEvent(new Event("ziddu:feed-mutation"));
      if (action === "follow") {
        const result = await response.json() as { active?: boolean; followerCount?: number };
        if (typeof result.active === "boolean" && typeof result.followerCount === "number") {
          publishFollowChange({ shopId: id, active: result.active, followerCount: result.followerCount });
        }
      }
    } catch {
      update((current) => wasActive ? [...current.filter((item) => item !== id), id] : current.filter((item) => item !== id));
      setInteractionError("That action could not be saved. Please try again.");
    }
  }

  function updateCart(postId: string, change: number) {
    setCart((current) => {
      const nextCount = Math.max(0, (current[postId] ?? 0) + change);
      return { ...current, [postId]: nextCount };
    });
  }

  async function completePayment() {
    if (!checkoutPost) return;
    const response = await fetch("/api/orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postId: checkoutPost.id, quantity: 1, paymentMethod: "SIMULATED_CARD" }) });
    if (!response.ok) return;
    setPaymentComplete(true);
    const shop = shopForPost(checkoutPost, data.shops);
    const purchase: Purchase = { id: `order-${Date.now()}`, shopId: shop.id, item: `${checkoutPost.title} · 1 item`, date: "Today, just now", total: checkoutPost.price!, status: "Paid" };
    setPurchases((current) => [purchase, ...current]);
    updateCart(checkoutPost.id, 1);
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand-lockup" href="#top" aria-label="ZIDDU home">
          <BrandLogo alt="" />
        </a>
        <button aria-label="Choose your location" className="location-control" disabled={locationBusy} onClick={() => setLocationPickerOpen(true)} type="button">
          <span className="location-pin"><MapPin size={16} strokeWidth={2.3} /></span>
          <span className="location-copy"><strong>{locationLabel}</strong>{locationError && <span aria-live="polite" className="location-status" role="alert" title={locationError}>{locationError}</span>}</span>
          <ChevronDown size={15} />
        </button>
        <nav aria-label="Desktop navigation" className="desktop-nav">
          <Link href="/search">Search</Link>
          <Link href="/reels">Videos</Link>
          <Link href="/saved">Saved</Link>
          <Link className="desktop-nav-ai" href="/ai"><Sparkles size={13} /> AI</Link>
        </nav>
        <div className="top-actions home-desktop-actions">
          <button aria-label="Scan UPI payment QR" className="icon-button upi-scan-trigger" onClick={() => setShowUpiScanner(true)} title="Scan UPI payment QR" type="button">
            <QrCode size={19} />
          </button>
          <Link aria-label="Order history" className="icon-button cart-button" href="/orders">
            <ShoppingBag size={19} />
            {Object.values(cart).reduce((total, count) => total + count, 0) > 0 && <span className="cart-count">{Object.values(cart).reduce((total, count) => total + count, 0)}</span>}
          </Link>
          <SessionControl />
        </div>
        <div className="home-mobile-actions">
          {/* <button aria-label="Notifications" className="home-mobile-icon" type="button"><Bell size={17} /></button> */}
          <SessionControl iconButton />
        </div>
      </header>

      <div className="page-frame" id="top">
        <aside className="left-rail">
          <nav className="primary-nav" aria-label="Primary navigation">
            {[
              { label: "For you", icon: Home },
              { label: "Explore", icon: Compass, route: "/search" },
              { label: "Videos", icon: Clapperboard, route: "/reels" },
              { label: "Saved", icon: Bookmark, route: "/saved" },
              { label: "ZIDDU AI", icon: Sparkles, route: "/ai" },
              { label: "Profile", icon: UserRound, route: "/profile" },
              { label: "Affiliate program", icon: Gift, route: "/affiliate" },
              { label: "Following", icon: Heart },
              { label: "Your orders", icon: ShoppingBag },
            ].map(({ label, icon: Icon, route }) => (
              <button className={`nav-item ${activeTab === label ? "is-active" : ""}`} key={label} onClick={() => route ? router.push(route) : setActiveTab(label)} type="button">
                <Icon size={18} strokeWidth={activeTab === label ? 2.2 : 1.8} />
                <span>{label}</span>
                {label === "Your orders" && <span className="nav-order-dot" />}
              </button>
            ))}
          </nav>

          <div className="rail-rule" />
          <div className="rail-heading"><span>NEAR YOU</span><button aria-label="Add a neighborhood" type="button"><Plus size={15} /></button></div>
          <div className="neighborhood-row"><span className="neighborhood-dot" /> {locationLabel}</div>
          <button className="subtle-link" disabled={locationBusy} onClick={() => { void updateCurrentLocation(); }} type="button"><MapPin size={14} /> {locationBusy ? "Finding your location..." : "Use my location"}</button>
          {locationError && <p className="rail-empty" role="alert">{locationError}</p>}

          <div className="rail-rule rail-lower" />
          <div className="small-promo">
            <div className="promo-icon"><Store size={17} /></div>
            <strong>Your shop belongs here.</strong>
            <p>Meet the people around your corner.</p>
            <button type="button">List your business <ArrowUpRight size={13} /></button>
            <span className="promo-spark"><Sparkles size={17} /></span>
          </div>
          <div className="rail-footer">Made for the block <span>·</span> About <span>·</span> Help</div>
        </aside>

        <main className="main-feed">
          {activeTab === "Your orders" ? <section className="purchase-history">
            <span className="section-kicker">GOOD THINGS, KEPT CLOSE</span>
            <h1>Your neighborhood receipts.</h1>
            <p className="history-intro">Every little win from the shops around your corner.</p>
            <div className="history-list">{purchases.map((purchase) => {
              const shop = data.shops.find((item) => item.id === purchase.shopId)!;
              return <article className="history-item" key={purchase.id}>
                <span className="history-shop-avatar">{shop.initials}</span>
                <div className="history-item-main"><strong>{shop.name}</strong><span>{purchase.item}</span><small><Clock3 size={12} /> {purchase.date}</small></div>
                <div className="history-item-total"><strong>{formatPrice(purchase.total)}</strong><span className={purchase.status === "Paid" ? "history-paid" : ""}>{purchase.status}</span></div>
              </article>;
            })}</div>
            <button className="history-back" onClick={() => setActiveTab("For you")} type="button"><ArrowUpRight size={14} /> Back to nearby finds</button>
          </section> : <>


            <section className="feed-section">

              <div className="category-tabs" role="tablist" aria-label="Filter discoveries">
                {categoryFilters.map((category) => <button aria-selected={activeCategory === category} className={`category-tab ${activeCategory === category ? "selected" : ""}`} key={category} onClick={() => setActiveCategory(category)} role="tab" type="button">{category}</button>)}
              </div>

              {interactionError && <p aria-live="polite" className="share-feedback" role="alert">{interactionError}</p>}
              <div aria-label="Posts from nearby businesses" className="post-list">
                {filteredPosts.length === 0 && <EmptyState description="New local businesses and offers will appear here." title="Nothing nearby yet" />}
                {filteredPosts.map((post) => {
                  const shop = shopForPost(post, data.shops);
                  const distance = formatDistanceKm(haversineDistanceKm(currentLocation ?? {}, shop));
                  return (
                    <PostCard
                      distanceLabel={distance ? `${distance} away` : undefined}
                      followed={following.includes(shop.id)}
                      key={post.id}
                      liked={likedPosts.includes(post.id)}
                      onCheckout={() => { setCheckoutPost(post); setPaymentComplete(false); }}
                      onFollow={() => { void toggleInteraction("follow", shop.id); }}
                      onLike={() => { void toggleInteraction("like", post.id); }}
                      onOpenShop={() => router.push(`/shops/${shop.id}`)}
                      onSave={() => { void toggleInteraction("save", post.id); }}
                      post={post}
                      saved={savedPosts.includes(post.id)}
                      shop={shop}
                    />
                  );
                })}
              </div>
              <button className="load-more" type="button" onClick={() => setActiveCategory("All")}>You&apos;re all caught up <span>✳</span></button>
            </section>
          </>}
        </main>

        <aside className="right-rail">
          <section className="neighborhood-card">
            <div className="neighborhood-map"><span className="map-street street-a">{(currentLocation?.locality || "YOUR AREA").toUpperCase()}</span><span className="map-street street-b">{(currentLocation?.city || "LOCAL SHOPS").toUpperCase()}</span><span className="map-street street-c">NEARBY PLACES</span><span className="map-dash dash-a" /><span className="map-dash dash-b" /><span className="map-dash dash-c" /><span className="map-pin pin-a"><Store size={13} /></span><span className="map-pin pin-b"><Store size={13} /></span><span className="map-pin pin-c"><Store size={13} /></span><span className="map-you"><span /></span><span className="map-radius" /></div>
            <div className="map-caption"><div><span className="section-kicker">YOUR LITTLE CORNER</span><strong>{locationLabel}</strong><span>{data.shops.length} local {data.shops.length === 1 ? "spot" : "spots"}</span></div><button aria-label="Explore map" type="button"><ArrowUpRight size={16} /></button></div>
          </section>

          <section className="rail-section popular-section">
            <div className="rail-section-heading"><div><span className="section-kicker">NEIGHBORS LOVE THESE</span><h3>Worth a little walk</h3></div><button aria-label="More popular shops" onClick={() => setShowAllShops(true)} type="button"><ArrowUpRight size={15} /></button></div>
            <div className="popular-list">{filteredShops.map((shop, index) => <div className="popular-shop" key={shop.id}><span className="popular-number">0{index + 1}</span><span className="popular-avatar" style={{ backgroundImage: `url("${shop.image}")` }} /><div className="popular-info"><strong>{shop.name}</strong><span>{BUSINESS_CATEGORY_LABELS[shop.category]}</span></div><span className="popular-rating">★ {shop.rating}</span></div>)}</div>
            {filteredShops.length === 0 && <p className="rail-empty">No shops match that yet.</p>}
          </section>

          <section className="order-peek">
            <div className="order-peek-heading"><span className="order-icon"><ShoppingBag size={17} /></span><div><span className="section-kicker">YOUR LITTLE WIN</span><strong>One thing on its way</strong></div><ArrowUpRight size={14} /></div>
            {purchases.map((purchase) => { const shop = data.shops.find((item) => item.id === purchase.shopId)!; return <div className="order-peek-body" key={purchase.id}><div className="order-shop"><span className="order-shop-avatar">{shop.initials}</span><div><strong>{shop.name}</strong><span>{purchase.item}</span></div></div><div className="pickup-status"><span className="pickup-dot" /> {purchase.status}<ArrowUpRight size={13} /></div><div className="order-meta"><span><Clock3 size={13} /> {purchase.date}</span><strong>{formatPrice(purchase.total)}</strong></div></div>; })}
          </section>

          <div className="closing-note"><span>✳</span> SHOP SMALL. FEEL BIG. <span>✳</span></div>
          <div className="rail-legal">Terms <span>·</span> Privacy <span>·</span> © ZIDDU 2026</div>
        </aside>
      </div>

      <BottomNavigation showProfile items={[
        { label: "Home", icon: Home, active: activeTab === "For you", onClick: () => setActiveTab("For you") },
        { label: "Explore", icon: Compass, active: activeTab === "Explore", onClick: () => router.push("/search") },
        { label: "Saved", icon: Bookmark, onClick: () => router.push("/saved") },
        { label: "Profile", icon: UserRound, onClick: () => router.push("/profile") },
      ]} />

      {checkoutPost && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCheckoutPost(null); }}>
        <section aria-labelledby="checkout-title" aria-modal="true" className="checkout-sheet" role="dialog">
          <button aria-label="Close checkout" className="close-modal" onClick={() => setCheckoutPost(null)} type="button"><X size={18} /></button>
          {paymentComplete ? <div className="payment-success"><span className="success-mark"><Check size={28} /></span><span className="section-kicker">THAT WAS EASY</span><h2>Good choice.<br /><em>Very good choice.</em></h2><p>Your payment was simulated successfully. {shopForPost(checkoutPost, data.shops).name} is ready for you nearby.</p><button className="confirm-button" onClick={() => setCheckoutPost(null)} type="button">Back to the good stuff <ArrowUpRight size={16} /></button></div> : <>
            <span className="section-kicker">A LITTLE TREAT, CLOSE BY</span><h2 id="checkout-title">You found a good one.</h2>
            <div className="checkout-item"><span className="checkout-thumb" style={{ backgroundImage: `url("${checkoutPost.image}")` }} /><div><strong>{checkoutPost.title}</strong><span>{shopForPost(checkoutPost, data.shops).name} · pickup nearby</span></div><strong>{formatPrice(checkoutPost.price!)}</strong></div>
            <div className="checkout-total"><span>Total</span><strong>{formatPrice(checkoutPost.price!)}</strong></div>
            <div className="payment-method"><CreditCard size={17} /><span>Demo payment</span><span>•••• 4242</span><Check size={15} /></div>
            <p className="checkout-note">This is a development checkout. No real payment will be processed.</p>
            <button className="confirm-button" onClick={completePayment} type="button">Pay {formatPrice(checkoutPost.price!)} <ArrowUpRight size={16} /></button>
          </>}
        </section>
      </div>}
      {showUpiScanner && <UpiQrScanner onClose={() => setShowUpiScanner(false)} />}
      {locationPickerOpen && <div className="modal-backdrop location-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setLocationPickerOpen(false); }}>
        <section aria-labelledby="location-picker-title" aria-modal="true" className="location-picker" role="dialog">
          <button aria-label="Close location picker" className="close-modal" onClick={() => setLocationPickerOpen(false)} type="button"><X size={18} /></button>
          <span className="section-kicker">DISCOVER NEARBY</span><h2 id="location-picker-title">Choose your location</h2>
          <label className="location-search"><Search aria-hidden="true" size={16} /><input aria-label="Search locations" onChange={(event) => { setLocationQuery(event.target.value); if (event.target.value.trim().length < 2) setPlaceResults([]); }} placeholder="Search any area or city" value={locationQuery} /></label>
          <button className="location-option" disabled={locationBusy} onClick={() => { void updateCurrentLocation(); }} type="button"><MapPin size={17} /><span><strong>Use my current location</strong><small>Find shops around you</small></span></button>
          <div className="location-radius-picker"><label htmlFor="location-radius">Nearby radius <strong>{locationRadius} km</strong></label><input aria-label="Nearby radius in kilometers" id="location-radius" max="100" min="1" onChange={(event) => { const radius = Number(event.target.value); setLocationRadius(radius); window.localStorage.setItem("ziddu:location-radius", String(radius)); }} type="range" value={locationRadius} /></div>
          <div className="location-option-list">
            {placeResults.map((place, index) => <button className="location-option" key={`${place.latitude}:${place.longitude}:${index}`} onClick={() => { void saveLocation({ locality: place.locality || null, city: place.city || null, latitude: place.latitude, longitude: place.longitude, address: place.address }); }} type="button"><MapPin size={17} /><span><strong>{place.locality || place.address?.split(",")[0] || place.city || "Selected location"}</strong><small>{[place.locality && place.city && place.locality !== place.city ? place.locality : null, place.city, place.state].filter(Boolean).join(", ") || place.address}</small></span></button>)}
            {locationChoices.map((shop) => <button className="location-option" key={`${shop.area}|${shop.city}`} onClick={() => { void saveLocation({ locality: shop.area || null, city: shop.city || null, latitude: shop.latitude, longitude: shop.longitude, address: shop.address }); }} type="button"><MapPin size={17} /><span><strong>{shop.area || shop.city}</strong><small>{[shop.area && shop.city && shop.area !== shop.city ? shop.area : null, shop.city].filter(Boolean).join(", ")}</small></span></button>)}
            {placeSearchBusy && <p className="location-search-empty">Searching locations…</p>}
            {!placeSearchBusy && locationQuery.trim().length >= 2 && placeResults.length === 0 && locationChoices.length === 0 && <p className="location-search-empty">No locations found. Try another area or city.</p>}
          </div>
          {locationError && <p className="location-picker-error" role="alert">{locationError}</p>}
        </section>
      </div>}
    </div>
  );
}
