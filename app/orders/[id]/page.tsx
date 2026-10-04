import { ExternalLink, MapPin } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { BackButton } from "@/components/ui/back-button";

function orderCode(id: string) { return `ZIDDU-${id.slice(-8).toUpperCase()}`; }

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const user = await getCurrentUser();
    if (!user) redirect("/login");
    const { id } = await params;
    const order = await prisma.bill.findFirst({ where: { id, endUserId: user.id }, include: { shop: { include: { location: true } } } });
    if (!order) notFound();
    const details = order.products && typeof order.products === "object" && !Array.isArray(order.products) ? order.products as { item?: string; offer?: string; quantity?: number; unitPrice?: number; paymentMethod?: string } : {};
    const destination = order.shop.location.latitude != null && order.shop.location.longitude != null ? `${order.shop.location.latitude},${order.shop.location.longitude}` : order.shop.location.address;
    return <main className="order-detail-page"><header className="orders-header"><BackButton label="Go back" /><div><span className="section-kicker">ORDER DETAILS</span><h1>{orderCode(order.id)}</h1></div></header><section className="order-detail-content"><div className={`order-detail-status order-status-${order.paymentStatus.toLowerCase()}`}><strong>{order.paymentStatus === "PAID" ? "SUCCESS" : order.paymentStatus}</strong><span>{order.createdAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span></div><section className="order-detail-section"><span className="section-kicker">SHOP</span><h2>{order.shop.name}</h2><p><MapPin size={14} /> {order.shop.location.address}, {order.shop.location.locality}, {order.shop.location.city}, {order.shop.location.state} {order.shop.location.pincode ?? ""}</p><a className="shop-directions" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`} rel="noreferrer" target="_blank"><ExternalLink size={15} /> Directions</a></section><section className="order-detail-section"><span className="section-kicker">ITEM</span><h2>{details.item ?? "ZIDDU purchase"}</h2>{details.offer && <p>{details.offer}</p>}<p>Quantity: {details.quantity ?? 1}</p><p>Unit price: ₹{(details.unitPrice ?? order.totalPriceInr).toLocaleString("en-IN")}</p></section><section className="order-detail-section order-detail-total"><span>Payment</span><strong>{details.paymentMethod === "PAY_AT_SHOP" ? "Pay at Shop" : details.paymentMethod === "SIMULATED_UPI" ? "Simulated UPI" : "Simulated Card"}</strong><span>Total</span><strong>₹{order.totalPriceInr.toLocaleString("en-IN")}</strong></section></section></main>;
}
