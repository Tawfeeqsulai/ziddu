import "server-only";

import { normalizeIndianPhone } from "@/lib/auth/phone";
import { prisma } from "@/lib/db/prisma";

const HISTORY_API_BASE = "https://zoggy-backend-api.vercel.app/api";

export type PurchaseHistoryProduct = {
  itemId: number | null;
  itemName?: string;
  quantity: number;
  price: number;
  total: number;
};

export type PurchaseHistoryRecord = {
  billId: string;
  vendorId: string;
  shopName: string;
  category: string;
  logoUrl: string | null;
  address: string;
  date: string | null;
  status: string;
  products: PurchaseHistoryProduct[];
  total: number;
};

export type PurchaseHistoryResponse = {
  records: PurchaseHistoryRecord[];
  unavailable: boolean;
};

function numberValue(value: unknown, fallback = 0) {
  const result = typeof value === "number" ? value : Number(value);
  return Number.isFinite(result) ? result : fallback;
}

async function addProductNames(records: PurchaseHistoryRecord[]) {
  const vendorIds = [...new Set(records.map((record) => Number(record.vendorId)).filter(Number.isInteger))];
  const itemIds = [...new Set(records.flatMap((record) => record.products.map((product) => product.itemId)).filter((id): id is number => id !== null))];
  if (vendorIds.length === 0 || itemIds.length === 0) return records;
  const items = await prisma.sharedMenuItem.findMany({ where: { vendorId: { in: vendorIds }, id: { in: itemIds } }, select: { vendorId: true, id: true, productName: true } });
  const names = new Map(items.map((item) => [`${item.vendorId}:${item.id}`, item.productName]));
  return records.map((record) => ({ ...record, products: record.products.map((product) => ({ ...product, itemName: product.itemId === null ? undefined : names.get(`${record.vendorId}:${product.itemId}`) })) }));
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function parseAddress(value: unknown) {
  if (typeof value !== "string") return "Address unavailable";
  try {
    const parsed = JSON.parse(value) as { text?: unknown };
    return stringValue(parsed.text, value);
  } catch {
    return value;
  }
}

function normalizeRecord(value: unknown): PurchaseHistoryRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const rawProducts = Array.isArray(record.products) ? record.products : [];
  const products = rawProducts.flatMap((product) => {
    if (!product || typeof product !== "object") return [];
    const item = product as Record<string, unknown>;
    const quantity = Math.max(1, numberValue(item.quantity, 1));
    const price = numberValue(item.price);
    return [{
      itemId: item.item_id == null ? null : numberValue(item.item_id),
      quantity,
      price,
      total: numberValue(item.total_price, price * quantity),
    }];
  });
  const total = numberValue(record.total_price, products.reduce((sum, product) => sum + product.total, 0));
  return {
    billId: stringValue(record.bill_id, "Purchase"),
    vendorId: stringValue(record.vendor_id),
    shopName: stringValue(record.restaurant_name, "Local shop"),
    category: stringValue(record.restaurant_category, "Local business"),
    logoUrl: typeof record.restaurant_logo_url === "string" ? record.restaurant_logo_url : null,
    address: parseAddress(record.restaurant_address),
    date: stringValue(record.created_at || record.createdAt || record.bill_date || record.order_date, "") || null,
    status: stringValue(record.payment_status || record.paymentStatus, "paid").toLowerCase(),
    products,
    total,
  };
}

async function fetchHistory(endpoint: string, userId: number): Promise<PurchaseHistoryResponse> {
  try {
    const response = await fetch(`${HISTORY_API_BASE}/${endpoint}?user_id=${userId}`, { cache: "no-store", headers: { Accept: "application/json" } });
    if (!response.ok) return { records: [], unavailable: true };
    const payload = await response.json() as { data?: unknown };
    const data = Array.isArray(payload.data) ? payload.data : [];
    return { records: data.map(normalizeRecord).filter((record): record is PurchaseHistoryRecord => record !== null), unavailable: false };
  } catch {
    return { records: [], unavailable: true };
  }
}

function sameDay(first: string | null, second: Date) {
  if (!first) return false;
  const date = new Date(first);
  return !Number.isNaN(date.getTime()) && date.toDateString() === second.toDateString();
}

function withinLastSevenDays(dateValue: string | null, now: Date) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  const start = new Date(now);
  start.setDate(start.getDate() - 6);
  start.setHours(0, 0, 0, 0);
  return date >= start && date <= now;
}

export async function getPurchaseHistory(userId: string) {
  const account = await prisma.user.findUnique({ where: { id: userId }, select: { phoneNumber: true } });
  const phoneNumber = normalizeIndianPhone(account?.phoneNumber ?? "");
  if (!phoneNumber) return { all: { records: [], unavailable: false }, weekly: { records: [], unavailable: false }, daily: { records: [], unavailable: false } };

  const nationalNumber = phoneNumber.slice(3);
  const phoneVariants = [phoneNumber, nationalNumber, `91${nationalNumber}`, `0${nationalNumber}`];
  const orderingUser = await prisma.sharedUser.findFirst({ where: { phoneNumber: { in: phoneVariants } }, select: { id: true } });
  if (!orderingUser) return { all: { records: [], unavailable: false }, weekly: { records: [], unavailable: false }, daily: { records: [], unavailable: false } };

  const [all, weeklyResult, dailyResult] = await Promise.all([
    fetchHistory("userpurchasehistoryall", orderingUser.id),
    fetchHistory("userpurchasehistoryweekly", orderingUser.id),
    fetchHistory("userpurchasehistorydaily", orderingUser.id),
  ]);
  const now = new Date();
  const weekly = weeklyResult.unavailable ? { records: all.records.filter((record) => withinLastSevenDays(record.date, now)), unavailable: false } : weeklyResult;
  const daily = dailyResult.unavailable ? { records: all.records.filter((record) => sameDay(record.date, now)), unavailable: false } : dailyResult;
  const [allWithNames, weeklyWithNames, dailyWithNames] = await Promise.all([addProductNames(all.records), addProductNames(weekly.records), addProductNames(daily.records)]);
  all.records = allWithNames;
  weekly.records = weeklyWithNames;
  daily.records = dailyWithNames;
  return { all, weekly, daily };
}
