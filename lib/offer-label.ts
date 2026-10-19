type OfferLabelInput = {
  offerType?: string | null;
  offerValue?: unknown;
  badge?: string;
  productName?: string;
  price?: number;
  originalPrice?: number;
  category?: string | null;
};

export function formatOfferLabel(input: OfferLabelInput) {
  const details = input.offerValue && typeof input.offerValue === "object" && !Array.isArray(input.offerValue)
    ? input.offerValue as Record<string, unknown>
    : {};
  const badge = input.badge?.trim();
  const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
  const isCategory = badge && input.category && normalize(badge) === normalize(input.category);
  if (badge && !isCategory) return badge;

  const numberFor = (keys: string[]) => {
    for (const key of keys) {
      const value = Number(details[key]);
      if (Number.isFinite(value) && value > 0) return value;
    }
    return undefined;
  };
  const type = input.offerType?.toUpperCase();
  if (type === "BUY_GET") {
    const buy = numberFor(["buyQuantity", "buy_quantity", "buyCount", "buy_count", "buy", "quantity"]);
    const get = numberFor(["getQuantity", "get_quantity", "getCount", "get_count", "freeQuantity", "free_quantity", "get", "free"]);
    if (buy && get) return `Buy ${buy} Get ${get}`;
    return "Buy & Get";
  }
  if (type === "PERCENTAGE") {
    const percent = numberFor(["discountPercent", "discount_percent", "percentage", "percent", "discount"]);
    if (percent) return `${percent}% OFF`;
  }
  if (input.price != null && input.originalPrice != null && input.originalPrice > input.price) {
    if (type === "PERCENTAGE") return `${Math.round((1 - input.price / input.originalPrice) * 100)}% OFF`;
    return `₹${Math.round(input.originalPrice - input.price)} OFF`;
  }
  return input.productName ? `${input.productName} Deal` : "Special Deal";
}
