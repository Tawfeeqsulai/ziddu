import { prisma } from "@/lib/db/prisma";
import { readStringArray } from "@/lib/db/json";
import { getDiscoveryData } from "@/services/discovery.service";
import { haversineDistanceKm } from "@/lib/location";
import { BUSINESS_CATEGORIES, type BusinessCategory, type FeedPost, type Shop } from "@/types/commerce";

export const SEARCH_LIMIT = 8;

export type SearchParams = { query?: string; category?: string; city?: string; locality?: string; distance?: string; page?: string };
export type SearchOffer = { id: string; title: string; description: string; shop: Shop; price?: number; originalPrice?: number; badge?: string; validUntil: string };
export type SearchProduct = { id: string; name: string; description: string; image?: string; price: number; shop: Shop; offer?: { price?: number; originalPrice?: number; badge?: string } };
export type SearchResults = { query: string; category: BusinessCategory | "ALL"; city: string; locality: string; shops: Shop[]; posts: FeedPost[]; offers: SearchOffer[]; products: SearchProduct[]; hasMore: boolean; failed?: boolean };

function normalized(value: string | undefined, maxLength: number) {
  return (value ?? "").trim().slice(0, maxLength);
}

function categoryValue(value: string | undefined): BusinessCategory | "ALL" {
  return value && BUSINESS_CATEGORIES.includes(value as BusinessCategory) ? value as BusinessCategory : "ALL";
}

function textFilter(value: string) {
  return value ? { contains: value } : undefined;
}

function shopView(shop: { id: string; name: string; handle: string; category: BusinessCategory; status: string; rating: number; initials: string; image: string; phone: string | null; description: string | null; follows?: Array<{ id: string }> | false; location: { address: string; locality: string; city: string; state: string; pincode: string | null; latitude: number | null; longitude: number | null } }): Shop {
  return {
    id: shop.id, name: shop.name, handle: shop.handle, category: shop.category, distance: "Nearby", area: shop.location.locality, city: shop.location.city, state: shop.location.state,
    status: shop.status.toLowerCase().includes("close") ? "Closed" : "Open now", rating: shop.rating, initials: shop.initials, image: shop.image,
    address: shop.location.address, owner: "", phone: shop.phone ?? undefined, latitude: shop.location.latitude ?? undefined, longitude: shop.location.longitude ?? undefined,
    description: shop.description ?? undefined,
    followed: Array.isArray(shop.follows) && shop.follows.length > 0,
  };
}

function offerValue(value: unknown) {
  if (!value || typeof value !== "object") return {} as { priceInr?: number; originalPriceInr?: number; badge?: string };
  return value as { priceInr?: number; originalPriceInr?: number; badge?: string };
}

export async function searchDiscovery(params: SearchParams, userLocation?: { city?: string | null; locality?: string | null; latitude?: number | null; longitude?: number | null }, userId?: string): Promise<SearchResults> {
  const query = normalized(params.query, 80);
  const category = categoryValue(params.category);
  const requestedCity = normalized(params.city, 60);
  const requestedLocality = normalized(params.locality, 80);
  const city = requestedCity || normalized(userLocation?.city ?? undefined, 60);
  const locality = requestedLocality;
  const maxDistance = Math.max(0, Number.parseFloat(params.distance ?? "0") || 0);
  const page = Math.max(1, Math.min(Number.parseInt(params.page ?? "1", 10) || 1, 20));
  const skip = (page - 1) * SEARCH_LIMIT;
  const now = new Date();
  const shopWhere = {
    ...(category !== "ALL" ? { category } : {}),
    ...(city ? { location: { city: textFilter(city) } } : {}),
    ...(locality ? { location: { ...(city ? { city: textFilter(city) } : {}), locality: textFilter(locality) } } : {}),
    ...(query ? { OR: [{ name: textFilter(query) }, { description: textFilter(query) }, { handle: textFilter(query) }, { location: { locality: textFilter(query) } }, { location: { city: textFilter(query) } }] } : {}),
  };
  const postWhere = {
    AND: [{
      OR: [
        { isOfferIncluded: false },
        { isOfferIncluded: true, offer: { is: { validityFrom: { lte: now }, validityTo: { gte: now } } } },
      ],
    }],
    ...(category !== "ALL" ? { shop: { category } } : {}),
    ...(city ? { shop: { ...(category !== "ALL" ? { category } : {}), location: { city: textFilter(city) } } } : {}),
    ...(query ? { OR: [{ title: textFilter(query) }, { description: textFilter(query) }, { shop: { name: textFilter(query) } }] } : {}),
  };
  const offerWhere = {
    validityFrom: { lte: now },
    validityTo: { gte: now },
    ...(category !== "ALL" || city ? { shop: { ...(category !== "ALL" ? { category } : {}), ...(city ? { location: { city: textFilter(city) } } : {}) } } : {}),
  };
  const productWhere = {
    isAvailable: true,
    ...(category !== "ALL" || city || query ? { shop: { ...(category !== "ALL" ? { category } : {}), ...(city ? { location: { city: textFilter(city) } } : {}), ...(query ? { OR: [{ name: textFilter(query) }, { description: textFilter(query) }] } : {}) } } : {}),
  };

  try {
    const [shopRecords, postRecords, offerRecords, productRecords] = await Promise.all([
      prisma.shop.findMany({ where: shopWhere, include: { location: true, follows: userId ? { where: { userId }, select: { id: true } } : false }, orderBy: { name: "asc" }, skip, take: SEARCH_LIMIT }),
      prisma.post.findMany({ where: postWhere, include: { shop: { include: { location: true, follows: userId ? { where: { userId }, select: { id: true } } : false } }, offer: { include: { product: { select: { priceInr: true } } } }, _count: { select: { likes: true } }, likes: userId ? { where: { userId }, select: { id: true } } : false, saves: userId ? { where: { userId }, select: { id: true } } : false }, orderBy: { publishedAt: "desc" }, skip, take: SEARCH_LIMIT }),
      prisma.offer.findMany({ where: offerWhere, include: { shop: { include: { location: true } }, product: true, posts: { take: 1 } }, orderBy: { validityTo: "asc" }, take: SEARCH_LIMIT }),
      prisma.product.findMany({ where: productWhere, include: { shop: { include: { location: true } }, offers: { where: { validityFrom: { lte: now }, validityTo: { gte: now } }, take: 1 } }, orderBy: { name: "asc" }, skip, take: SEARCH_LIMIT }),
    ]);

    const nearbyShops = shopRecords.filter((shop) => {
      const distance = haversineDistanceKm(userLocation ?? {}, { latitude: shop.location.latitude, longitude: shop.location.longitude });
      return maxDistance === 0 || (distance != null && distance <= maxDistance);
    });
    const posts = postRecords.filter((post) => {
      const distance = haversineDistanceKm(userLocation ?? {}, { latitude: post.shop.location.latitude, longitude: post.shop.location.longitude });
      if (maxDistance > 0 && (distance == null || distance > maxDistance)) return false;
      if (!query) return true;
      const hashtags = Array.isArray(post.hashtags) ? post.hashtags.join(" ") : "";
      return `${post.title} ${post.description} ${hashtags} ${post.shop.name}`.toLowerCase().includes(query.toLowerCase());
    }).map((post) => {
      const values = offerValue(post.offer?.offerValue);
      return { id: post.id, shopId: post.shopId, kind: post.isOfferIncluded ? "offer" as const : post.type === "VIDEO" ? "reel" as const : "post" as const, title: post.title, description: post.description, image: post.thumbnailUrl ?? post.mediaUrl, imageAlt: post.altText ?? post.title, likes: post._count.likes, publishedAt: post.publishedAt.toISOString(), mediaType: post.type === "VIDEO" ? "video" as const : "image" as const, mediaUrl: post.type === "VIDEO" ? post.mediaUrl : undefined, hashtags: readStringArray(post.hashtags), price: values.priceInr ?? post.offer?.product?.priceInr, originalPrice: values.originalPriceInr, badge: values.badge, liked: Array.isArray(post.likes) && post.likes.length > 0, saved: Array.isArray(post.saves) && post.saves.length > 0 } satisfies FeedPost;
    });
    const offers = offerRecords.filter((offer) => {
      const post = offer.posts[0];
      const distance = haversineDistanceKm(userLocation ?? {}, { latitude: offer.shop.location.latitude, longitude: offer.shop.location.longitude });
      if (maxDistance > 0 && (distance == null || distance > maxDistance)) return false;
      if (!query) return true;
      const searchable = `${offer.shop.name} ${offer.product?.name ?? ""} ${post?.title ?? ""} ${post?.description ?? ""}`.toLowerCase();
      return searchable.includes(query.toLowerCase());
    }).map((offer) => { const values = offerValue(offer.offerValue); const post = offer.posts[0]; return { id: offer.id, title: post?.title ?? offer.product?.name ?? "Local offer", description: post?.description ?? offer.product?.description ?? "A limited-time offer from this shop.", shop: shopView(offer.shop), price: values.priceInr ?? offer.product?.priceInr, originalPrice: values.originalPriceInr, badge: values.badge, validUntil: offer.validityTo.toISOString() }; });
    const products = productRecords.filter((product) => { const distance = haversineDistanceKm(userLocation ?? {}, { latitude: product.shop.location.latitude, longitude: product.shop.location.longitude }); return maxDistance === 0 || (distance != null && distance <= maxDistance); }).map((product) => { const active = product.offers[0]; const values = offerValue(active?.offerValue); return { id: product.id, name: product.name, description: product.description, image: product.imageUrl ?? undefined, price: product.priceInr, shop: shopView(product.shop), offer: active ? { price: values.priceInr, originalPrice: values.originalPriceInr, badge: values.badge } : undefined }; });
    const resultShops = new Map<string, Shop>();
    [...nearbyShops, ...postRecords.map((post) => post.shop), ...offerRecords.map((offer) => offer.shop), ...productRecords.map((product) => product.shop)].forEach((shop) => resultShops.set(shop.id, shopView(shop)));
    if (nearbyShops.length === 0 && posts.length === 0 && offers.length === 0 && products.length === 0 && city && !requestedCity) {
      return searchDiscovery({ ...params, city: undefined }, undefined, userId);
    }
    return { query, category, city, locality, shops: [...resultShops.values()].slice(0, SEARCH_LIMIT), posts, offers, products, hasMore: nearbyShops.length === SEARCH_LIMIT || postRecords.length === SEARCH_LIMIT || productRecords.length === SEARCH_LIMIT };
  } catch {
    const fallback = await getDiscoveryData(userId ?? "");
    const normalizedQuery = query.toLowerCase();
    const posts = fallback.posts.filter((post) => !normalizedQuery || `${post.title} ${post.description} ${post.hashtags.join(" ")}`.toLowerCase().includes(normalizedQuery));
    const shops = fallback.shops.filter((shop) => !normalizedQuery || `${shop.name} ${shop.category} ${shop.handle} ${shop.area} ${shop.city}`.toLowerCase().includes(normalizedQuery) || posts.some((post) => post.shopId === shop.id));
    return { query, category, city, locality, shops, posts, offers: [], products: [], hasMore: false };
  }
}
