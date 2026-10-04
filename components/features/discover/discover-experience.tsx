"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
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
  ShoppingBag,
  Sparkles,
  Store,
  UserRound,
  X,
} from "lucide-react";
import { BUSINESS_CATEGORIES, BUSINESS_CATEGORY_LABELS, type DiscoveryData, type FeedPost, type Purchase, type Shop } from "@/types/commerce";
import PostCard from "@/components/features/discover/post-card";
import SessionControl from "@/components/features/auth/session-control";
import { BottomNavigation } from "@/components/ui/bottom-navigation";
import { EmptyState } from "@/components/ui/states";
import { useRouter } from "next/navigation";
import { publishFollowChange } from "@/lib/follow-sync";

type DiscoverExperienceProps = {
  data: DiscoveryData;
};

const categoryFilters = ["For you", ...BUSINESS_CATEGORIES.map((category) => BUSINESS_CATEGORY_LABELS[category])];
const mediaFilters = ["All", "Reels", "Posts", "Offers"] as const;
type MediaFilter = (typeof mediaFilters)[number];

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

export default function DiscoverExperience({ data }: DiscoverExperienceProps) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState("For you");
  const [activeMediaFilter, setActiveMediaFilter] = useState<MediaFilter>("All");
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
      const matchesCategory = activeCategory === "For you" || BUSINESS_CATEGORY_LABELS[shop.category] === activeCategory;
      return matchesCategory;
    });
    return showAllShops ? matchingShops : matchingShops.slice(0, 3);
  }, [activeCategory, data.shops, showAllShops]);

  const followedStories = useMemo(() => data.stories
    .filter((story) => following.includes(story.shopId))
    .map((story) => ({ ...story, shop: data.shops.find((shop) => shop.id === story.shopId) }))
    .filter((story): story is typeof story & { shop: Shop } => Boolean(story.shop)), [data.shops, data.stories, following]);

  const filteredPosts = useMemo(() => {
    return data.posts.filter((post) => {
      const shop = shopForPost(post, data.shops);
      const matchesCategory =
        activeCategory === "For you" ||
        BUSINESS_CATEGORY_LABELS[shop.category] === activeCategory;
      const matchesMedia =
        activeMediaFilter === "All" ||
        activeMediaFilter === "Offers" && post.kind === "offer" ||
        activeMediaFilter === "Reels" && (post.mediaType === "video" || post.kind === "reel") ||
        activeMediaFilter === "Posts" && post.mediaType === "image";
      const matchesFollowing = activeTab !== "Following" || following.includes(shop.id);
      return matchesCategory && matchesMedia && matchesFollowing;
    });
  }, [activeCategory, activeMediaFilter, activeTab, data.posts, data.shops, following]);

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
          <span className="brand-mark">z</span>
          <span className="brand-name">ziddu<span>.</span></span>
        </a>
        <button className="location-control" type="button">
          <span className="location-pin"><MapPin size={16} strokeWidth={2.3} /></span>
          <span className="location-copy"><small>YOUR NEIGHBORHOOD</small><strong>Anna Nagar, Chennai</strong></span>
          <ChevronDown size={15} />
        </button>
        <nav aria-label="Desktop navigation" className="desktop-nav">
          <Link href="/search">Search</Link>
          <Link href="/reels">Reels</Link>
          <Link href="/saved">Saved</Link>
          <Link className="desktop-nav-ai" href="/ai"><Sparkles size={13} /> AI</Link>
        </nav>
        <div className="top-actions">
          <Link aria-label="Order history" className="icon-button cart-button" href="/orders">
            <ShoppingBag size={19} />
            {Object.values(cart).reduce((total, count) => total + count, 0) > 0 && <span className="cart-count">{Object.values(cart).reduce((total, count) => total + count, 0)}</span>}
          </Link>
          <SessionControl />
        </div>
      </header>

      <div className="page-frame" id="top">
        <aside className="left-rail">
          <nav className="primary-nav" aria-label="Primary navigation">
            {[
              { label: "For you", icon: Home },
              { label: "Explore", icon: Compass, route: "/search" },
              { label: "Reels", icon: Clapperboard, route: "/reels" },
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
          <div className="neighborhood-row"><span className="neighborhood-dot" /> Anna Nagar <span className="neighborhood-distance">1.2 km</span></div>
          <button className="subtle-link" type="button"><MapPin size={14} /> Use my location</button>

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


            <section className="stories-section" aria-label="Recent Reels from followed shops">
              <div className="shop-story-row">
                {followedStories.map(({ shop, postId }, index) => (
                  <button className="shop-story" key={shop.id} onClick={() => router.push(`/reels?post=${encodeURIComponent(postId)}`)} type="button">
                    <span className={`story-ring ${index === 0 ? "story-ring-hot" : ""}`}><span className="story-image" style={{ backgroundImage: `url("${shop.image}")` }} /></span>
                    <span className="story-name">{shop.name}</span>
                  </button>
                ))}
              </div>
            </section>

            <section className="feed-section">

              <div aria-label="Filter by post type" className="media-filter-tabs" role="tablist">
                {mediaFilters.map((filter) => <button aria-selected={activeMediaFilter === filter} className={`media-filter-tab ${activeMediaFilter === filter ? "selected" : ""}`} key={filter} onClick={() => setActiveMediaFilter(filter)} role="tab" type="button">{filter}</button>)}
              </div>
              <div className="category-tabs" role="tablist" aria-label="Filter discoveries">
                {categoryFilters.map((category) => <button aria-selected={activeCategory === category} className={`category-tab ${activeCategory === category ? "selected" : ""}`} key={category} onClick={() => setActiveCategory(category)} role="tab" type="button">{category}</button>)}
              </div>

              {interactionError && <p aria-live="polite" className="share-feedback" role="alert">{interactionError}</p>}
              <div aria-label="Posts from nearby businesses" className="post-list">
                {filteredPosts.length === 0 && <EmptyState description="New local businesses and offers will appear here." title="Nothing nearby yet" />}
                {filteredPosts.map((post) => {
                  const shop = shopForPost(post, data.shops);
                  return (
                    <PostCard
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
              <button className="load-more" type="button" onClick={() => setActiveCategory("For you")}>You&apos;re all caught up <span>✳</span></button>
            </section>
          </>}
        </main>

        <aside className="right-rail">
          <section className="neighborhood-card">
            <div className="neighborhood-map"><span className="map-street street-a">ANNA NAGAR</span><span className="map-street street-b">2ND AVENUE</span><span className="map-street street-c">SHANTI COLONY</span><span className="map-dash dash-a" /><span className="map-dash dash-b" /><span className="map-dash dash-c" /><span className="map-pin pin-a"><Store size={13} /></span><span className="map-pin pin-b"><Store size={13} /></span><span className="map-pin pin-c"><Store size={13} /></span><span className="map-you"><span /></span><span className="map-radius" /></div>
            <div className="map-caption"><div><span className="section-kicker">YOUR LITTLE CORNER</span><strong>Anna Nagar, Chennai</strong><span>32 good spots within 1 km</span></div><button aria-label="Explore map" type="button"><ArrowUpRight size={16} /></button></div>
          </section>

          <section className="rail-section popular-section">
            <div className="rail-section-heading"><div><span className="section-kicker">NEIGHBORS LOVE THESE</span><h3>Worth a little walk</h3></div><button aria-label="More popular shops" type="button"><ArrowUpRight size={15} /></button></div>
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

      <BottomNavigation items={[
        { label: "Home", icon: Home, active: activeTab === "For you", onClick: () => setActiveTab("For you") },
        { label: "Discover", icon: Compass, active: activeTab === "Explore", onClick: () => router.push("/search") },
        { label: "Reels", icon: Clapperboard, active: activeMediaFilter === "Reels", onClick: () => router.push("/reels") },
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

    </div>
  );
}