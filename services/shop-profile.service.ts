import { prisma } from "@/lib/db/prisma";
import { sharedPrisma } from "@/lib/db/shared-prisma";
import { readStringArray } from "@/lib/db/json";
import type { FeedPost, Shop } from "@/types/commerce";
import { formatDistanceKm, haversineDistanceKm } from "@/lib/location";

type OfferValue = { priceInr?: number; originalPriceInr?: number; badge?: string };

export type ShopOffer = { postId: string; title: string; description?: string; price?: number; originalPrice?: number; badge?: string; validUntil?: string; productName?: string };
export type ShopProduct = { id: string; name: string; description: string; image?: string; price: number; category: string; offer?: { price?: number; originalPrice?: number; badge?: string } };
export type ShopProfile = { shop: Shop & { description: string; pincode?: string; followerCount: number; workingDays: string[]; distanceLabel: string }; posts: FeedPost[]; offers: ShopOffer[]; products: ShopProduct[] };

function getOfferValues(value: unknown): OfferValue {
  return value && typeof value === "object" ? value as OfferValue : {};
}

async function getSharedShopProfile(id: string): Promise<ShopProfile | null> {
  const vendorId = Number.parseInt(id, 10);
  if (!Number.isInteger(vendorId)) return null;
  let record = await sharedPrisma.sharedVendor.findUnique({
    where: { id: vendorId },
    include: {
      user: true,
      posts: { orderBy: { createdAt: "desc" }, include: { offer: true } },
      offers: { include: { posts: true }, orderBy: { validityTo: "asc" } },
      menuItems: { include: { category: true }, orderBy: { productName: "asc" } },
    },
  });
  if (!record) {
    const linkedPost = await sharedPrisma.sharedPost.findUnique({ where: { id: vendorId }, select: { vendorId: true } });
    if (linkedPost) {
      record = await sharedPrisma.sharedVendor.findUnique({
        where: { id: linkedPost.vendorId },
        include: {
          user: true,
          posts: { orderBy: { createdAt: "desc" }, include: { offer: true } },
          offers: { include: { posts: true }, orderBy: { validityTo: "asc" } },
          menuItems: { include: { category: true }, orderBy: { productName: "asc" } },
        },
      });
    }
  }
  if (!record) return null;

  const name = record.businessName?.trim() || `Vendor ${record.id}`;
  const rawCategory = record.businessCategory?.toUpperCase();
  const category = rawCategory === "RESTAURANT" || rawCategory === "FURNITURE" || rawCategory === "ELECTRONICS" ? rawCategory : "RESTAURANT";
  const shop: Shop & { description: string; pincode?: string; followerCount: number; workingDays: string[]; distanceLabel: string } = {
    id: String(record.id), name, handle: `vendor-${record.id}`, category, distance: "Nearby", area: "", city: "", state: "",
    status: record.status.toLowerCase() === "inactive" ? "Closed" : "Open now", rating: 0,
    initials: name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(), image: record.logoUrl || "/ziddu-logo.png",
    address: record.address || "", owner: "", phone: record.user.phoneNumber || undefined, description: "", followerCount: 0,
    workingDays: readStringArray(record.workingDays), distanceLabel: "Nearby",
  };
  const posts: FeedPost[] = record.posts.map((post) => {
    const mediaType = post.postType.toLowerCase() === "video" ? "video" as const : "image" as const;
    const title = `${name} ${post.postCategory || "update"}`;
    const values = getOfferValues(post.offer?.offerValue);
    return {
      id: String(post.id), shopId: String(record.id), kind: post.isOfferIncluded ? "offer" as const : mediaType === "video" ? "reel" as const : "post" as const,
      title, description: `${name} shared a new ${post.postCategory || "post"}.`, image: post.postUrl, imageAlt: title, likes: 0,
      publishedAt: (post.createdAt ?? new Date()).toISOString(), mediaType, mediaUrl: mediaType === "video" ? post.postUrl : undefined,
      hashtags: post.postCategory ? [`#${post.postCategory.replace(/\s+/g, "")}`] : [], price: values.priceInr,
      originalPrice: values.originalPriceInr, badge: values.badge, liked: false, saved: false,
    };
  });
  const offers: ShopOffer[] = record.offers.map((offer) => {
    const values = getOfferValues(offer.offerValue);
    const post = offer.posts[0];
    return {
      postId: post ? String(post.id) : String(offer.id), title: `${name} offer`, description: `A ${offer.offerType.toLowerCase()} offer from ${name}.`,
      price: values.priceInr, originalPrice: values.originalPriceInr, badge: values.badge,
      validUntil: offer.validityTo?.toISOString(),
    };
  });
  const products: ShopProduct[] = record.menuItems.map((item) => ({
    id: String(item.id), name: item.productName, description: `${item.productName} from ${name}.`, image: item.image || undefined,
    price: Number(item.price), category: item.category.categoryName,
  }));
  return { shop, posts, offers, products };
}

export async function getShopProfile(id: string, userId?: string): Promise<ShopProfile | null> {
  if (/^\d+$/.test(id)) return getSharedShopProfile(id);
  const viewer = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { city: true, locality: true, latitude: true, longitude: true } }) : null;
  const record = await prisma.shop.findUnique({
      where: { id },
      include: {
        location: true,
        follows: { where: { userId: userId ?? "__public_profile__" }, select: { id: true } },
        _count: { select: { follows: true } },
        offers: { where: { validityFrom: { lte: new Date() }, validityTo: { gte: new Date() } }, include: { product: true, posts: { take: 1 } } },
        products: {
          where: { isAvailable: true },
          orderBy: { name: "asc" },
          include: {
            menuCategory: { select: { name: true } },
            offers: { where: { validityFrom: { lte: new Date() }, validityTo: { gte: new Date() } }, take: 1 },
          },
        },
        posts: {
          orderBy: { publishedAt: "desc" },
          include: {
            offer: { include: { product: { select: { priceInr: true } } } },
            _count: { select: { likes: true } },
            likes: userId ? { where: { userId }, select: { id: true } } : false,
            saves: userId ? { where: { userId }, select: { id: true } } : false,
          },
        },
      },
  });
  if (!record) return null;

    const now = new Date();
    const actualDistance = formatDistanceKm(haversineDistanceKm(viewer ?? {}, record.location));
    const distanceLabel = actualDistance
      ? `${actualDistance} away`
      : viewer?.locality && viewer.locality.toLowerCase() === record.location.locality.toLowerCase()
        ? "In your area"
        : viewer?.city && viewer.city.toLowerCase() === record.location.city.toLowerCase()
          ? "In your city"
          : "";
    const posts = record.posts.map((post) => {
      const offer = getOfferValues(post.offer?.offerValue);
      const price = offer.priceInr ?? post.offer?.product?.priceInr;
      const activeOffer = Boolean(post.offer && post.offer.validityFrom <= now && post.offer.validityTo >= now);
  return {
        id: post.id,
        shopId: record.id,
        kind: post.isOfferIncluded && activeOffer ? "offer" as const : post.type === "VIDEO" ? "reel" as const : "post" as const,
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
        originalPrice: offer.originalPriceInr,
        badge: offer.badge,
        liked: Array.isArray(post.likes) && post.likes.length > 0,
        saved: Array.isArray(post.saves) && post.saves.length > 0,
      } satisfies FeedPost;
    });

    return {
      shop: {
        id: record.id,
        name: record.name,
        handle: record.handle,
        category: record.category,
        distance: actualDistance ?? "Nearby",
        area: record.location.locality,
        city: record.location.city,
        state: record.location.state,
        status: record.status.toLowerCase().includes("close") ? "Closed" : "Open now",
        rating: record.rating,
        initials: record.initials,
        image: record.image,
        coverImage: record.coverImage ?? undefined,
        address: record.location.address,
        owner: "",
        phone: record.phone ?? undefined,
        followed: record.follows.length > 0,
        description: record.description ?? "",
        businessHours: record.businessHours ?? undefined,
        latitude: record.location.latitude ?? undefined,
        longitude: record.location.longitude ?? undefined,
        pincode: record.location.pincode ?? undefined,
        followerCount: record._count.follows,
        workingDays: readStringArray(record.workingDays),
        distanceLabel,
      },
      posts,
      offers: record.offers.map((offer) => { const values = getOfferValues(offer.offerValue); const post = offer.posts[0]; return { postId: post?.id ?? offer.id, title: post?.title ?? offer.product?.name ?? "Local offer", description: post?.description ?? offer.product?.description, price: values.priceInr ?? offer.product?.priceInr, originalPrice: values.originalPriceInr, badge: values.badge, validUntil: offer.validityTo.toISOString(), productName: offer.product?.name }; }),
      products: record.products.map((product) => {
        const offer = getOfferValues(product.offers[0]?.offerValue);
        return {
          id: product.id,
          name: product.name,
          description: product.description,
          image: product.imageUrl ?? undefined,
          price: product.priceInr,
          category: product.menuCategory?.name ?? "Popular picks",
          offer: product.offers[0] ? { price: offer.priceInr, originalPrice: offer.originalPriceInr, badge: offer.badge } : undefined,
        };
      }),
  };
}
