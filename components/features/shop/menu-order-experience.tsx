"use client";

import { ArrowLeft, Check, ChevronRight, Clock3, Minus, Plus, Search, ShieldCheck, ShoppingBag, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { ShopProduct, ShopProfile } from "@/services/shop-profile.service";
import type { PurchaseHistoryRecord } from "@/services/purchase-history.service";

type MenuOrderExperienceProps = { shop: ShopProfile["shop"]; products: ShopProduct[]; authenticated: boolean; existingOrder?: PurchaseHistoryRecord; onClose?: () => void };
type OrderView = "menu" | "cart" | "confirmation" | "bill";

function money(value: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

export default function MenuOrderExperience({ shop, products, authenticated, existingOrder, onClose }: MenuOrderExperienceProps) {
  const router = useRouter();
  const [view, setView] = useState<OrderView>("menu");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState("");
  const categories = useMemo(() => ["All", ...Array.from(new Set(products.map((product) => product.category)))], [products]);
  const visibleProducts = products.filter((product) => {
    const matchesCategory = category === "All" || product.category === category;
    const searchable = `${product.name} ${product.description}`.toLowerCase();
    return matchesCategory && searchable.includes(query.toLowerCase());
  });
  const cartItems = products.filter((product) => (quantities[product.id] ?? 0) > 0);
  const subtotal = cartItems.reduce((total, product) => total + (product.offer?.price ?? product.price) * quantities[product.id], 0);
  const total = subtotal;
  const itemCount = cartItems.reduce((count, product) => count + quantities[product.id], 0);
  const orderNumber = existingOrder?.billId ?? `ZD${shop.id.replace(/\D/g, "").padStart(6, "0").slice(-6)}`;

  function changeQuantity(product: ShopProduct, change: number) {
    setQuantities((current) => {
      const next = Math.max(0, (current[product.id] ?? 0) + change);
      const updated = { ...current };
      if (next === 0) delete updated[product.id];
      else updated[product.id] = next;
      return updated;
    });
  }

  function goBack() {
    setView(view === "cart" ? "menu" : view === "bill" ? "confirmation" : "menu");
  }

  async function placeOrder() {
    if (!authenticated) {
      router.push("/login");
      return;
    }
    setSubmitting(true);
    setOrderError("");
    try {
      const response = await fetch(existingOrder ? `/api/userbilling/${existingOrder.billId}` : "/api/userbilling", {
        method: existingOrder ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(existingOrder ? { vendorId: shop.id, requestId: window.crypto.randomUUID(), items: cartItems.map((product) => ({ itemId: product.id, quantity: quantities[product.id] })) } : { vendorId: shop.id, items: cartItems.map((product) => ({ itemId: product.id, quantity: quantities[product.id] })) }),
      });
      const result = await response.json().catch(() => null) as { message?: string } | null;
      if (response.status === 401) {
        router.push("/login");
        return;
      }
      if (!response.ok) throw new Error(result?.message ?? "Could not place your order.");
      setView("confirmation");
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : "Could not place your order.");
    } finally {
      setSubmitting(false);
    }
  }

  if (view === "confirmation") {
    return <section className="menu-order-flow" aria-labelledby="order-confirmation-title"><button aria-label="Close menu" className="menu-sheet-close" onClick={onClose} type="button"><X size={20} /></button>
      <div className="order-success-illustration"><Sparkles size={22} /><span><Check size={30} /></span></div>
      <h2 id="order-confirmation-title">{existingOrder ? "Order Updated!" : "Order Sent!"}</h2>
      <p className="menu-order-muted">Your order has been sent to<br /><strong>{shop.name}</strong> kitchen.</p>
      <div className="order-confirmation-card"><div className="order-confirmation-line"><ShoppingBag size={17} /><strong>Order #{orderNumber}</strong></div><span><Clock3 size={14} /> Item preparation status</span><strong className="order-time">Preparing </strong><small className="order-live"><span /> Live on Vendor Screen</small></div>
      <button className="menu-primary-button" onClick={() => setView("bill")} type="button">View Bill <ChevronRight size={17} /></button>
      <button className="menu-secondary-button" onClick={() => setView("menu")} type="button">Add More Items</button>
    </section>;
  }

  if (view === "bill") {
    return <section className="menu-order-flow bill-view" aria-labelledby="bill-title"><button aria-label="Close menu" className="menu-sheet-close" onClick={onClose} type="button"><X size={20} /></button>
      <button className="menu-back-button" onClick={goBack} type="button"><ArrowLeft size={16} /> Your Bill</button>
      <div className="bill-card"><div className="bill-shop-heading"><span className="bill-shop-mark">✺</span><div><strong>{shop.name}</strong><small>Order #{orderNumber}</small><small>Today, just now</small></div></div>{cartItems.map((product) => <div className="bill-line" key={product.id}><span>{product.name} <small>× {quantities[product.id]}</small></span><strong>{money((product.offer?.price ?? product.price) * quantities[product.id])}</strong></div>)}<div className="bill-divider" /><div className="bill-line"><span>Subtotal</span><span>{money(subtotal)}</span></div><div className="bill-total"><span>Total</span><strong>{money(total)}</strong></div><div className="bill-verified"><ShieldCheck size={14} /> Verified by {shop.name}</div></div>
      <div className="bill-actions"><button className="menu-primary-button" onClick={() => setView("menu")} type="button">Pay Now</button><button className="menu-secondary-button" onClick={() => setView("menu")} type="button">Split Bill</button></div>
    </section>;
  }

  if (view === "cart") {
    return <section className="menu-order-flow cart-view" aria-labelledby="cart-title"><button aria-label="Close menu" className="menu-sheet-close" onClick={onClose} type="button"><X size={20} /></button>
      <button className="menu-back-button" onClick={goBack} type="button"><ArrowLeft size={16} /> <span id="cart-title">Your Cart</span></button>
      <div className="cart-items">{cartItems.map((product) => <article className="cart-item" key={product.id}><div className="cart-item-image" style={{ backgroundImage: `url("${product.image ?? "/ziddu-logo.png"}")` }} /><div className="cart-item-copy"><strong>{product.name}</strong><small>{money(product.offer?.price ?? product.price)} × {quantities[product.id]}</small><div className="quantity-control"><button aria-label={`Remove one ${product.name}`} onClick={() => changeQuantity(product, -1)} type="button"><Minus size={13} /></button><span>{quantities[product.id]}</span><button aria-label={`Add one ${product.name}`} onClick={() => changeQuantity(product, 1)} type="button"><Plus size={13} /></button></div></div><strong className="cart-item-total">{money((product.offer?.price ?? product.price) * quantities[product.id])}</strong></article>)}</div>
      <textarea aria-label="Special instructions" className="cart-instructions" onChange={(event) => setInstructions(event.target.value)} placeholder="Add special instructions..." value={instructions} />
      <div className="cart-summary"><div><span>Subtotal</span><strong>{money(subtotal)}</strong></div><div className="cart-grand-total"><span>Total</span><strong>{money(total)}</strong></div></div>
      {orderError && <p aria-live="polite" className="order-error" role="alert">{orderError}</p>}
      <button className="menu-primary-button" disabled={submitting} onClick={() => { void placeOrder(); }} type="button">{submitting ? "Sending order..." : "Place Order"}</button>
    </section>;
  }

  return <section className="menu-order-flow menu-view" aria-labelledby="menu-order-title"><button aria-label="Close menu" className="menu-sheet-close" onClick={onClose} type="button"><X size={20} /></button>
    <div className="menu-search"><Search size={15} /><input aria-label="Search menu items" onChange={(event) => setQuery(event.target.value)} placeholder="Search menu items..." value={query} /></div>
    <div className="menu-categories" role="tablist" aria-label="Menu categories">{categories.map((item) => <button aria-selected={category === item} className={category === item ? "is-active" : ""} key={item} onClick={() => setCategory(item)} role="tab" type="button">{item}</button>)}</div>
    <div className="menu-order-heading"><div><span className="section-kicker">ORDER FRESH</span><h2 id="menu-order-title">{category === "All" ? "Popular picks" : category}</h2></div><span>{products.length} items</span></div>
    {visibleProducts.length === 0 ? <p className="shop-compact-empty">No menu items match your search.</p> : <div className="menu-product-list">{visibleProducts.map((product) => { const quantity = quantities[product.id] ?? 0; const price = product.offer?.price ?? product.price; return <article className="menu-product-card" key={product.id}><div className="menu-product-image" style={{ backgroundImage: `url("${product.image ?? "/ziddu-logo.png"}")` }} /><div className="menu-product-details"><strong>{product.name}</strong><p>{product.description}</p><b>{money(price)}</b>{product.offer?.originalPrice && <del>{money(product.offer.originalPrice)}</del>}</div>{quantity === 0 ? <button aria-label={`Add ${product.name}`} className="menu-add-button" onClick={() => changeQuantity(product, 1)} type="button">Add</button> : <div className="quantity-control menu-quantity"><button aria-label={`Remove one ${product.name}`} onClick={() => changeQuantity(product, -1)} type="button"><Minus size={13} /></button><span>{quantity}</span><button aria-label={`Add one ${product.name}`} onClick={() => changeQuantity(product, 1)} type="button"><Plus size={13} /></button></div>}</article>; })}</div>}
    {itemCount > 0 && <button className="sticky-cart-bar" onClick={() => setView("cart")} type="button"><span><ShoppingBag size={16} /> {itemCount} {itemCount === 1 ? "item" : "items"} | {money(total)}</span><strong>View Cart <ChevronRight size={15} /></strong></button>}
  </section>;
}
