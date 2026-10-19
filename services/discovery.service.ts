import { normalizeBusinessCategory, type DiscoveryData } from "@/types/commerce";
import { prisma } from "@/lib/db/prisma";
import { sharedPrisma } from "@/lib/db/shared-prisma";
import { readStringArray } from "@/lib/db/json";
import { formatDistanceKm, haversineDistanceKm } from "@/lib/location";
import { normalizeVendorLocation } from "@/lib/vendor-location";
import { mergeHashtags } from "@/lib/hashtag";
import { formatOfferLabel } from "@/lib/offer-label";
import { getVendorPostsFromApi } from "@/services/vendor-posts-api.service";

type OfferValue = { priceInr?: number; originalPriceInr?: number; badge?: string };

function offerValues(value: unknown): OfferValue {
  if (!value || typeof value !== "object") return {};
  return value as OfferValue;
}

function mapDatabaseData(posts: Array<{
  id: string;
  type: "IMAGE" | "VIDEO";
  title: string;
  description: string;
  mediaUrl: string;
  thumbnailUrl: string | null;
  altText: string | null;
  hashtags: unknown;
  publishedAt: Date;
  isOfferIncluded: boolean;
  shop: {
    id: string;
    name: string;
    handle: string;
    category: "RESTAURANT" | "FURNITURE" | "ELECTRONICS";
    status: string;
    rating: number;
    initials: string;
    image: string;
    phone: string | null;
    location: { address: string; locality: string; city: string; state: string; latitude: number | null; longitude: number | null };
    follows: Array<{ id: string }>;
    _count: { follows: number };
  };
  offer: { offerType: string; offerValue: unknown; validityTo: Date; product: { priceInr: number; name: string } | null } | null;
  _count: { likes: number; saves: number };
  likes: Array<{ id: string }>;
  saves: Array<{ id: string }>;
}>, userLocation?: { latitude?: number | null; longitude?: number | null }, shareCounts = new Map<string, number>()): DiscoveryData {
  const shops = Array.from(new Map(posts.map(({ shop }) => [shop.id, shop])).values()).map((shop) => ({
    id: shop.id,
    name: shop.name,
    handle: shop.handle,
    category: shop.category,
    distance: formatDistanceKm(haversineDistanceKm(userLocation ?? {}, { latitude: shop.location.latitude, longitude: shop.location.longitude })) ?? "Nearby",
    area: shop.location.locality,
    city: shop.location.city,
    state: shop.location.state,
    status: shop.status.toLowerCase().includes("close") ? "Closed" as const : "Open now" as const,
    rating: shop.rating,
    initials: shop.initials,
    image: shop.image,
    address: shop.location.address,
    owner: "",
    phone: shop.phone ?? undefined,
    followed: shop.follows.length > 0,
    followerCount: shop._count.follows,
    latitude: shop.location.latitude ?? undefined,
    longitude: shop.location.longitude ?? undefined,
  }));

  return {
    shops,
    posts: posts.map((post) => {
      const values = offerValues(post.offer?.offerValue);
      const price = values.priceInr ?? post.offer?.product?.priceInr;
      return {
        id: post.id,
        shopId: post.shop.id,
        kind: post.isOfferIncluded ? "offer" as const : post.type === "VIDEO" ? "reel" as const : "post" as const,
        title: post.title,
        description: post.description,
        image: post.thumbnailUrl ?? post.mediaUrl,
        imageAlt: post.altText ?? post.title,
        likes: post._count.likes,
        saves: post._count.saves,
        shares: shareCounts.get(post.id) ?? 0,
        publishedAt: post.publishedAt.toISOString(),
        mediaType: post.type === "VIDEO" ? "video" as const : "image" as const,
        mediaUrl: post.type === "VIDEO" ? post.mediaUrl : undefined,
        hashtags: mergeHashtags(readStringArray(post.hashtags), post.offer?.product?.name),
        price,
        originalPrice: values.originalPriceInr,
        badge: values.badge ?? (post.isOfferIncluded ? post.title : undefined),
        offerValidUntil: post.isOfferIncluded ? post.offer?.validityTo.toISOString() : undefined,
        liked: post.likes.length > 0,
        saved: post.saves.length > 0,
      };
    }),
    stories: Array.from(new Map(
      posts
        .filter((post) => post.type === "VIDEO" && post.shop.follows.length > 0)
        .map((post) => [post.shop.id, { shopId: post.shop.id, postId: post.id }]),
    ).values()),
    purchases: [],
  };
}

async function getSharedDiscoveryData(userId: string): Promise<DiscoveryData> {
  const [records, vendors, profile] = await Promise.all([
    sharedPrisma.sharedPost.findMany({ orderBy: { createdAt: "desc" }, include: { vendor: { include: { user: true } }, offer: true } }),
    sharedPrisma.sharedVendor.findMany({ include: { user: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { latitude: true, longitude: true } }),
  ]);

  const postIds = records.map((record) => String(record.id));
  const vendorIds = [...new Set(records.map((record) => record.vendorId))];
  // Keep discovery available when an already-running server still has an older
  // generated Prisma client that does not expose these optional delegates yet.
  const engagementClient = prisma as unknown as {
    feedInteraction?: typeof prisma.feedInteraction;
    feedShare?: typeof prisma.feedShare;
  };
  const [menuItems, interactions, shares] = await Promise.all([
    vendorIds.length > 0 ? sharedPrisma.sharedMenuItem.findMany({ where: { vendorId: { in: vendorIds } }, select: { id: true, productName: true } }) : Promise.resolve([]),
    postIds.length > 0 && engagementClient.feedInteraction ? engagementClient.feedInteraction.findMany({ where: { targetType: "POST", targetId: { in: postIds }, active: true }, select: { targetId: true, userId: true, action: true } }).catch(() => []) : Promise.resolve([]),
    postIds.length > 0 && engagementClient.feedShare ? engagementClient.feedShare.groupBy({ by: ["targetId"], where: { targetType: "POST", targetId: { in: postIds } }, _count: { _all: true } }).catch(() => []) : Promise.resolve([]),
  ]);
  const engagementByPost = new Map<string, { likes: number; saves: number; directions: number; liked: boolean; saved: boolean }>();
  for (const interaction of interactions) {
    const summary = engagementByPost.get(interaction.targetId) ?? { likes: 0, saves: 0, directions: 0, liked: false, saved: false };
    if (interaction.action === "LIKE") { summary.likes += 1; if (interaction.userId === userId) summary.liked = true; }
    if (interaction.action === "SAVE") { summary.saves += 1; if (interaction.userId === userId) summary.saved = true; }
    if (interaction.action === "DIRECTION") summary.directions += 1;
    engagementByPost.set(interaction.targetId, summary);
  }
  const shareCounts = new Map(shares.map((item) => [item.targetId, item._count._all]));
  const productNames = new Map(menuItems.map((item) => [item.id, item.productName]));

  const shops = vendors.map((vendor) => {
    const location = normalizeVendorLocation(vendor.address);
    const name = vendor.businessName?.trim() || `Vendor ${vendor.id}`;
    const normalizedCategory = normalizeBusinessCategory(vendor.businessCategory);
    return {
      id: String(vendor.id), name, handle: `vendor-${vendor.id}`, category: normalizedCategory,
    distance: formatDistanceKm(haversineDistanceKm(profile ?? {}, location)) ?? "Nearby", area: location.locality, city: location.city, state: "", status: vendor.status.toLowerCase() === "inactive" ? "Closed" as const : "Open now" as const,
      rating: 0, initials: name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(),
      image: vendor.logoUrl || "/ziddu-logo.png", address: location.address, owner: "", phone: vendor.user.phoneNumber,
      latitude: location.latitude, longitude: location.longitude,
    } satisfies DiscoveryData["shops"][number];
  });
  const now = Date.now();
  const posts = records.filter((record) => !record.isOfferIncluded || Boolean(record.offer?.validityTo && record.offer.validityTo.getTime() >= now)).map((record) => {
    const offerValue = record.offer?.offerValue && typeof record.offer.offerValue === "object" ? record.offer.offerValue as { priceInr?: number; originalPriceInr?: number; badge?: string } : {};
    const mediaType = record.postType.toLowerCase() === "video" ? "video" as const : "image" as const;
    const targetType = record.offer?.offerTargetType?.toUpperCase();
    const productName = record.offer?.offerTargetId && (!targetType || /ITEM|PRODUCT/.test(targetType)) ? productNames.get(record.offer.offerTargetId) : undefined;
    const engagement = engagementByPost.get(String(record.id));
    const title = `${record.vendor.businessName || "Local vendor"} ${record.postCategory || "update"}`;
    return {
      id: String(record.id), shopId: String(record.vendorId), kind: record.isOfferIncluded ? "offer" as const : mediaType === "video" ? "reel" as const : "post" as const,
      title, description: `${record.vendor.businessName || "Local vendor"} shared a new ${record.postCategory || "post"}.`, image: record.postUrl, imageAlt: title,
      likes: engagement?.likes ?? 0, saves: engagement?.saves ?? 0, shares: shareCounts.get(String(record.id)) ?? 0, directionCount: engagement?.directions ?? 0,
      publishedAt: (record.createdAt ?? new Date()).toISOString(), mediaType, mediaUrl: mediaType === "video" ? record.postUrl : undefined,
      hashtags: mergeHashtags(record.postCategory ? [record.postCategory.startsWith("#") ? record.postCategory : `#${record.postCategory.replace(/\s+/g, "")}`] : [], productName), price: offerValue.priceInr,
      originalPrice: offerValue.originalPriceInr, badge: record.isOfferIncluded ? formatOfferLabel({ offerType: record.offer?.offerType, offerValue: record.offer?.offerValue, badge: offerValue.badge, productName, price: offerValue.priceInr, originalPrice: offerValue.originalPriceInr, category: record.postCategory }) : undefined, offerValidUntil: record.offer?.validityTo?.toISOString(), liked: engagement?.liked ?? false, saved: engagement?.saved ?? false,
    } satisfies DiscoveryData["posts"][number];
  });
  return { shops, posts, stories: [], purchases: [] };
}

export async function getDiscoveryData(userId: string): Promise<DiscoveryData> {
  try {
    return await getVendorPostsFromApi(userId);
  } catch (error) {
    console.error("Unable to load vendor posts from the API; using the database fallback.", error);
    try {
      return await getSharedDiscoveryData(userId);
    } catch (sharedError) {
      console.error("Unable to load shared discovery data.", sharedError);
      return getLegacyDiscoveryData(userId);
    }
  }
}

async function getLegacyDiscoveryData(userId: string): Promise<DiscoveryData> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { city: true, locality: true, latitude: true, longitude: true } });
    const now = new Date();
    const posts = await prisma.post.findMany({
      where: {
        ...(user?.city ? { shop: { location: { city: user.city } } } : {}),
        OR: [
          { isOfferIncluded: false },
          { isOfferIncluded: true, offer: { is: { validityFrom: { lte: now }, validityTo: { gte: now } } } },
        ],
      },
      orderBy: { publishedAt: "desc" },
      include: {
        shop: { include: { location: true, follows: { where: { userId }, select: { id: true } }, _count: { select: { follows: true } } } },
        offer: { include: { product: { select: { priceInr: true, name: true } } } },
        _count: { select: { likes: true, saves: true } },
        likes: { where: { userId }, select: { id: true } },
        saves: { where: { userId }, select: { id: true } },
      },
    });
    const feedShare = (prisma as unknown as { feedShare?: typeof prisma.feedShare }).feedShare;
    const shares = posts.length > 0 && feedShare ? await feedShare.groupBy({ by: ["targetId"], where: { targetType: "POST", targetId: { in: posts.map((post) => post.id) } }, _count: { _all: true } }).catch(() => []) : [];
    return mapDatabaseData(posts, user ?? undefined, new Map(shares.map((item) => [item.targetId, item._count._all])));
  } catch (error) {
    console.error("Unable to load discovery data.", error);
    throw error;
  }
}

export async function getSavedData(userId: string): Promise<DiscoveryData> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { city: true, locality: true, latitude: true, longitude: true } });
    const posts = await prisma.post.findMany({
      where: { saves: { some: { userId } } },
      orderBy: { publishedAt: "desc" },
      include: {
        shop: { include: { location: true, follows: { where: { userId }, select: { id: true } }, _count: { select: { follows: true } } } },
        offer: { include: { product: { select: { priceInr: true, name: true } } } },
        _count: { select: { likes: true, saves: true } },
        likes: { where: { userId }, select: { id: true } },
        saves: { where: { userId }, select: { id: true } },
      },
    });
    const feedShare = (prisma as unknown as { feedShare?: typeof prisma.feedShare }).feedShare;
    const shares = posts.length > 0 && feedShare ? await feedShare.groupBy({ by: ["targetId"], where: { targetType: "POST", targetId: { in: posts.map((post) => post.id) } }, _count: { _all: true } }).catch(() => []) : [];
    const savedLocalData = mapDatabaseData(posts, user ?? undefined, new Map(shares.map((item) => [item.targetId, item._count._all])));
    let savedVendorData: DiscoveryData | null = null;
    try {
      savedVendorData = await getVendorPostsFromApi(userId);
    } catch {
      // Keep locally saved posts available if the vendor feed API is unavailable.
    }
    if (!savedVendorData) return savedLocalData;

    const localPostIds = new Set(savedLocalData.posts.map((post) => post.id));
    const savedVendorPosts = savedVendorData.posts.filter((post) => post.saved && !localPostIds.has(post.id));
    const localShopIds = new Set(savedLocalData.shops.map((shop) => shop.id));
    const savedVendorShops = savedVendorData.shops.filter((shop) => savedVendorPosts.some((post) => post.shopId === shop.id) && !localShopIds.has(shop.id));
    return {
      ...savedLocalData,
      shops: [...savedLocalData.shops, ...savedVendorShops],
      posts: [...savedLocalData.posts, ...savedVendorPosts].sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)),
    };
  } catch (error) {
    console.error("Unable to load saved data.", error);
    throw error;
  }
}
