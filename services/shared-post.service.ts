import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import { normalizeVendorLocation } from "@/lib/vendor-location";

export type SharedPostView = {
  id: number;
  type: "poster" | "video";
  mediaUrl: string;
  category: string | null;
  createdAt: Date | null;
  shop: {
    id: string;
    name: string;
    logoUrl: string | null;
    address: string;
  };
  offer: {
    label: string;
    productName: string | null;
    validTill: Date | null;
    ended: boolean;
  } | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

/** The offer in words, from the stored offer_value (same rules as the vendor app's posters). */
function offerLabel(offerType: string, offerValue: unknown): string {
  const value = isRecord(offerValue) ? offerValue : {};
  const type = offerType.toLowerCase();
  if (type === "percentage" && Number(value.percentage) > 0) return `${Number(value.percentage)}% OFF`;
  if (type === "fixed" && Number(value.amount) > 0) return `FLAT ₹${Number(value.amount)} OFF`;
  if (type === "buy_get") {
    const buy = isRecord(value.buy) ? Number(value.buy.quantity) : NaN;
    const get = isRecord(value.get) ? Number(value.get.quantity) : NaN;
    if (buy > 0 && get > 0) return `BUY ${buy} GET ${get} FREE`;
    return "Buy & Get offer";
  }
  return "Special offer";
}

/** Only real links are shown: the poster image must be an http(s) URL. */
function publicMediaUrl(url: string | null | undefined): string | null {
  const value = url?.trim();
  return value && /^https?:\/\//i.test(value) ? value : null;
}

/**
 * One vendor post for its public share page, or null when there is no such
 * post. Wrapped in cache() so the page and its metadata share one query.
 */
export const getSharedPost = cache(async (id: number): Promise<SharedPostView | null> => {
  const post = await prisma.sharedPost.findUnique({
    where: { id },
    include: {
      vendor: { select: { id: true, businessName: true, logoUrl: true, address: true, status: true } },
      offer: true,
    },
  });
  if (!post) return null;

  const mediaUrl = publicMediaUrl(post.postUrl);
  if (!mediaUrl || post.vendor.status?.toLowerCase() === "inactive") return null;

  let offer: SharedPostView["offer"] = null;
  if (post.isOfferIncluded && post.offer) {
    const targetIsItem = !post.offer.offerTargetType || /^item$/i.test(post.offer.offerTargetType);
    const product = targetIsItem && post.offer.offerTargetId
      ? await prisma.sharedMenuItem.findUnique({ where: { id: post.offer.offerTargetId }, select: { productName: true } }).catch(() => null)
      : null;
    offer = {
      label: offerLabel(post.offer.offerType, post.offer.offerValue),
      productName: product?.productName ?? null,
      validTill: post.offer.validityTo,
      ended: Boolean(post.offer.validityTo && post.offer.validityTo < new Date()),
    };
  }

  const location = normalizeVendorLocation(post.vendor.address);
  const logo = post.vendor.logoUrl?.trim();
  // The stored address often already ends with the locality and city
  const address = [location.locality, location.city].reduce<string>((line, part) => {
    if (!part || line.toLowerCase().includes(part.toLowerCase())) return line;
    return line ? `${line}, ${part}` : part;
  }, location.address ?? "");

  return {
    id: post.id,
    type: post.postType?.toLowerCase() === "video" ? "video" : "poster",
    mediaUrl,
    category: post.postCategory,
    createdAt: post.createdAt,
    shop: {
      id: String(post.vendor.id),
      name: post.vendor.businessName?.trim() || `Shop ${post.vendor.id}`,
      // base64 logos are left out: too large to inline, and not a public link
      logoUrl: logo && /^https?:\/\//i.test(logo) ? logo : null,
      address,
    },
    offer,
  };
});
