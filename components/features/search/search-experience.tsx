"use client";

import { Bell, ChevronDown, Home, MapPin, Search as SearchIcon, Star, Tag, UserRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import PostCard from "@/components/features/discover/post-card";
import { Avatar } from "@/components/ui/avatar";
import { BottomNavigation } from "@/components/ui/bottom-navigation";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { BUSINESS_CATEGORY_LABELS, type BusinessCategory } from "@/types/commerce";
import type { SearchResults } from "@/services/search.service";

type SearchExperienceProps = { results: SearchResults; authenticated: boolean };
const exploreFilters = ["Nearby", "Top Rated", "Offers", "New"] as const;

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export default function SearchExperience({ results, authenticated }: SearchExperienceProps) {
  const router = useRouter();
  const [input, setInput] = useState(results.query);
  const [category, setCategory] = useState<BusinessCategory | "ALL">(results.category);
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

  const visibleShops = category === "ALL" ? results.shops : results.shops.filter((shop) => shop.category === category);
  const visibleOffers = category === "ALL" ? results.offers : results.offers.filter((offer) => offer.shop.category === category);
  const visibleProducts = category === "ALL" ? results.products : results.products.filter((product) => product.shop.category === category);
  const visiblePosts = category === "ALL" ? results.posts : results.posts.filter((post) => results.shops.find((shop) => shop.id === post.shopId)?.category === category);
  const hasResults = visibleShops.length + visiblePosts.length + visibleOffers.length + visibleProducts.length > 0;

  async function interact(action: "like" | "save" | "follow", id: string) {
    if (!authenticated) { router.push("/login"); return; }
    setInteractionError("");
    const update = action === "like" ? setLiked : action === "save" ? setSaved : setFollowed;
    const active = (action === "like" ? liked : action === "save" ? saved : followed).includes(id);
    update((current) => active ? current.filter((item) => item !== id) : [...current, id]);
    const body = action === "follow" ? { action, shopId: id } : { action, postId: id };
    try {
      const response = await fetch("/api/feed/interactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, active: !active }) });
      if (!response.ok) throw new Error("Interaction unavailable");
    } catch {
      update((current) => active ? [...current.filter((item) => item !== id), id] : current.filter((item) => item !== id));
      setInteractionError("That action could not be saved. Please try again.");
    }
  }

  return (
    <main className="search-page explore-page">
      <header className="search-topbar explore-topbar">
        <div className="explore-title"><h1>Explore</h1><button className="explore-location" type="button"><MapPin size={11} /> {results.city || "Coimbatore"} <ChevronDown size={11} /></button></div>
        <div className="explore-header-actions"><button aria-label="Search" type="button"><SearchIcon size={16} /></button><button aria-label="Notifications" type="button"><Bell size={16} /></button></div>
      </header>
      <section className="search-controls explore-controls"><label className="search-input"><SearchIcon aria-hidden="true" size={16} /><input autoFocus aria-label="Search restaurants, cafes and stores" onChange={(event) => setInput(event.target.value)} placeholder="Search restaurants, cafes, stores..." value={input} /></label></section>
      <div className="explore-filter-tabs" role="tablist" aria-label="Explore filters">{exploreFilters.map((filter) => <button aria-selected={filter === "Nearby"} className={filter === "Nearby" ? "is-active" : ""} key={filter} onClick={() => { if (filter === "Nearby") setDistance("0"); if (filter === "Top Rated") setDistance("0"); }} role="tab" type="button">{filter}</button>)}</div>
      <div className="search-category-tabs explore-category-tabs" role="tablist" aria-label="Filter by category">{(["ALL", "RESTAURANT", "FURNITURE", "ELECTRONICS"] as const).map((value) => <button aria-selected={category === value} className={category === value ? "is-active" : ""} key={value} onClick={() => setCategory(value)} role="tab" type="button">{value === "ALL" ? "All" : BUSINESS_CATEGORY_LABELS[value]}</button>)}</div>
      <label className="distance-filter explore-distance">Distance<select aria-label="Filter by distance" onChange={(event) => setDistance(event.target.value)} value={distance}><option value="0">Any distance</option>{[1, 2, 5, 10, 25, 50].map((value) => <option key={value} value={value}>Within {value} km</option>)}</select></label>
      {interactionError && <p aria-live="polite" className="share-feedback" role="alert">{interactionError}</p>}
      {results.failed ? <ErrorState description="Please try again in a moment." title="Couldn't complete the search" onAction={() => router.refresh()} /> : !hasResults ? <EmptyState description={results.query ? "Try a different shop, product, category or location." : "New local businesses and offers will appear here."} title={results.query ? "No results found" : "Nothing nearby yet"} /> : <div className="search-results explore-results">
        {visibleShops.length > 0 && <section className="search-section explore-business-section"><div className="search-section-heading"><div><span className="section-kicker">EXPLORE BUSINESSES</span><h2>Nearby places</h2></div><span>{visibleShops.length}</span></div><div className="search-shop-list">{visibleShops.map((shop) => <Link className="search-shop-result explore-shop-result" href={`/shops/${shop.id}`} key={shop.id}><Avatar alt={shop.name} image={shop.image} initials={shop.initials} size="md" /><span><strong>{shop.name}</strong><small>{BUSINESS_CATEGORY_LABELS[shop.category]}{shop.area ? `, ${shop.area}` : ""}</small><em><Star fill="currentColor" size={10} /> {shop.rating.toFixed(1)} ({shop.followerCount}) <i /> {shop.distance}</em></span>{shop.category === "RESTAURANT" && <b className="explore-offer-badge">50% OFF</b>}</Link>)}</div></section>}
        {visibleOffers.length > 0 && <section className="search-section explore-secondary-section"><div className="search-section-heading"><div><span className="section-kicker">CURRENT OFFERS</span><h2>Good value, close by</h2></div></div><div className="search-offer-list">{visibleOffers.map((offer) => <article className="search-offer-result" key={offer.id}><div><strong>{offer.badge ?? "Local offer"}</strong><span>{offer.title}</span><small>{offer.shop.name} · {offer.shop.area}, {offer.shop.city}</small></div>{offer.price !== undefined && <b>{money(offer.price)}</b>}</article>)}</div></section>}
        {visibleProducts.length > 0 && <section className="search-section explore-secondary-section"><div className="search-section-heading"><div><span className="section-kicker">PRODUCTS</span><h2>Things worth a look</h2></div></div><div className="search-product-list">{visibleProducts.map((product) => <article className="search-product-result" key={product.id}>{product.image ? <Image alt={product.name} height={48} src={product.image} unoptimized width={48} /> : <span className="search-product-fallback"><Tag size={18} /></span>}<div><strong>{product.name}</strong><small>{product.shop.name} · {BUSINESS_CATEGORY_LABELS[product.shop.category]}</small><span>{product.shop.area}, {product.shop.city}</span></div><b>{money(product.offer?.price ?? product.price)}</b></article>)}</div></section>}
        {visiblePosts.length > 0 && <section className="search-section explore-secondary-section"><div className="search-section-heading"><div><span className="section-kicker">POSTS</span><h2>From local businesses</h2></div></div><div className="search-post-list">{visiblePosts.map((post) => { const shop = results.shops.find((item) => item.id === post.shopId); if (!shop) return null; return <PostCard followed={followed.includes(shop.id)} key={post.id} liked={liked.includes(post.id)} onCheckout={() => undefined} onFollow={() => { void interact("follow", shop.id); }} onLike={() => { void interact("like", post.id); }} onOpenShop={() => router.push(`/shops/${shop.id}`)} onSave={() => { void interact("save", post.id); }} post={post} saved={saved.includes(post.id)} shop={shop} />; })}</div></section>}
      </div>}
      <BottomNavigation showProfile items={[{ label: "Home", icon: Home, onClick: () => router.push("/") }, { label: "Explore", icon: SearchIcon, active: true }, { label: "Saved", icon: Tag, onClick: () => router.push("/saved") }, { label: "Profile", icon: UserRound, onClick: () => router.push("/profile") }]} />
    </main>
  );
}
