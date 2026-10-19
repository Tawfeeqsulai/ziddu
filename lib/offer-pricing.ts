export type OfferPricing = {
  type?: string;
  price?: number;
  originalPrice?: number;
  badge?: string;
  buyQuantity?: number;
  getQuantity?: number;
  discountPercent?: number;
};

function positiveNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function readNumber(source: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = positiveNumber(source[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

export function offerPricing(type: string | null | undefined, value: unknown, badge?: string): OfferPricing | undefined {
  if (!type) return undefined;
  const details = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    type: type.toUpperCase(),
    price: positiveNumber(details.priceInr ?? details.price),
    originalPrice: positiveNumber(details.originalPriceInr ?? details.originalPrice),
    badge,
    buyQuantity: readNumber(details, ["buyQuantity", "buy_quantity", "buyCount", "buy_count", "buy", "quantity"]),
    getQuantity: readNumber(details, ["getQuantity", "get_quantity", "getCount", "get_count", "freeQuantity", "free_quantity", "get", "free"]),
    discountPercent: readNumber(details, ["discountPercent", "discount_percent", "percentage", "percent", "discount"]),
  };
}

export function calculateOfferLine(basePrice: number, quantity: number, offer?: OfferPricing) {
  const type = offer?.type?.toUpperCase();
  const buyQuantity = offer?.buyQuantity ?? (type === "BUY_GET" ? 1 : 0);
  const getQuantity = offer?.getQuantity ?? (type === "BUY_GET" ? 1 : 0);
  const freeQuantity = type === "BUY_GET" && buyQuantity > 0
    ? Math.floor(quantity / buyQuantity) * getQuantity
    : 0;
  const regularPrice = offer?.originalPrice ?? basePrice;
  let unitPrice = offer?.price ?? basePrice;
  if (type === "BUY_GET") unitPrice = regularPrice;
  else if (type === "PERCENTAGE" && offer?.price === undefined && offer?.discountPercent) {
    unitPrice = Math.max(0, regularPrice * (1 - offer.discountPercent / 100));
  }
  const billedQuantity = quantity + freeQuantity;
  const subtotal = regularPrice * billedQuantity;
  const total = unitPrice * quantity;
  const savings = Math.max(0, subtotal - total);
  return { unitPrice, regularPrice, freeQuantity, billedQuantity, subtotal, savings, total };
}
