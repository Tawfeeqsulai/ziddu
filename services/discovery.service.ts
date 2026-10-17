import type { DiscoveryData } from "@/types/commerce";
import { prisma } from "@/lib/db/prisma";
import { sharedPrisma } from "@/lib/db/shared-prisma";
import { readStringArray } from "@/lib/db/json";
import { formatDistanceKm, haversineDistanceKm } from "@/lib/location";

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
  offer: { offerValue: unknown; product: { priceInr: number } | null } | null;
  _count: { likes: number };
  likes: Array<{ id: string }>;
  saves: Array<{ id: string }>;
}>, userLocation?: { latitude?: number | null; longitude?: number | null }): DiscoveryData {
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
        publishedAt: post.publishedAt.toISOString(),
        mediaType: post.type === "VIDEO" ? "video" as const : "image" as const,
        mediaUrl: post.type === "VIDEO" ? post.mediaUrl : undefined,
        hashtags: readStringArray(post.hashtags),
        price,
        originalPrice: values.originalPriceInr,
        badge: values.badge,
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

async function getSharedDiscoveryData(): Promise<DiscoveryData> {
  const records = await sharedPrisma.sharedPost.findMany({
    orderBy: { createdAt: "desc" },
    include: { vendor: { include: { user: true } }, offer: true },
  });

  const shops = Array.from(new Map(records.map((record) => [record.vendor.id, record.vendor])).values()).map((vendor) => {
    const name = vendor.businessName?.trim() || `Vendor ${vendor.id}`;
    const category = vendor.businessCategory?.toUpperCase();
    const normalizedCategory = category === "RESTAURANT" || category === "FURNITURE" || category === "ELECTRONICS" ? category : "RESTAURANT";
    return {
      id: String(vendor.id), name, handle: `vendor-${vendor.id}`, category: normalizedCategory,
      distance: "Nearby", area: "", city: "", state: "", status: vendor.status.toLowerCase() === "inactive" ? "Closed" as const : "Open now" as const,
      rating: 0, initials: name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(),
      image: vendor.logoUrl || "/ziddu-logo.png", address: vendor.address || "", owner: "", phone: vendor.user.phoneNumber,
    } satisfies DiscoveryData["shops"][number];
  });
  const posts = records.map((record) => {
    const offerValue = record.offer?.offerValue && typeof record.offer.offerValue === "object" ? record.offer.offerValue as { priceInr?: number; originalPriceInr?: number; badge?: string } : {};
    const mediaType = record.postType.toLowerCase() === "video" ? "video" as const : "image" as const;
    const title = `${record.vendor.businessName || "Local vendor"} ${record.postCategory || "update"}`;
    return {
      id: String(record.id), shopId: String(record.vendorId), kind: record.isOfferIncluded ? "offer" as const : mediaType === "video" ? "reel" as const : "post" as const,
      title, description: `${record.vendor.businessName || "Local vendor"} shared a new ${record.postCategory || "post"}.`, image: record.postUrl, imageAlt: title,
      likes: 0, publishedAt: (record.createdAt ?? new Date()).toISOString(), mediaType, mediaUrl: mediaType === "video" ? record.postUrl : undefined,
      hashtags: record.postCategory ? [`#${record.postCategory.replace(/\s+/g, "")}`] : [], price: offerValue.priceInr,
      originalPrice: offerValue.originalPriceInr, badge: offerValue.badge, liked: false, saved: false,
    } satisfies DiscoveryData["posts"][number];
  });
  return { shops, posts, stories: [], purchases: [] };
}

export async function getDiscoveryData(userId: string): Promise<DiscoveryData> {
  void userId;
  try {
    return await getSharedDiscoveryData();
  } catch (error) {
    console.error("Unable to load shared discovery data.", error);
    return getLegacyDiscoveryData(userId);
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
        offer: { include: { product: { select: { priceInr: true } } } },
        _count: { select: { likes: true } },
        likes: { where: { userId }, select: { id: true } },
        saves: { where: { userId }, select: { id: true } },
      },
    });
    return mapDatabaseData(posts, user ?? undefined);
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
        offer: { include: { product: { select: { priceInr: true } } } },
        _count: { select: { likes: true } },
        likes: { where: { userId }, select: { id: true } },
        saves: { where: { userId }, select: { id: true } },
      },
    });
    return mapDatabaseData(posts, user ?? undefined);
  } catch (error) {
    console.error("Unable to load saved data.", error);
    throw error;
  }
}
