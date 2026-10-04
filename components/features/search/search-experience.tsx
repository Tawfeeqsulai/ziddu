"use client";

import { ArrowLeft, ChevronDown, Clapperboard, Home, MapPin, Search as SearchIcon, Tag, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import PostCard from "@/components/features/discover/post-card";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { BottomNavigation } from "@/components/ui/bottom-navigation";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { BUSINESS_CATEGORIES, BUSINESS_CATEGORY_LABELS, type BusinessCategory } from "@/types/commerce";
import type { SearchResults } from "@/services/search.service";

type SearchExperienceProps = { results: SearchResults; authenticated: boolean };
const categoryChoices = ["ALL", ...BUSINESS_CATEGORIES] as const;

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export default function SearchExperience({ results, authenticated }: SearchExperienceProps) {
  const router = useRouter();
  const [input, setInput] = useState(results.query);
  const [category, setCategory] = useState(results.category);
  const [distance, setDistance] = useState("0");
  const [liked, setLiked] = useState<string[]>(() => results.posts.filter((post) => post.liked).map((post) => post.id));
  const [saved, setSaved] = useState<string[]>(() => results.posts.filter((post) => post.saved).map((post) => post.id));
  const [followed, setFollowed] = useState<string[]>(() => results.shops.filter((shop) => shop.followed).map((shop) => shop.id));
  const [interactionError, setInteractionError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(window.location.search);
      const value = input.trim();
      if (value) params.set("q", value); else params.delete("q");
      if (category === "ALL") params.delete("category"); else params.set("category", category);
      if (distance === "0") params.delete("distance"); else params.set("distance", distance);
      router.replace(`/search?${params.toString()}`);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [category, distance, input, router]);

  const suggestions = useMemo(() => {
    const value = input.trim().toLowerCase();
    if (!value) return ["Restaurants", "Furniture", "Electronics", results.city || "Nearby shops"];
    return [...results.shops.slice(0, 3).map((shop) => shop.name), ...results.products.slice(0, 2).map((product) => product.name), ...BUSINESS_CATEGORIES.filter((item) => BUSINESS_CATEGORY_LABELS[item].toLowerCase().includes(value)).map((item) => BUSINESS_CATEGORY_LABELS[item])].slice(0, 5);
  }, [input, results.city, results.products, results.shops]);

  const visibleShops = category === "ALL" ? results.shops : results.shops.filter((shop) => shop.category === category);
  const visibleOffers = category === "ALL" ? results.offers : results.offers.filter((offer) => offer.shop.category === category);
  const visibleProducts = category === "ALL" ? results.products : results.products.filter((product) => product.shop.category === category);
  const visiblePosts = category === "ALL" ? results.posts : results.posts.filter((post) => {
    const shop = results.shops.find((item) => item.id === post.shopId);
    return shop?.category === category;
  });

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

  const hasResults = visibleShops.length + visiblePosts.length + visibleOffers.length + visibleProducts.length > 0;

  return (
    <main className="search-page">
      <header className="search-topbar"><BackButton className="search-back" label="Go back" /><div><span className="section-kicker">ZIDDU DISCOVER</span><h1>Find good things nearby.</h1></div></header>
      <section className="search-controls"><label className="search-input"><SearchIcon aria-hidden="true" size={18} /><input autoFocus aria-label="Search shops, posts, offers and products" onChange={(event) => setInput(event.target.value)} placeholder="Biryani, sofa, mobile, Anna Nagar..." value={input} /><kbd>⌘ K</kbd></label><div className="search-context"><MapPin size={14} /><span>{results.city ? `Near ${results.city}` : "Across India"}</span>{results.locality && <><i>·</i><span>{results.locality}</span></>}</div></section>
      <div className="search-suggestions" aria-label="Search suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => setInput(suggestion)} type="button">{suggestion}</button>)}</div>
      <div className="search-category-tabs" role="tablist" aria-label="Filter by category">{categoryChoices.map((value) => <button aria-selected={category === value} className={category === value ? "is-active" : ""} key={value} onClick={() => setCategory(value)} role="tab" type="button">{value === "ALL" ? "All" : BUSINESS_CATEGORY_LABELS[value as BusinessCategory]}<ChevronDown size={12} /></button>)}</div>
      <label className="distance-filter">Distance<select aria-label="Filter by distance" onChange={(event) => setDistance(event.target.value)} value={distance}><option value="0">Any distance</option>{[1, 2, 5, 10, 25, 50].map((value) => <option key={value} value={value}>Within {value} km</option>)}</select></label>
      {interactionError && <p aria-live="polite" className="share-feedback" role="alert">{interactionError}</p>}{results.failed ? <ErrorState description="Please try again in a moment." title="Couldn't complete the search" onAction={() => router.refresh()} /> : !hasResults ? <EmptyState description={results.query ? "Try a different shop, product, category or location." : "New local businesses and offers will appear here."} title={results.query ? "No results found" : "Nothing nearby yet"} /> : <div className="search-results">
        {visibleShops.length > 0 && <section className="search-section"><div className="search-section-heading"><div><span className="section-kicker">BUSINESSES</span><h2>Shops nearby</h2></div><span>{visibleShops.length}</span></div><div className="search-shop-list">{visibleShops.map((shop) => <Link className="search-shop-result" href={`/shops/${shop.id}`} key={shop.id}><Avatar alt={shop.name} image={shop.image} initials={shop.initials} size="md" /><span><strong>{shop.name}</strong><small>{BUSINESS_CATEGORY_LABELS[shop.category]} · {shop.area}, {shop.city}</small><em>{shop.description}</em></span><ArrowLeft aria-hidden="true" className="search-result-arrow" size={16} /></Link>)}</div></section>}
        {visibleOffers.length > 0 && <section className="search-section"><div className="search-section-heading"><div><span className="section-kicker">CURRENT OFFERS</span><h2>Good value, close by</h2></div><Tag size={17} /></div><div className="search-offer-list">{visibleOffers.map((offer) => <article className="search-offer-result" key={offer.id}><div><strong>{offer.badge ?? "Local offer"}</strong><span>{offer.title}</span><small>{offer.shop.name} · {offer.shop.area}, {offer.shop.city}</small></div>{offer.price !== undefined && <b>{money(offer.price)}</b>}</article>)}</div></section>}
        {visibleProducts.length > 0 && <section className="search-section"><div className="search-section-heading"><div><span className="section-kicker">PRODUCTS</span><h2>Things worth a look</h2></div></div><div className="search-product-list">{visibleProducts.map((product) => <article className="search-product-result" key={product.id}>{product.image ? <Image alt={product.name} height={48} src={product.image} unoptimized width={48} /> : <span className="search-product-fallback"><Tag size={18} /></span>}<div><strong>{product.name}</strong><small>{product.shop.name} · {BUSINESS_CATEGORY_LABELS[product.shop.category]}</small><span>{product.shop.area}, {product.shop.city}</span></div><b>{money(product.offer?.price ?? product.price)}</b></article>)}</div></section>}
        {visiblePosts.length > 0 && <section className="search-section"><div className="search-section-heading"><div><span className="section-kicker">POSTS</span><h2>From local businesses</h2></div><span>{visiblePosts.length}</span></div><div className="search-post-list">{visiblePosts.map((post) => { const shop = results.shops.find((item) => item.id === post.shopId) ?? results.offers.find((item) => item.shop.id === post.shopId)?.shop; if (!shop) return null; return <PostCard followed={followed.includes(shop.id)} key={post.id} liked={liked.includes(post.id)} onCheckout={() => undefined} onFollow={() => { void interact("follow", shop.id); }} onLike={() => { void interact("like", post.id); }} onOpenShop={() => router.push(`/shops/${shop.id}`)} onSave={() => { void interact("save", post.id); }} post={post} saved={saved.includes(post.id)} shop={shop} />; })}</div></section>}
      </div>}
      <BottomNavigation items={[{ label: "Home", icon: Home, onClick: () => router.push("/") }, { label: "Discover", icon: SearchIcon, active: true }, { label: "Reels", icon: Clapperboard, onClick: () => router.push("/reels") }, { label: "Profile", icon: UserRound, onClick: () => router.push("/profile") }]} />
    </main>
  );
}
