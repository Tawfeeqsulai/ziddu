import { prisma } from "@/lib/db/prisma";
import { sharedPrisma } from "@/lib/db/shared-prisma";
import { readStringArray } from "@/lib/db/json";
import { normalizeBusinessCategory, type FeedPost, type Shop } from "@/types/commerce";
import { formatDistanceKm, haversineDistanceKm } from "@/lib/location";
import { normalizeVendorLocation } from "@/lib/vendor-location";
import { mergeHashtags } from "@/lib/hashtag";
import { formatOfferLabel } from "@/lib/offer-label";
import { offerPricing, type OfferPricing } from "@/lib/offer-pricing";
import { getExternalLikesForPosts } from "@/services/likes-api.service";

type OfferValue = { priceInr?: number; originalPriceInr?: number; badge?: string };

export type ShopOffer = { id: string; postId: string; title: string; description?: string; price?: number; originalPrice?: number; badge?: string; validUntil?: string; productName?: string };
export type ShopProduct = { id: string; name: string; description: string; image?: string; price: number; category: string; offer?: OfferPricing };
export type VendorWeekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export type VendorDailyHours = { enabled: boolean; from: string | null; to: string | null };
export type VendorWeeklyHours = Partial<Record<VendorWeekday, VendorDailyHours>>;
export type ShopProfile = { shop: Shop & { description: string; pincode?: string; followerCount: number; workingDays: string[]; workingHours?: VendorWeeklyHours; distanceLabel: string }; posts: FeedPost[]; offers: ShopOffer[]; products: ShopProduct[] };

const VENDOR_WEEKDAYS: VendorWeekday[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

function parseVendorWorkingHours(value: unknown): VendorWeeklyHours | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const result: VendorWeeklyHours = {};
  for (const day of VENDOR_WEEKDAYS) {
    const rawDay = source[day];
    if (!rawDay || typeof rawDay !== "object" || Array.isArray(rawDay)) continue;
    const hours = rawDay as Record<string, unknown>;
    result[day] = {
      enabled: hours.enabled === true || hours.enabled === 1,
      from: typeof hours.from === "string" ? hours.from : null,
      to: typeof hours.to === "string" ? hours.to : null,
    };
  }
  return Object.keys(result).length > 0 ? result : undefined;
}

function vendorLocalTime(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "0";
  const weekday = get("weekday").toLowerCase().slice(0, 3) as VendorWeekday;
  return { weekday, minutes: Number(get("hour")) * 60 + Number(get("minute")) };
}

function vendorTimeMinutes(value: string | null) {
  if (!value) return null;
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] ?? 0);
  const meridiem = match[3]?.toLowerCase();
  if (hour > 23 || minute > 59 || (meridiem && (hour < 1 || hour > 12))) return null;
  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;
  return hour * 60 + minute;
}

function isVendorOpenNow(status: string, schedule: VendorWeeklyHours | undefined, now: Date) {
  if (status.toLowerCase() === "inactive") return false;
  const { weekday, minutes } = vendorLocalTime(now);
  const today = schedule?.[weekday];
  if (!today) return true;
  if (!today.enabled) return false;
  const opens = vendorTimeMinutes(today.from);
  const closes = vendorTimeMinutes(today.to);
  if (opens === null || closes === null) return true;
  return opens <= closes ? minutes >= opens && minutes < closes : minutes >= opens || minutes < closes;
}

function formatVendorTime(value: string | null) {
  return value?.replace(/\b(am|pm)\b/gi, (period) => period.toUpperCase()) ?? "";
}

function getOfferValues(value: unknown): OfferValue {
  return value && typeof value === "object" ? value as OfferValue : {};
}

async function getSharedShopProfile(id: string, userId?: string): Promise<ShopProfile | null> {
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

  const viewer = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { city: true, locality: true, latitude: true, longitude: true } }) : null;
  const postIds = record.posts.map((post) => String(post.id));
  const engagementClient = prisma as unknown as {
    feedInteraction?: typeof prisma.feedInteraction;
    feedShare?: typeof prisma.feedShare;
  };
  const [interactions, shares, externalLikes] = postIds.length > 0 ? await Promise.all([
    engagementClient.feedInteraction ? engagementClient.feedInteraction.findMany({ where: { targetType: "POST", targetId: { in: postIds }, active: true }, select: { targetId: true, userId: true, action: true } }).catch(() => []) : Promise.resolve([]),
    engagementClient.feedShare ? engagementClient.feedShare.groupBy({ by: ["targetId"], where: { targetType: "POST", targetId: { in: postIds } }, _count: { _all: true } }).catch(() => []) : Promise.resolve([]),
    getExternalLikesForPosts(userId, postIds),
  ]) : [[], [], new Map()];
  const engagementByPost = new Map<string, { likes: number; saves: number; directions: number; liked: boolean; saved: boolean }>();
  for (const interaction of interactions) {
    const summary = engagementByPost.get(interaction.targetId) ?? { likes: 0, saves: 0, directions: 0, liked: false, saved: false };
    if (interaction.action === "LIKE") { summary.likes += 1; if (interaction.userId === userId) summary.liked = true; }
    if (interaction.action === "SAVE") { summary.saves += 1; if (interaction.userId === userId) summary.saved = true; }
    if (interaction.action === "DIRECTION") summary.directions += 1;
    engagementByPost.set(interaction.targetId, summary);
  }
  const shareCounts = new Map(shares.map((item) => [item.targetId, item._count._all]));

  const name = record.businessName?.trim() || `Vendor ${record.id}`;
  const location = normalizeVendorLocation(record.address);
  const category = normalizeBusinessCategory(record.businessCategory);
  const workingHours = parseVendorWorkingHours(record.workingDays);
  const today = workingHours?.[vendorLocalTime(new Date()).weekday];
  const businessHours = today
    ? !today.enabled ? "Closed today" : today.from && today.to ? `${formatVendorTime(today.from)} – ${formatVendorTime(today.to)}` : "Hours unavailable"
    : workingHours ? "Hours unavailable" : undefined;
  const shop: Shop & { description: string; pincode?: string; followerCount: number; workingDays: string[]; workingHours?: VendorWeeklyHours; distanceLabel: string } = {
    id: String(record.id), name, handle: `vendor-${record.id}`, category, distance: formatDistanceKm(haversineDistanceKm(viewer ?? {}, location)) ?? "Nearby", area: location.locality, city: location.city, state: "",
    status: isVendorOpenNow(record.status, workingHours, new Date()) ? "Open now" : "Closed", businessHours, rating: 0,
    initials: name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase(), image: record.logoUrl || "/ziddu-logo.png",
    address: location.address, owner: "", phone: record.user.phoneNumber || undefined, description: "", followerCount: 0,
    latitude: location.latitude, longitude: location.longitude,
    workingDays: workingHours ? VENDOR_WEEKDAYS.filter((day) => workingHours[day]?.enabled) : readStringArray(record.workingDays), workingHours, distanceLabel: formatDistanceKm(haversineDistanceKm(viewer ?? {}, location)) ? `${formatDistanceKm(haversineDistanceKm(viewer ?? {}, location))} away` : "Nearby",
  };
  const posts: FeedPost[] = record.posts.map((post) => {
    const mediaType = post.postType.toLowerCase() === "video" ? "video" as const : "image" as const;
    const title = `${name} ${post.postCategory || "update"}`;
    const values = getOfferValues(post.offer?.offerValue);
    const targetType = post.offer?.offerTargetType?.toUpperCase();
    const productName = post.offer?.offerTargetId && (!targetType || /ITEM|PRODUCT/.test(targetType)) ? record.menuItems.find((item) => item.id === post.offer?.offerTargetId)?.productName : undefined;
    const engagement = engagementByPost.get(String(post.id));
    const externalLike = externalLikes.get(String(post.id));
    return {
      id: String(post.id), shopId: String(record.id), kind: post.isOfferIncluded ? "offer" as const : mediaType === "video" ? "reel" as const : "post" as const,
      title, description: `${name} shared a new ${post.postCategory || "post"}.`, image: post.postUrl, imageAlt: title, likes: externalLike?.likeCount ?? engagement?.likes ?? 0, saves: engagement?.saves ?? 0, shares: shareCounts.get(String(post.id)) ?? 0, directionCount: engagement?.directions ?? 0,
      publishedAt: (post.createdAt ?? new Date()).toISOString(), mediaType, mediaUrl: mediaType === "video" ? post.postUrl : undefined,
      hashtags: mergeHashtags(post.postCategory ? [`#${post.postCategory.replace(/\s+/g, "")}`] : [], productName), price: values.priceInr,
      originalPrice: values.originalPriceInr, badge: post.isOfferIncluded ? formatOfferLabel({ offerType: post.offer?.offerType, offerValue: post.offer?.offerValue, badge: values.badge, productName, price: values.priceInr, originalPrice: values.originalPriceInr, category: post.postCategory }) : undefined, offerValidUntil: post.offer?.validityTo?.toISOString(), liked: externalLike?.liked ?? engagement?.liked ?? false, saved: engagement?.saved ?? false,
    };
  });
  const offers: ShopOffer[] = record.offers.map((offer) => {
    const values = getOfferValues(offer.offerValue);
    const post = offer.posts[0];
    return {
      id: String(offer.id), postId: post ? String(post.id) : String(offer.id), title: `${name} offer`, description: `A ${offer.offerType.toLowerCase()} offer from ${name}.`,
      price: values.priceInr, originalPrice: values.originalPriceInr, badge: formatOfferLabel({ offerType: offer.offerType, offerValue: offer.offerValue, badge: values.badge, productName: offer.offerTargetId && (!offer.offerTargetType || /ITEM|PRODUCT/i.test(offer.offerTargetType)) ? record.menuItems.find((item) => item.id === offer.offerTargetId)?.productName : undefined, price: values.priceInr, originalPrice: values.originalPriceInr }),
      productName: offer.offerTargetId && (!offer.offerTargetType || /ITEM|PRODUCT/i.test(offer.offerTargetType)) ? record.menuItems.find((item) => item.id === offer.offerTargetId)?.productName : undefined,
      validUntil: offer.validityTo?.toISOString(),
    };
  });
  const now = new Date();
  const products: ShopProduct[] = record.menuItems.map((item) => {
    const activeOffer = record.offers.find((offer) => {
      const type = offer.offerTargetType?.toUpperCase();
      return Number(offer.offerTargetId) === Number(item.id) && (!type || /ITEM|PRODUCT|MENU/.test(type)) && (!offer.validityFrom || offer.validityFrom <= now) && (!offer.validityTo || offer.validityTo >= now);
    });
    const values = getOfferValues(activeOffer?.offerValue);
    return {
      id: String(item.id), name: item.productName, description: `${item.productName} from ${name}.`, image: item.image || undefined,
      price: Number(item.price), category: item.category.categoryName,
      offer: activeOffer ? { ...offerPricing(activeOffer.offerType, activeOffer.offerValue), badge: formatOfferLabel({ offerType: activeOffer.offerType, offerValue: activeOffer.offerValue, badge: values.badge, productName: item.productName, price: values.priceInr, originalPrice: values.originalPriceInr }) } : undefined,
    };
  });
  return { shop, posts, offers, products };
}

export async function getShopProfile(id: string, userId?: string): Promise<ShopProfile | null> {
  if (/^\d+$/.test(id)) return getSharedShopProfile(id, userId);
  const viewer = userId ? await prisma.user.findUnique({ where: { id: userId }, select: { city: true, locality: true, latitude: true, longitude: true } }) : null;
  const record = await prisma.shop.findUnique({
      where: { id },
      include: {
        location: true,
        follows: { where: { userId: userId ?? "__public_profile__" }, select: { id: true } },
        _count: { select: { follows: true } },
        offers: { include: { product: true, posts: { take: 1 } }, orderBy: { validityTo: "asc" } },
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
            offer: { include: { product: { select: { priceInr: true, name: true } } } },
            _count: { select: { likes: true, saves: true } },
            likes: userId ? { where: { userId }, select: { id: true } } : false,
            saves: userId ? { where: { userId }, select: { id: true } } : false,
          },
        },
      },
  });
  if (!record) return null;

    const localPostIds = record.posts.map((post) => post.id);
    const interactionClient = prisma as unknown as { feedInteraction?: typeof prisma.feedInteraction };
    const directionInteractions = localPostIds.length > 0 && interactionClient.feedInteraction
      ? await interactionClient.feedInteraction.findMany({ where: { targetType: "POST", targetId: { in: localPostIds }, action: "DIRECTION", active: true }, select: { targetId: true } }).catch(() => [])
      : [];
    const directionCounts = new Map<string, number>();
    for (const interaction of directionInteractions) directionCounts.set(interaction.targetId, (directionCounts.get(interaction.targetId) ?? 0) + 1);

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
  return {
        id: post.id,
        shopId: record.id,
        kind: post.isOfferIncluded ? "offer" as const : post.type === "VIDEO" ? "reel" as const : "post" as const,
        title: post.title,
        description: post.description,
        image: post.thumbnailUrl ?? post.mediaUrl,
        imageAlt: post.altText ?? post.title,
        likes: post._count.likes,
        saves: post._count.saves,
        directionCount: directionCounts.get(post.id) ?? 0,
        publishedAt: post.publishedAt.toISOString(),
        mediaType: post.type === "VIDEO" ? "video" as const : "image" as const,
        mediaUrl: post.type === "VIDEO" ? post.mediaUrl : undefined,
        hashtags: mergeHashtags(readStringArray(post.hashtags), post.offer?.product?.name),
        price,
        originalPrice: offer.originalPriceInr,
        badge: post.isOfferIncluded ? formatOfferLabel({ offerType: post.offer?.offerType, offerValue: post.offer?.offerValue, badge: offer.badge, productName: post.offer?.product?.name, price, originalPrice: offer.originalPriceInr, category: post.postCategory }) : undefined,
        offerValidUntil: post.offer?.validityTo.toISOString(),
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
      offers: record.offers.map((offer) => { const values = getOfferValues(offer.offerValue); const post = offer.posts[0]; return { id: String(offer.id), postId: post?.id ?? offer.id, title: post?.title ?? offer.product?.name ?? "Local offer", description: post?.description ?? offer.product?.description, price: values.priceInr ?? offer.product?.priceInr, originalPrice: values.originalPriceInr, badge: formatOfferLabel({ offerType: offer.offerType, offerValue: offer.offerValue, badge: values.badge, productName: offer.product?.name, price: values.priceInr ?? offer.product?.priceInr, originalPrice: values.originalPriceInr }), validUntil: offer.validityTo.toISOString(), productName: offer.product?.name }; }),
      products: record.products.map((product) => {
        const offer = getOfferValues(product.offers[0]?.offerValue);
        return {
          id: product.id,
          name: product.name,
          description: product.description,
          image: product.imageUrl ?? undefined,
          price: product.priceInr,
          category: product.menuCategory?.name ?? "Popular picks",
          offer: product.offers[0] ? { ...offerPricing(product.offers[0].offerType, product.offers[0].offerValue), badge: formatOfferLabel({ offerType: product.offers[0].offerType, offerValue: product.offers[0].offerValue, badge: offer.badge, productName: product.name, price: offer.priceInr, originalPrice: offer.originalPriceInr }) } : undefined,
        };
      }),
  };
}
