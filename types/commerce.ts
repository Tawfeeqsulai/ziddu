export const BUSINESS_CATEGORIES = [
  "RESTAURANT",
  "FURNITURE",
  "ELECTRONICS",
] as const;

export type BusinessCategory = (typeof BUSINESS_CATEGORIES)[number];
export type ShopCategory = BusinessCategory | "CLOTHS";

export const BUSINESS_CATEGORY_LABELS: Record<ShopCategory, string> = {
  RESTAURANT: "Restaurants",
  FURNITURE: "Furniture",
  ELECTRONICS: "Electronics",
  CLOTHS: "Cloths",
};

export function normalizeBusinessCategory(value: string | null | undefined): ShopCategory {
  const category = value?.trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (category === "FURNITURE") return "FURNITURE";
  if (["ELECTRONICS", "ELECTRONIC"].includes(category ?? "") || /ELECTRONIC|GADGET/.test(category ?? "")) return "ELECTRONICS";
  if (["CLOTH", "CLOTHS", "CLOTHING", "CLOTHES", "APPAREL", "FASHION", "TEXTILE", "TEXTILES"].includes(category ?? "") || /CLOTH|FASHION|APPAREL|TEXTILE/.test(category ?? "")) return "CLOTHS";
  if (/FURNITURE/.test(category ?? "")) return "FURNITURE";
  if (/RESTAURANT|FOOD|CAFE|BAKERY/.test(category ?? "")) return "RESTAURANT";
  return "RESTAURANT";
}

export type Shop = {
  id: string;
  name: string;
  handle: string;
  category: ShopCategory;
  distance: string;
  area: string;
  city: string;
  state: string;
  status: "Open now" | "Closed";
  rating: number;
  initials: string;
  image: string;
  coverImage?: string;
  address: string;
  owner: string;
  phone?: string;
  description?: string;
  businessHours?: string;
  followed?: boolean;
  followerCount?: number;
  latitude?: number;
  longitude?: number;
};

export type FeedPost = {
  id: string;
  shopId: string;
  kind: "post" | "reel" | "offer";
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  likes: number;
  publishedAt: string;
  mediaType: "image" | "video";
  mediaUrl?: string;
  hashtags: string[];
  price?: number;
  originalPrice?: number;
  badge?: string;
  offerValidUntil?: string;
  liked?: boolean;
  saved?: boolean;
};

export type Purchase = {
  id: string;
  shopId: string;
  item: string;
  date: string;
  total: number;
  status: "Paid" | "Ready for pickup";
};

export type DiscoveryData = {
  shops: Shop[];
  posts: FeedPost[];
  stories: Array<{ shopId: string; postId: string }>;
  purchases: Purchase[];
};
