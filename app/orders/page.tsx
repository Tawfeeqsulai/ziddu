import Link from "next/link";
import { ArrowUpRight, MapPin, PackageCheck } from "lucide-react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { BackButton } from "@/components/ui/back-button";

function orderCode(id: string) { return `ZIDDU-${id.slice(-8).toUpperCase()}`; }
function statusLabel(status: string) { return status === "PAID" ? "SUCCESS" : status; }

export default async function OrdersPage() {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    const orders = await prisma.bill.findMany({ where: { endUserId: user.id }, orderBy: { createdAt: "desc" }, take: 50, include: { shop: { include: { location: true } } } });
    return <main className="orders-page"><header className="orders-header"><BackButton label="Go back" /><div><span className="section-kicker">ZIDDU ACCOUNT</span><h1>Your Orders</h1></div></header><section className="orders-content">{orders.length === 0 ? <div className="orders-empty"><PackageCheck size={30} /><h2>No orders yet</h2><p>Your purchases and Pay at Shop orders will appear here.</p><Link className="confirm-button" href="/">Explore shops <ArrowUpRight size={15} /></Link></div> : <div className="orders-list">{orders.map((order) => { const details = order.products && typeof order.products === "object" && !Array.isArray(order.products) ? order.products as { item?: string; quantity?: number; paymentMethod?: string } : {}; return <article className="order-card" key={order.id}><div className="order-card-top"><div><strong>{order.shop.name}</strong><span><MapPin size={12} /> {order.shop.location.locality}, {order.shop.location.city}</span></div><b className={`order-status order-status-${order.paymentStatus.toLowerCase()}`}>{statusLabel(order.paymentStatus)}</b></div><div className="order-card-detail"><span>{details.item ?? "ZIDDU purchase"}</span><small>Qty: {details.quantity ?? 1} · {details.paymentMethod === "PAY_AT_SHOP" ? "Pay at Shop" : details.paymentMethod === "SIMULATED_UPI" ? "Simulated UPI" : "Simulated Card"}</small></div><div className="order-card-bottom"><strong>₹{order.totalPriceInr.toLocaleString("en-IN")}</strong><span>{orderCode(order.id)} · {order.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span><Link href={`/orders/${order.id}`}>View details <ArrowUpRight size={13} /></Link></div></article>; })}</div>}</section></main>;
}
