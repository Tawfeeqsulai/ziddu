"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, CalendarDays, MapPin, PackageCheck, ShoppingBag } from "lucide-react";
import { useState } from "react";
import type { PurchaseHistoryRecord, PurchaseHistoryResponse } from "@/services/purchase-history.service";

type HistoryRange = "all" | "weekly" | "daily";
type PurchaseHistoryExperienceProps = { history: Record<HistoryRange, PurchaseHistoryResponse> };

const ranges: { value: HistoryRange; label: string }[] = [
  { value: "all", label: "All history" },
  { value: "weekly", label: "This week" },
  { value: "daily", label: "Today" },
];

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function dateLabel(value: string | null) {
  if (!value) return "Purchase history";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function isPaidStatus(status: string) {
  return ["paid", "success", "completed"].includes(status.toLowerCase());
}

function HistoryCard({ purchase, expanded, onToggle }: { purchase: PurchaseHistoryRecord; expanded: boolean; onToggle: () => void }) {
  const paid = isPaidStatus(purchase.status);
  return <article className={`purchase-history-card${paid ? " is-paid" : ""}${expanded ? " is-expanded" : ""}`} onClick={onToggle} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onToggle(); } }} role="button" tabIndex={0}>
    <div className="purchase-history-card-top">
      <div className="purchase-history-shop-mark">{purchase.logoUrl ? <Image alt="" height={42} src={purchase.logoUrl} unoptimized width={42} /> : <ShoppingBag aria-hidden="true" size={19} />}</div>
      <div className="purchase-history-shop-copy"><strong>{purchase.shopName}</strong><span><MapPin aria-hidden="true" size={12} /> {purchase.address}</span><small>{purchase.category} · {dateLabel(purchase.date)}</small></div>
      <span className={`purchase-history-bill${paid ? " is-paid" : ""}`}>Bill #{purchase.billId}</span>
    </div>
    <div className="purchase-history-products">{purchase.products.length ? purchase.products.map((product, index) => <div className="purchase-history-product" key={`${purchase.billId}-${product.itemId ?? index}`}><span>Item {product.itemId ?? "purchase"} <small>× {product.quantity}</small></span><strong>{money(product.total)}</strong></div>) : <div className="purchase-history-product"><span>Shop purchase</span><strong>{money(purchase.total)}</strong></div>}</div>
    {expanded && <div className="purchase-history-expanded"><strong>Order details</strong>{purchase.products.map((product, index) => <div key={`detail-${purchase.billId}-${product.itemId ?? index}`}><span>{product.itemName ?? `Item ${product.itemId ?? "purchase"}`} · {money(product.price)} each × {product.quantity}</span><b>{money(product.total)}</b></div>)}<span>Status: {purchase.status}</span><span>Address: {purchase.address}</span></div>}
    <div className="purchase-history-total"><span>{paid ? "Paid" : "Payment pending"}</span><strong>{money(purchase.total)}</strong></div>
  </article>;
}

export default function PurchaseHistoryExperience({ history }: PurchaseHistoryExperienceProps) {
  const [range, setRange] = useState<HistoryRange>("all");
  const [expandedBill, setExpandedBill] = useState<string | null>(null);
  const selected = history[range];
  const total = selected.records.reduce((sum, purchase) => sum + purchase.total, 0);
  const unpaidOrders = selected.records.filter((purchase) => !isPaidStatus(purchase.status));
  const paidOrders = selected.records.filter((purchase) => isPaidStatus(purchase.status));
  const renderOrders = (orders: PurchaseHistoryRecord[]) => <div className="purchase-history-list">{orders.map((purchase) => <HistoryCard expanded={expandedBill === purchase.billId} key={`${purchase.billId}-${purchase.vendorId}`} onToggle={() => setExpandedBill((current) => current === purchase.billId ? null : purchase.billId)} purchase={purchase} />)}</div>;
  return <main className="orders-page purchase-history-page">
    <header className="orders-header purchase-history-header"><Link aria-label="Go back" className="purchase-history-back" href="/profile">‹</Link><h1>Purchase history</h1></header>
    <section className="purchase-history-content">
      <div className="purchase-history-intro"><div><span className="section-kicker">YOUR ORDERS</span><h2>Every shop, every purchase</h2><p>See what you ordered across local shops.</p></div><CalendarDays aria-hidden="true" size={25} /></div>
      <div aria-label="Purchase history range" className="purchase-history-tabs" role="tablist">{ranges.map((item) => <button aria-selected={range === item.value} className={range === item.value ? "is-active" : ""} key={item.value} onClick={() => setRange(item.value)} role="tab" type="button">{item.label}</button>)}</div>
      {selected.unavailable && <p className="purchase-history-notice" role="status">Purchase history is temporarily unavailable. Please try again shortly.</p>}
      {selected.records.length === 0 ? <div className="orders-empty purchase-history-empty"><PackageCheck aria-hidden="true" size={30} /><h2>No purchases in this period</h2><p>Your orders from every shop will appear here.</p><Link className="confirm-button" href="/">Explore shops <ArrowUpRight size={15} /></Link></div> : <><div className="purchase-history-summary"><span>{selected.records.length} {selected.records.length === 1 ? "order" : "orders"}</span><strong>{money(total)}</strong></div>{unpaidOrders.length > 0 && <section className="purchase-history-group" aria-labelledby="unpaid-orders-title"><h2 id="unpaid-orders-title">Unpaid orders</h2>{renderOrders(unpaidOrders)}</section>}{paidOrders.length > 0 && <section className="purchase-history-group" aria-labelledby="paid-orders-title"><h2 id="paid-orders-title">Paid orders</h2>{renderOrders(paidOrders)}</section>}</>}
    </section>
  </main>;
}
