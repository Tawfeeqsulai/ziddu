import { prisma } from "@/lib/db/prisma";
import { readStringArray } from "@/lib/db/json";
import { getDiscoveryData } from "@/services/discovery.service";
import type { FeedPost, Shop } from "@/types/commerce";

export const REELS_PAGE_SIZE = 6;
export type ReelItem = { post: FeedPost; shop: Shop; followed: boolean };
export type ReelsResult = { reels: ReelItem[]; hasMore: boolean; failed?: boolean };

type OfferValue = { priceInr?: number; originalPriceInr?: number; badge?: string };
function offerValue(value: unknown): OfferValue {
  return value && typeof value === "object" ? value as OfferValue : {};
}

function shopView(shop: {
  id: string; name: string; handle: string; category: Shop["category"]; status: string; rating: number; initials: string; image: string; phone: string | null; description: string | null;
  location: { address: string; locality: string; city: string; state: string; latitude: number | null; longitude: number | null };
}): Shop {
  return {
    id: shop.id, name: shop.name, handle: shop.handle, category: shop.category, distance: "Nearby", area: shop.location.locality, city: shop.location.city, state: shop.location.state,
    status: shop.status.toLowerCase().includes("close") ? "Closed" : "Open now", rating: shop.rating, initials: shop.initials, image: shop.image,
    address: shop.location.address, owner: "ZIDDU partner", phone: shop.phone ?? "+91 00000 00000", latitude: shop.location.latitude ?? undefined, longitude: shop.location.longitude ?? undefined, description: shop.description ?? undefined,
  };
}

function mapDemoReels(data: Awaited<ReturnType<typeof getDiscoveryData>>, page: number, postId?: string): ReelsResult {
  const reels = data.posts.filter((post) => post.mediaType === "video" || post.kind === "reel");
  const selected = postId ? reels.find((post) => post.id === postId) : undefined;
  const ordered = selected ? [selected, ...reels.filter((post) => post.id !== postId)] : reels;
  const start = selected ? 0 : (page - 1) * REELS_PAGE_SIZE;
  const items = ordered.slice(start, start + REELS_PAGE_SIZE).map((post) => {
    const shop = data.shops.find((item) => item.id === post.shopId);
    return shop ? { post, shop, followed: Boolean(shop.followed) } : null;
  }).filter((item): item is ReelItem => item !== null);
  return { reels: items, hasMore: start + REELS_PAGE_SIZE < reels.length };
}

export async function getReels(userId: string, page = 1, postId?: string): Promise<ReelsResult> {
  const safePage = Math.max(1, Math.min(page, 20));
  const skip = (safePage - 1) * REELS_PAGE_SIZE;
  try {
    const sharedData = await getDiscoveryData(userId);
    const sharedReels = sharedData.posts
      .filter((post) => post.mediaType === "video" || post.kind === "reel")
      .map((post) => {
        const shop = sharedData.shops.find((item) => item.id === post.shopId);
        return shop ? { post, shop, followed: Boolean(shop.followed) } : null;
      })
      .filter((item): item is ReelItem => item !== null);
    if (sharedReels.length > 0) {
      const selected = postId ? sharedReels.find((item) => item.post.id === postId) : undefined;
      const ordered = selected ? [selected, ...sharedReels.filter((item) => item.post.id !== postId)] : sharedReels;
      const items = ordered.slice(skip, skip + REELS_PAGE_SIZE);
      return { reels: items, hasMore: skip + REELS_PAGE_SIZE < ordered.length };
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { city: true } });
    const now = new Date();
    const baseWhere = {
      type: "VIDEO" as const,
      OR: [
        { isOfferIncluded: false },
        { isOfferIncluded: true, offer: { is: { validityFrom: { lte: now }, validityTo: { gte: now } } } },
      ],
    };
    const localWhere = user?.city ? { ...baseWhere, shop: { location: { city: { contains: user.city } } } } : baseWhere;
    const include = {
      shop: { include: { location: true, follows: { where: { userId }, select: { id: true } } } },
      offer: { include: { product: { select: { priceInr: true } } } },
      _count: { select: { likes: true } },
      likes: { where: { userId }, select: { id: true } },
      saves: { where: { userId }, select: { id: true } },
    };
    let records = await prisma.post.findMany({
      where: localWhere,
      orderBy: { publishedAt: "desc" },
      skip,
      take: REELS_PAGE_SIZE,
      include,
    });
    if (records.length === 0 && safePage === 1 && user?.city) {
      records = await prisma.post.findMany({ where: baseWhere, orderBy: { publishedAt: "desc" }, take: REELS_PAGE_SIZE, include });
    }
    if (postId && safePage === 1 && !records.some((record) => record.id === postId)) {
      const selected = await prisma.post.findFirst({ where: { ...localWhere, id: postId }, include });
      if (selected) records = [selected, ...records].slice(0, REELS_PAGE_SIZE);
    }
    const reels = records.map((record) => {
      const values = offerValue(record.offer?.offerValue);
      const shop = shopView(record.shop);
      return {
        shop,
        followed: record.shop.follows.length > 0,
        post: {
          id: record.id, shopId: record.shopId, kind: record.isOfferIncluded ? "offer" as const : "reel" as const, title: record.title, description: record.description,
          image: record.thumbnailUrl ?? record.mediaUrl, imageAlt: record.altText ?? record.title, likes: record._count.likes, publishedAt: record.publishedAt.toISOString(), mediaType: "video" as const,
          mediaUrl: record.mediaUrl, hashtags: readStringArray(record.hashtags), price: values.priceInr ?? record.offer?.product?.priceInr, originalPrice: values.originalPriceInr, badge: values.badge,
          liked: record.likes.length > 0, saved: record.saves.length > 0,
        } satisfies FeedPost,
      };
    });
    return { reels, hasMore: records.length === REELS_PAGE_SIZE };
  } catch {
    return mapDemoReels(await getDiscoveryData(userId), safePage, postId);
  }
}
