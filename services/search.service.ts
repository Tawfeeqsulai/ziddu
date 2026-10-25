import { prisma } from "@/lib/db/prisma";
import { readStringArray } from "@/lib/db/json";
import { getDiscoveryData } from "@/services/discovery.service";
import { formatDistanceKm, haversineDistanceKm } from "@/lib/location";
import { formatOfferLabel } from "@/lib/offer-label";
import { normalizeVendorLocation } from "@/lib/vendor-location";
import { BUSINESS_CATEGORIES, normalizeBusinessCategory, type BusinessCategory, type FeedPost, type Shop } from "@/types/commerce";
import { mergeHashtags } from "@/lib/hashtag";

export const SEARCH_LIMIT = 8;

export type SearchParams = { query?: string; category?: string; city?: string; locality?: string; distance?: string; page?: string };
export type SearchOffer = { id: string; title: string; description: string; shop: Shop; price?: number; originalPrice?: number; badge?: string; image?: string; validUntil: string };
export type SearchProduct = { id: string; name: string; description: string; image?: string; price: number; shop: Shop; offer?: { price?: number; originalPrice?: number; badge?: string } };
export type SearchResults = { query: string; category: BusinessCategory | "ALL"; city: string; locality: string; shops: Shop[]; posts: FeedPost[]; offers: SearchOffer[]; vendorOffers?: SearchOffer[]; products: SearchProduct[]; hasMore: boolean; failed?: boolean };

async function searchSharedVendorOffers(query: string, category: BusinessCategory | "ALL", city: string, locality: string, userLocation: { latitude?: number | null; longitude?: number | null }, maxDistance: number): Promise<SearchOffer[]> {
  const now = new Date();
  const records = await prisma.sharedOffer.findMany({
    where: { AND: [
      { OR: [{ validityFrom: null }, { validityFrom: { lte: now } }] },
      { OR: [{ validityTo: null }, { validityTo: { gte: now } }] },
    ] },
    include: { vendor: { include: { user: true } }, posts: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  const itemIds = [...new Set(records.filter((offer) => !offer.offerTargetType || /ITEM|PRODUCT|MENU/i.test(offer.offerTargetType)).map((offer) => offer.offerTargetId).filter((id): id is number => id !== null))];
  const menuItems = itemIds.length ? await prisma.sharedMenuItem.findMany({ where: { id: { in: itemIds } }, select: { id: true, productName: true, image: true } }) : [];
  const itemById = new Map(menuItems.map((item) => [item.id, item]));
  const normalizedQuery = query.toLowerCase();

  return records.flatMap((offer) => {
    const vendor = offer.vendor;
    if (!vendor || vendor.status.toLowerCase() === "inactive") return [];
    const location = normalizeVendorLocation(vendor.address);
    const vendorCategory = normalizeBusinessCategory(vendor.businessCategory);
    if (category !== "ALL" && vendorCategory !== category) return [];
    const distance = haversineDistanceKm(userLocation, location);
    const hasCoordinates = userLocation.latitude != null && userLocation.longitude != null;
    if (maxDistance > 0 && hasCoordinates && (distance === null || distance > maxDistance)) return [];
    if (!(maxDistance > 0 && hasCoordinates)) {
      if (city && !location.city.toLowerCase().includes(city.toLowerCase())) return [];
      if (locality && !`${location.locality} ${location.city}`.toLowerCase().includes(locality.toLowerCase())) return [];
      if (maxDistance > 0 && distance !== null && distance > maxDistance) return [];
    }

    const name = vendor.businessName?.trim() || `Vendor ${vendor.id}`;
    const shop: Shop = {
      id: String(vendor.id), name, handle: `vendor-${vendor.id}`, category: vendorCategory,
      distance: formatDistanceKm(distance) ?? "Nearby", area: location.locality, city: location.city, state: "",
      status: "Open now", rating: 0, initials: name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(),
      image: vendor.logoUrl || "/ziddu-logo.png", address: location.address, owner: "", phone: vendor.user.phoneNumber || undefined,
      latitude: location.latitude, longitude: location.longitude,
    };
    const item = offer.offerTargetId === null ? undefined : itemById.get(offer.offerTargetId);
    const post = offer.posts[0];
    const values = offerValue(offer.offerValue);
    const title = item?.productName ?? `${name} offer`;
    const badge = formatOfferLabel({ offerType: offer.offerType, offerValue: offer.offerValue, badge: values.badge, productName: item?.productName, price: values.priceInr, originalPrice: values.originalPriceInr });
    const searchable = `${name} ${title} ${badge} ${post?.postCategory ?? ""}`.toLowerCase();
    if (normalizedQuery && !searchable.includes(normalizedQuery)) return [];

    return [{
      id: `vendor-${offer.id}`, title, description: `A ${offer.offerType.toLowerCase().replaceAll("_", " ")} offer from ${name}.`,
      shop, price: values.priceInr, originalPrice: values.originalPriceInr, badge,
      image: (post?.postType.toUpperCase() === "VIDEO" ? undefined : post?.postUrl) ?? item?.image ?? shop.image, validUntil: offer.validityTo?.toISOString() ?? "",
    }];
  });
}

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

function sharedSearchResults(data: Awaited<ReturnType<typeof getDiscoveryData>>, query: string, category: BusinessCategory | "ALL", city: string, locality: string, userLocation: { latitude?: number | null; longitude?: number | null }, maxDistance: number): SearchResults {
  const normalizedQuery = query.toLowerCase();
  const locationMatches = (shop: Shop) => {
    const distance = haversineDistanceKm(userLocation, shop);
    if (maxDistance > 0 && userLocation.latitude != null && userLocation.longitude != null && distance !== null) return distance <= maxDistance;
    if (city && !shop.city.toLowerCase().includes(city.toLowerCase())) return false;
    if (locality && !`${shop.area} ${shop.city}`.toLowerCase().includes(locality.toLowerCase())) return false;
    if (maxDistance <= 0 || distance === null) return true;
    return distance <= maxDistance;
  };
  const posts = data.posts.filter((post) => {
    const shop = data.shops.find((item) => item.id === post.shopId);
    if (!shop || (category !== "ALL" && shop.category !== category) || !locationMatches(shop)) return false;
    return !normalizedQuery || `${post.title} ${post.description} ${post.hashtags.join(" ")} ${shop.name}`.toLowerCase().includes(normalizedQuery);
  });
  const shops = data.shops.filter((shop) => {
    if (category !== "ALL" && shop.category !== category) return false;
    if (!locationMatches(shop)) return false;
    return !normalizedQuery || `${shop.name} ${shop.category} ${shop.handle} ${shop.area} ${shop.city}`.toLowerCase().includes(normalizedQuery) || posts.some((post) => post.shopId === shop.id);
  }).sort((a, b) => (haversineDistanceKm(userLocation, a) ?? Infinity) - (haversineDistanceKm(userLocation, b) ?? Infinity));
  return { query, category, city, locality, shops, posts, offers: [], products: [], hasMore: false };
}

export async function searchDiscovery(params: SearchParams, userLocation?: { city?: string | null; locality?: string | null; latitude?: number | null; longitude?: number | null }, userId?: string): Promise<SearchResults> {
  const query = normalized(params.query, 80);
  const category = categoryValue(params.category);
  const requestedCity = normalized(params.city, 60);
  const requestedLocality = normalized(params.locality, 80);
  const city = requestedCity || normalized(userLocation?.city ?? undefined, 60);
  const locality = requestedLocality || normalized(userLocation?.locality ?? undefined, 80);
  const maxDistance = Math.max(0, Number.parseFloat(params.distance ?? "0") || 0);
  const useGeoRadius = maxDistance > 0 && userLocation?.latitude != null && userLocation.longitude != null;
  const vendorOffersPromise = searchSharedVendorOffers(query, category, city, locality, userLocation ?? {}, maxDistance).catch(() => []);
  const page = Math.max(1, Math.min(Number.parseInt(params.page ?? "1", 10) || 1, 20));
  const skip = (page - 1) * SEARCH_LIMIT;
  const fetchLimit = useGeoRadius ? SEARCH_LIMIT * 10 : SEARCH_LIMIT;
  const fetchSkip = useGeoRadius ? 0 : skip;
  const now = new Date();
  const shopWhere = {
    ...(category !== "ALL" ? { category } : {}),
    ...(city && !useGeoRadius ? { location: { city: textFilter(city) } } : {}),
    ...(locality && !useGeoRadius ? { location: { ...(city ? { city: textFilter(city) } : {}), locality: textFilter(locality) } } : {}),
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
    ...(city && !useGeoRadius ? { shop: { ...(category !== "ALL" ? { category } : {}), location: { city: textFilter(city) } } } : {}),
    ...(query ? { OR: [{ title: textFilter(query) }, { description: textFilter(query) }, { shop: { name: textFilter(query) } }] } : {}),
  };
  const offerWhere = {
    validityFrom: { lte: now },
    validityTo: { gte: now },
    ...(category !== "ALL" || city && !useGeoRadius ? { shop: { ...(category !== "ALL" ? { category } : {}), ...(city && !useGeoRadius ? { location: { city: textFilter(city) } } : {}) } } : {}),
  };
  const productWhere = {
    isAvailable: true,
    ...(category !== "ALL" || city && !useGeoRadius || query ? { shop: { ...(category !== "ALL" ? { category } : {}), ...(city && !useGeoRadius ? { location: { city: textFilter(city) } } : {}), ...(query ? { OR: [{ name: textFilter(query) }, { description: textFilter(query) }] } : {}) } } : {}),
  };

  try {
    const [shopRecords, postRecords, offerRecords, productRecords, vendorOffers] = await Promise.all([
      prisma.shop.findMany({ where: shopWhere, include: { location: true, follows: userId ? { where: { userId }, select: { id: true } } : false }, orderBy: { name: "asc" }, skip: fetchSkip, take: fetchLimit }),
      prisma.post.findMany({ where: postWhere, include: { shop: { include: { location: true, follows: userId ? { where: { userId }, select: { id: true } } : false } }, offer: { include: { product: { select: { priceInr: true, name: true } } } }, _count: { select: { likes: true, saves: true } }, likes: userId ? { where: { userId }, select: { id: true } } : false, saves: userId ? { where: { userId }, select: { id: true } } : false }, orderBy: { publishedAt: "desc" }, skip: fetchSkip, take: fetchLimit }),
      prisma.offer.findMany({ where: offerWhere, include: { shop: { include: { location: true } }, product: true, posts: { take: 1 } }, orderBy: { validityTo: "asc" }, take: fetchLimit }),
      prisma.product.findMany({ where: productWhere, include: { shop: { include: { location: true } }, offers: { where: { validityFrom: { lte: now }, validityTo: { gte: now } }, take: 1 } }, orderBy: { name: "asc" }, skip: fetchSkip, take: fetchLimit }),
      vendorOffersPromise,
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
      return { id: post.id, shopId: post.shopId, kind: post.isOfferIncluded ? "offer" as const : post.type === "VIDEO" ? "reel" as const : "post" as const, title: post.title, description: post.description, image: post.thumbnailUrl ?? post.mediaUrl, imageAlt: post.altText ?? post.title, likes: post._count.likes, saves: post._count.saves, publishedAt: post.publishedAt.toISOString(), mediaType: post.type === "VIDEO" ? "video" as const : "image" as const, mediaUrl: post.type === "VIDEO" ? post.mediaUrl : undefined, hashtags: mergeHashtags(readStringArray(post.hashtags), post.offer?.product?.name), price: values.priceInr ?? post.offer?.product?.priceInr, originalPrice: values.originalPriceInr, badge: values.badge ?? (post.isOfferIncluded ? post.title : undefined), offerValidUntil: post.offer?.validityTo.toISOString(), liked: Array.isArray(post.likes) && post.likes.length > 0, saved: Array.isArray(post.saves) && post.saves.length > 0 } satisfies FeedPost;
    });
    const offers = offerRecords.filter((offer) => {
      const post = offer.posts[0];
      const distance = haversineDistanceKm(userLocation ?? {}, { latitude: offer.shop.location.latitude, longitude: offer.shop.location.longitude });
      if (maxDistance > 0 && (distance == null || distance > maxDistance)) return false;
      if (!query) return true;
      const searchable = `${offer.shop.name} ${offer.product?.name ?? ""} ${post?.title ?? ""} ${post?.description ?? ""}`.toLowerCase();
      return searchable.includes(query.toLowerCase());
    }).map((offer) => { const values = offerValue(offer.offerValue); const post = offer.posts[0]; return { id: offer.id, title: post?.title ?? offer.product?.name ?? "Local offer", description: post?.description ?? offer.product?.description ?? "A limited-time offer from this shop.", shop: shopView(offer.shop), price: values.priceInr ?? offer.product?.priceInr, originalPrice: values.originalPriceInr, badge: values.badge, image: post?.thumbnailUrl ?? (post?.type === "IMAGE" ? post.mediaUrl : undefined) ?? offer.product?.imageUrl ?? undefined, validUntil: offer.validityTo.toISOString() }; });
    const products = productRecords.filter((product) => { const distance = haversineDistanceKm(userLocation ?? {}, { latitude: product.shop.location.latitude, longitude: product.shop.location.longitude }); return maxDistance === 0 || (distance != null && distance <= maxDistance); }).map((product) => { const active = product.offers[0]; const values = offerValue(active?.offerValue); return { id: product.id, name: product.name, description: product.description, image: product.imageUrl ?? undefined, price: product.priceInr, shop: shopView(product.shop), offer: active ? { price: values.priceInr, originalPrice: values.originalPriceInr, badge: values.badge } : undefined }; });
    const resultShops = new Map<string, Shop>();
    [...nearbyShops, ...postRecords.map((post) => post.shop), ...offerRecords.map((offer) => offer.shop), ...productRecords.map((product) => product.shop)].forEach((shop) => resultShops.set(shop.id, shopView(shop)));
    if (nearbyShops.length === 0 && posts.length === 0 && offers.length === 0 && products.length === 0) {
      const sharedResults = sharedSearchResults(await getDiscoveryData(userId ?? ""), query, category, city, locality, userLocation ?? {}, maxDistance);
      if (sharedResults.shops.length > 0 || sharedResults.posts.length > 0) return { ...sharedResults, vendorOffers };
    }
    return { query, category, city, locality, shops: [...resultShops.values()].slice(0, SEARCH_LIMIT), posts, offers, vendorOffers, products, hasMore: nearbyShops.length === SEARCH_LIMIT || postRecords.length === SEARCH_LIMIT || productRecords.length === SEARCH_LIMIT };
  } catch {
    const fallback = await getDiscoveryData(userId ?? "");
    const [sharedResults, vendorOffers] = await Promise.all([
      Promise.resolve(sharedSearchResults(fallback, query, category, city, locality, userLocation ?? {}, maxDistance)),
      vendorOffersPromise,
    ]);
    return { ...sharedResults, vendorOffers };
  }
}
