import { prisma } from "@/lib/db/prisma";
import { sharedPrisma } from "@/lib/db/shared-prisma";
import { formatDistanceKm, haversineDistanceKm } from "@/lib/location";
import { normalizeVendorLocation } from "@/lib/vendor-location";
import { mergeHashtags } from "@/lib/hashtag";
import { formatOfferLabel } from "@/lib/offer-label";
import { normalizeBusinessCategory, type DiscoveryData, type FeedPost, type Shop } from "@/types/commerce";

const VENDOR_POSTS_API = "https://zoggy-backend-api.vercel.app/api/vendorposts";

type VendorPostRecord = {
  id: number | string;
  vendor_id: number | string;
  post_type?: string | null;
  post_category?: string | null;
  post_url?: string | null;
  is_offer_included?: boolean | number | null;
  offer_id?: number | string | null;
  created_at?: string | null;
  vendor?: {
    id: number | string;
    business_name?: string | null;
    business_category?: string | null;
    logo_url?: string | null;
    address?: unknown;
    status?: string | null;
  } | null;
};

type OfferValue = { priceInr?: number; originalPriceInr?: number; badge?: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isVendorPost(value: unknown): value is VendorPostRecord {
  return isRecord(value) && (typeof value.id === "number" || typeof value.id === "string") &&
    (typeof value.vendor_id === "number" || typeof value.vendor_id === "string") &&
    (typeof value.post_url === "string" || value.post_url == null);
}

function offerValue(value: unknown): OfferValue {
  if (!isRecord(value)) return {};
  const priceInr = Number(value.priceInr);
  const originalPriceInr = Number(value.originalPriceInr);
  return {
    ...(Number.isFinite(priceInr) ? { priceInr } : {}),
    ...(Number.isFinite(originalPriceInr) ? { originalPriceInr } : {}),
    ...(typeof value.badge === "string" ? { badge: value.badge } : {}),
  };
}

export async function getVendorPostsFromApi(userId: string): Promise<DiscoveryData> {
  const response = await fetch(VENDOR_POSTS_API, {
    next: { revalidate: 5 },
    signal: AbortSignal.timeout(8_000),
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`Vendor posts API returned ${response.status}.`);

  const payload: unknown = await response.json();
  if (!isRecord(payload) || payload.success !== true || !Array.isArray(payload.data)) {
    throw new Error("Vendor posts API returned an unexpected response.");
  }

  const records = payload.data.filter(isVendorPost).filter((post) => Boolean(post.post_url?.trim()));
  const offerIds = [...new Set(records.map((post) => Number(post.offer_id)).filter((id) => Number.isInteger(id) && id > 0))];
  const [profile, offers] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { latitude: true, longitude: true } }).catch(() => null),
    offerIds.length ? sharedPrisma.sharedOffer.findMany({ where: { id: { in: offerIds } } }).catch(() => []) : Promise.resolve([]),
  ]);
  const targetItemIds = [...new Set(offers
    .filter((offer) => !offer.offerTargetType || /ITEM|PRODUCT/i.test(offer.offerTargetType))
    .map((offer) => offer.offerTargetId)
    .filter((id): id is number => id != null))];
  const menuItems = targetItemIds.length ? await sharedPrisma.sharedMenuItem.findMany({ where: { id: { in: targetItemIds } }, select: { id: true, productName: true } }).catch(() => []) : [];
  const offerById = new Map(offers.map((offer) => [offer.id, offer]));
  const productById = new Map(menuItems.map((item) => [item.id, item.productName]));
  const vendorById = new Map<number, Shop>();

  for (const post of records) {
    const vendor = post.vendor;
    if (!vendor) continue;
    const id = String(vendor.id);
    if (vendorById.has(Number(id))) continue;
    const location = normalizeVendorLocation(vendor.address);
    const name = vendor.business_name?.trim() || `Vendor ${id}`;
    const normalizedLocation = {
      latitude: location.latitude ?? null,
      longitude: location.longitude ?? null,
    };
    vendorById.set(Number(id), {
      id,
      name,
      handle: `vendor-${id}`,
      category: normalizeBusinessCategory(vendor.business_category),
      distance: formatDistanceKm(haversineDistanceKm(profile ?? {}, normalizedLocation)) ?? "Nearby",
      area: location.locality,
      city: location.city,
      state: "",
      status: vendor.status?.toLowerCase() === "inactive" ? "Closed" : "Open now",
      rating: 0,
      initials: name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(),
      image: vendor.logo_url || "/ziddu-logo.png",
      address: location.address,
      owner: "",
      latitude: location.latitude,
      longitude: location.longitude,
    });
  }

  const posts: FeedPost[] = records.flatMap((record) => {
    const vendorId = Number(record.vendor_id);
    const shop = vendorById.get(vendorId);
    const mediaUrl = record.post_url?.trim();
    if (!shop || !mediaUrl) return [];

    const id = String(record.id);
    const isVideo = record.post_type?.toLowerCase() === "video";
    const isOffer = record.is_offer_included === true || Number(record.is_offer_included) === 1;
    const offerId = Number(record.offer_id);
    const offer = Number.isInteger(offerId) ? offerById.get(offerId) : undefined;
    if (isOffer && offer?.validityTo && offer.validityTo.getTime() < Date.now()) return [];
    const values = offerValue(offer?.offerValue);
    const offerTargetId = offer?.offerTargetId;
    const productName = offerTargetId == null ? undefined : productById.get(offerTargetId);
    const category = record.post_category?.trim() || "update";
    const title = `${shop.name} ${category}`;
    const tags = [category.startsWith("#") ? category : `#${category.replace(/\s+/g, "")}`];

    return [{
      id,
      shopId: String(vendorId),
      kind: isOffer ? "offer" : isVideo ? "reel" : "post",
      title,
      description: `${shop.name} shared a new ${category}.`,
      image: mediaUrl,
      imageAlt: title,
      likes: 0,
      saves: 0,
      shares: 0,
      publishedAt: record.created_at && Number.isFinite(Date.parse(record.created_at)) ? new Date(record.created_at).toISOString() : new Date().toISOString(),
      mediaType: isVideo ? "video" : "image",
      ...(isVideo ? { mediaUrl } : {}),
      hashtags: mergeHashtags(tags, productName),
      price: values.priceInr,
      originalPrice: values.originalPriceInr,
      badge: isOffer ? formatOfferLabel({ offerType: offer?.offerType, offerValue: offer?.offerValue, badge: values.badge, productName, price: values.priceInr, originalPrice: values.originalPriceInr, category }) : undefined,
      offerValidUntil: offer?.validityTo?.toISOString(),
    } satisfies FeedPost];
  });

  // Resolve engagement from the app's database where available. Missing tables
  // or an older generated client should not prevent API-sourced posts rendering.
  const appPrisma = prisma as unknown as {
    feedInteraction?: typeof prisma.feedInteraction;
    feedShare?: typeof prisma.feedShare;
  };
  const postIds = posts.map((post) => post.id);
  const [interactions, shares] = await Promise.all([
    postIds.length && appPrisma.feedInteraction ? appPrisma.feedInteraction.findMany({ where: { targetType: "POST", targetId: { in: postIds }, active: true }, select: { targetId: true, userId: true, action: true } }).catch(() => []) : Promise.resolve([]),
    postIds.length && appPrisma.feedShare ? appPrisma.feedShare.groupBy({ by: ["targetId"], where: { targetType: "POST", targetId: { in: postIds } }, _count: { _all: true } }).catch(() => []) : Promise.resolve([]),
  ]);
  const engagement = new Map<string, { likes: number; saves: number; directions: number; liked: boolean; saved: boolean }>();
  for (const interaction of interactions) {
    const row = engagement.get(interaction.targetId) ?? { likes: 0, saves: 0, directions: 0, liked: false, saved: false };
    if (interaction.action === "LIKE") { row.likes += 1; row.liked ||= interaction.userId === userId; }
    if (interaction.action === "SAVE") { row.saves += 1; row.saved ||= interaction.userId === userId; }
    if (interaction.action === "DIRECTION") row.directions += 1;
    engagement.set(interaction.targetId, row);
  }
  const shareCounts = new Map(shares.map((share) => [share.targetId, share._count._all]));
  for (const post of posts) {
    const row = engagement.get(post.id);
    post.likes = row?.likes ?? 0;
    post.saves = row?.saves ?? 0;
    post.shares = shareCounts.get(post.id) ?? 0;
    post.directionCount = row?.directions ?? 0;
    post.liked = row?.liked ?? false;
    post.saved = row?.saved ?? false;
  }

  const shops = [...vendorById.values()];
  return {
    shops,
    posts: posts.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)),
    stories: [],
    purchases: [],
  };
}
