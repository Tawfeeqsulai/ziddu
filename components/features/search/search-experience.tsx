"use client";

import { ChevronDown, Clock3, Home, MapPin, Search as SearchIcon, Star, Tag, UserRound, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { BottomNavigation } from "@/components/ui/bottom-navigation";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { BUSINESS_CATEGORY_LABELS, type BusinessCategory } from "@/types/commerce";
import type { SearchResults } from "@/services/search.service";
import { getCurrentLocation } from "@/lib/current-location";

type SearchExperienceProps = { results: SearchResults; authenticated: boolean; initialDistance?: string; initialLocation?: { city: string | null; locality: string | null; latitude: number | null; longitude: number | null } };
type PlaceResult = { address?: string; locality?: string; city?: string; state?: string; latitude?: number; longitude?: number };
type ExploreQuickFilter = "all" | "top-rated" | "accounts" | "offers" | "new";
const EXPLORE_QUICK_FILTERS: { id: Exclude<ExploreQuickFilter, "all">; label: string }[] = [
  { id: "top-rated", label: "Top Rated" },
  { id: "accounts", label: "Accounts" },
  { id: "offers", label: "Offers" },
  { id: "new", label: "New" },
];

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function offerEndDate(value: string) {
  if (!value) return "Offer live now";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Offer live now" : `Valid until ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(date)}`;
}

export default function SearchExperience({ results, initialDistance, initialLocation }: SearchExperienceProps) {
  const router = useRouter();
  const [input, setInput] = useState(results.query);
  const [category, setCategory] = useState<BusinessCategory | "ALL">(results.category);
  const [quickFilter, setQuickFilter] = useState<ExploreQuickFilter>("all");
  const [distance, setDistance] = useState(() => {
    if (initialDistance !== undefined) return initialDistance;
    if (typeof window === "undefined") return "0";
    try { const radius = Number(window.localStorage.getItem("ziddu:location-radius")); return Number.isFinite(radius) && radius >= 1 ? String(Math.min(radius, 100)) : "10"; } catch { return "10"; }
  });
  const [currentLocation, setCurrentLocation] = useState(initialLocation);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [locationQuery, setLocationQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [placeSearchBusy, setPlaceSearchBusy] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationError, setLocationError] = useState("");

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

  async function saveLocation(location: PlaceResult) {
    setLocationBusy(true);
    setLocationError("");
    try {
      const response = await fetch("/api/location/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(location) });
      const result = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(result?.message ?? "This location could not be saved.");
      setCurrentLocation({ city: location.city ?? null, locality: location.locality ?? null, latitude: location.latitude ?? null, longitude: location.longitude ?? null });
      setLocationPickerOpen(false);
      const params = new URLSearchParams(window.location.search);
      if (location.city) params.set("city", location.city);
      if (location.locality) params.set("locality", location.locality);
      router.replace(`/search?${params.toString()}`);
      router.refresh();
    } catch (cause) {
      setLocationError(cause instanceof Error ? cause.message : "This location could not be saved.");
    } finally { setLocationBusy(false); }
  }

  async function findCurrentLocation() {
    setLocationBusy(true);
    setLocationError("");
    try {
      const location = await getCurrentLocation();
      await saveLocation(location);
    } catch (cause) {
      setLocationError(cause instanceof Error ? cause.message : "Could not find your current location.");
    } finally { setLocationBusy(false); }
  }

  let visibleShops = category === "ALL" ? [...results.shops] : results.shops.filter((shop) => shop.category === category);
  let visibleOffers = category === "ALL" ? [...results.offers] : results.offers.filter((offer) => offer.shop.category === category);
  let visibleProducts = category === "ALL" ? [...results.products] : results.products.filter((product) => product.shop.category === category);
  let visiblePosts = category === "ALL" ? [...results.posts] : results.posts.filter((post) => results.shops.find((shop) => shop.id === post.shopId)?.category === category);
  if (quickFilter === "accounts") { visibleOffers = []; visibleProducts = []; visiblePosts = []; }
  if (quickFilter === "offers") { visibleShops = []; visibleProducts = []; visiblePosts = []; visibleOffers = [...visibleOffers, ...(results.vendorOffers ?? [])]; }
  if (quickFilter === "new") { visibleShops = []; visibleOffers = []; visibleProducts = []; visiblePosts.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)); }
  if (quickFilter === "top-rated") {
    visibleShops.sort((a, b) => b.rating - a.rating);
    visibleOffers.sort((a, b) => b.shop.rating - a.shop.rating);
    visibleProducts.sort((a, b) => b.shop.rating - a.shop.rating);
    visiblePosts.sort((a, b) => (results.shops.find((shop) => shop.id === b.shopId)?.rating ?? 0) - (results.shops.find((shop) => shop.id === a.shopId)?.rating ?? 0));
  }
  const suggestedPosts = visiblePosts.slice(0, 6);
  const hasResults = visibleShops.length + visiblePosts.length + visibleOffers.length + visibleProducts.length > 0;
  const locationChoices = Array.from(new Map(results.shops.filter((shop) => shop.area || shop.city).map((shop) => [`${shop.area}|${shop.city}`, shop])).values());
  const exploreLocation = currentLocation?.locality || results.locality || currentLocation?.city || results.city || "Choose location";

  return (
    <main className="search-page explore-page">
      <header className="search-topbar explore-topbar">
        <div className="explore-title"><h1>Explore</h1><button aria-label="Choose location" className="explore-location" onClick={() => setLocationPickerOpen(true)} type="button"><MapPin size={14} /> {exploreLocation} <ChevronDown size={13} /></button></div>
      </header>
      <section className="search-controls explore-controls"><label className="search-input"><SearchIcon aria-hidden="true" size={16} /><input autoFocus aria-label="Search restaurants, cafes and stores" onChange={(event) => setInput(event.target.value)} placeholder="Search restaurants, cafes, stores..." value={input} /></label></section>
      <nav aria-label="Quick explore filters" className="explore-quick-filters">{EXPLORE_QUICK_FILTERS.map((item) => <button aria-pressed={quickFilter === item.id} className={quickFilter === item.id ? "is-active" : ""} key={item.id} onClick={() => setQuickFilter((current) => current === item.id ? "all" : item.id)} type="button">{item.label}</button>)}</nav>
      <div className="explore-select-row"><label className="explore-category-select">Category<select aria-label="Filter by category" onChange={(event) => setCategory(event.target.value as BusinessCategory | "ALL")} value={category}><option value="ALL">All categories</option>{(["RESTAURANT", "FURNITURE", "ELECTRONICS", "CLOTHS"] as const).map((value) => <option key={value} value={value}>{BUSINESS_CATEGORY_LABELS[value]}</option>)}</select></label><label className="distance-filter explore-distance">Distance<select aria-label="Filter by distance" onChange={(event) => { setDistance(event.target.value); if (event.target.value !== "0") window.localStorage.setItem("ziddu:location-radius", event.target.value); }} value={distance}><option value="0">Any distance</option>{Array.from({ length: 100 }, (_, index) => index + 1).map((value) => <option key={value} value={value}>Within {value} km</option>)}</select></label></div>
       {results.failed ? <ErrorState description="Please try again in a moment." title="Couldn't complete the search" onAction={() => router.refresh()} /> : !hasResults ? <EmptyState description={results.query ? "Try a different shop, product, category or location." : "New local businesses and offers will appear here."} title={results.query ? "No results found" : "Nothing nearby yet"} /> : <div className="search-results explore-results">
         {suggestedPosts.length > 0 && <section className="search-section explore-suggestions"><div className="search-section-heading"><div><h2>Suggested for you</h2></div><span>{suggestedPosts.length}</span></div><div className="explore-suggestion-list">{suggestedPosts.map((post) => { const shop = results.shops.find((item) => item.id === post.shopId); if (!shop) return null; return <Link className="explore-suggestion-card" href={`/shops/${shop.id}`} key={post.id}><Image alt={post.imageAlt} className="explore-suggestion-image" height={124} src={post.image} unoptimized width={180} /><span className="explore-suggestion-copy"><strong>{shop.name}</strong><span>{post.title}</span><small>{post.description}</small><em><Star fill="currentColor" size={11} /> {shop.rating.toFixed(1)} · {shop.area || shop.city}</em></span></Link>; })}</div></section>}
         {visibleShops.length > 0 && <section className="search-section explore-business-section"><div className="search-section-heading"><div><span className="section-kicker">EXPLORE BUSINESSES</span><h2>Nearby places</h2></div><span>{visibleShops.length}</span></div><div className="search-shop-list">{visibleShops.map((shop) => { const shopPost = visiblePosts.find((post) => post.shopId === shop.id); return <Link className="search-shop-result explore-shop-result" href={`/shops/${shop.id}`} key={shop.id}>{shopPost ? <Image alt={shopPost.imageAlt} className="explore-shop-media" height={72} src={shopPost.image} unoptimized width={72} /> : <Avatar alt={shop.name} image={shop.image} initials={shop.initials} size="md" />}<span><strong>{shop.name}</strong><small>{BUSINESS_CATEGORY_LABELS[shop.category]}{shop.area ? `, ${shop.area}` : ""}</small><em><Star fill="currentColor" size={10} /> {shop.rating.toFixed(1)} ({shop.followerCount ?? 0}) <i /> {shop.distance}</em></span>{shop.category === "RESTAURANT" && <b className="explore-offer-badge">50% OFF</b>}</Link>; })}</div></section>}
        {visibleOffers.length > 0 && <section className="search-section explore-secondary-section"><div className="search-section-heading"><div><span className="section-kicker">CURRENT OFFERS</span><h2>Good value, close by</h2></div></div><div className="search-offer-list">{visibleOffers.map((offer) => <article className="search-offer-result explore-vendor-offer-card" key={offer.id}><div className="explore-vendor-offer-copy"><strong className="explore-vendor-offer-badge">{offer.badge ?? "Local offer"}</strong><span className="explore-vendor-offer-title">{offer.title}</span><p>{offer.description}</p><small><Clock3 aria-hidden="true" size={12} /> {offerEndDate(offer.validUntil)}</small></div><Image alt={offer.title} className="explore-vendor-offer-image" height={120} src={offer.image ?? offer.shop.image} unoptimized width={150} /></article>)}</div></section>}
        {visibleProducts.length > 0 && <section className="search-section explore-secondary-section"><div className="search-section-heading"><div><span className="section-kicker">PRODUCTS</span><h2>Things worth a look</h2></div></div><div className="search-product-list">{visibleProducts.map((product) => <article className="search-product-result" key={product.id}>{product.image ? <Image alt={product.name} height={48} src={product.image} unoptimized width={48} /> : <span className="search-product-fallback"><Tag size={18} /></span>}<div><strong>{product.name}</strong><small>{product.shop.name} · {BUSINESS_CATEGORY_LABELS[product.shop.category]}</small><span>{product.shop.area}, {product.shop.city}</span></div><b>{money(product.offer?.price ?? product.price)}</b></article>)}</div></section>}
      </div>}
      <BottomNavigation showProfile items={[{ label: "Home", icon: Home, onClick: () => router.push("/") }, { label: "Explore", icon: SearchIcon, active: true }, { label: "Saved", icon: Tag, onClick: () => router.push("/saved") }, { label: "Profile", icon: UserRound, onClick: () => router.push("/profile") }]} />
      {locationPickerOpen && <div className="modal-backdrop explore-location-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setLocationPickerOpen(false); }}><section aria-labelledby="explore-location-title" aria-modal="true" className="explore-location-picker location-picker" role="dialog"><button aria-label="Close location picker" className="close-modal" onClick={() => setLocationPickerOpen(false)} type="button"><X size={18} /></button><span className="section-kicker">DISCOVER NEARBY</span><h2 id="explore-location-title">Choose your location</h2><label className="location-search"><SearchIcon aria-hidden="true" size={16} /><input aria-label="Search any location" onChange={(event) => { setLocationQuery(event.target.value); if (event.target.value.trim().length < 2) setPlaceResults([]); }} placeholder="Search any area or city" value={locationQuery} /></label><button className="location-option" disabled={locationBusy} onClick={() => { void findCurrentLocation(); }} type="button"><MapPin size={17} /><span><strong>Use my current location</strong><small>Find shops around you</small></span></button><div className="location-radius-picker"><label htmlFor="explore-radius">Nearby radius <strong>{distance === "0" ? "Any" : `${distance} km`}</strong></label><input aria-label="Nearby radius in kilometers" id="explore-radius" max="100" min="1" onChange={(event) => { setDistance(event.target.value); window.localStorage.setItem("ziddu:location-radius", event.target.value); }} type="range" value={distance === "0" ? 10 : distance} /></div><div className="location-option-list">{placeResults.map((place, index) => <button className="location-option" key={`${place.latitude}:${place.longitude}:${index}`} onClick={() => { void saveLocation(place); }} type="button"><MapPin size={17} /><span><strong>{place.locality || place.address?.split(",")[0] || place.city || "Selected location"}</strong><small>{[place.locality && place.city && place.locality !== place.city ? place.locality : null, place.city, place.state].filter(Boolean).join(", ") || place.address}</small></span></button>)}{locationChoices.filter((shop) => `${shop.area} ${shop.city}`.toLowerCase().includes(locationQuery.trim().toLowerCase())).map((shop) => <button className="location-option" key={`${shop.area}|${shop.city}`} onClick={() => { void saveLocation({ locality: shop.area, city: shop.city, address: shop.address, latitude: shop.latitude, longitude: shop.longitude }); }} type="button"><MapPin size={17} /><span><strong>{shop.area || shop.city}</strong><small>{[shop.area && shop.area !== shop.city ? shop.area : null, shop.city].filter(Boolean).join(", ")}</small></span></button>)}{placeSearchBusy && <p className="location-search-empty">Searching locations…</p>}{!placeSearchBusy && locationQuery.trim().length >= 2 && placeResults.length === 0 && locationChoices.filter((shop) => `${shop.area} ${shop.city}`.toLowerCase().includes(locationQuery.trim().toLowerCase())).length === 0 && <p className="location-search-empty">No locations found. Try another area or city.</p>}</div>{locationError && <p className="location-picker-error" role="alert">{locationError}</p>}</section></div>}
    </main>
  );
}
