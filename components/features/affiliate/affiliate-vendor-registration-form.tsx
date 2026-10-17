"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgeCheck, MapPin, Store } from "lucide-react";

type VendorFields = {
    name: string;
    category: "RESTAURANT" | "FURNITURE" | "ELECTRONICS";
    description: string;
    address: string;
    locality: string;
    city: string;
    state: string;
    pincode: string;
    phone: string;
};

export default function AffiliateVendorRegistrationForm({ initial }: { initial: Pick<VendorFields, "address" | "locality" | "city" | "state" | "pincode" | "phone"> }) {
    const router = useRouter();
    const [fields, setFields] = useState<VendorFields>({ name: "", category: "RESTAURANT", description: "", ...initial });
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const setField = <K extends keyof VendorFields>(key: K, value: VendorFields[K]) => setFields((current) => ({ ...current, [key]: value }));

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setSaving(true);
        try {
            const response = await fetch("/api/affiliate/vendor", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
            const result = await response.json() as { message?: string; shop?: { id: string } };
            if (!response.ok || !result.shop) throw new Error(result.message ?? "We could not create the vendor account.");
            router.replace(`/shops/${result.shop.id}`);
            router.refresh();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Connection issue. Please try again.");
        } finally {
            setSaving(false);
        }
    }

    return <main className="affiliate-page affiliate-register-page">
        <nav className="affiliate-register-breadcrumb"><Link href="/affiliate">Affiliate Hub</Link><span>›</span><strong>Vendor account</strong></nav>
        <div className="affiliate-register-intro"><h1>Create a vendor account</h1><p>Register your business with your existing ZIDDU identity.</p></div>
        <form className="affiliate-registration-card" onSubmit={(event) => { void submit(event); }}>
            <header className="affiliate-registration-banner"><h2>Business registration</h2><p>Your shop becomes available after ZIDDU verifies the details.</p><span><BadgeCheck size={14} /> Ownership remains with your signed-in account</span></header>
            <div className="affiliate-registration-body">
                <section className="affiliate-form-section">
                    <h3><Store size={17} /> Business information</h3>
                    <div className="affiliate-form-grid">
                        <label className="affiliate-form-wide">Business name<input autoComplete="organization" maxLength={100} onChange={(event) => setField("name", event.target.value)} required value={fields.name} /></label>
                        <label>Business category<select onChange={(event) => setField("category", event.target.value as VendorFields["category"])} value={fields.category}><option value="RESTAURANT">Restaurant</option><option value="FURNITURE">Furniture</option><option value="ELECTRONICS">Electronics</option></select></label>
                        <label>Business phone<input autoComplete="tel" inputMode="tel" maxLength={16} onChange={(event) => setField("phone", event.target.value.replace(/[^\d+]/g, ""))} required value={fields.phone} /></label>
                        <label className="affiliate-form-wide">Description<textarea maxLength={500} onChange={(event) => setField("description", event.target.value)} value={fields.description} /></label>
                    </div>
                </section>
                <section className="affiliate-form-section">
                    <h3><MapPin size={17} /> Business location</h3>
                    <div className="affiliate-form-grid">
                        <label className="affiliate-form-wide">Street address<textarea autoComplete="street-address" maxLength={240} onChange={(event) => setField("address", event.target.value)} required value={fields.address} /></label>
                        <label>Locality<input autoComplete="address-level3" maxLength={100} onChange={(event) => setField("locality", event.target.value)} required value={fields.locality} /></label>
                        <label>City<input autoComplete="address-level2" maxLength={100} onChange={(event) => setField("city", event.target.value)} required value={fields.city} /></label>
                        <label>State<input autoComplete="address-level1" maxLength={100} onChange={(event) => setField("state", event.target.value)} required value={fields.state} /></label>
                        <label>Pincode<input autoComplete="postal-code" inputMode="numeric" maxLength={6} onChange={(event) => setField("pincode", event.target.value.replace(/\D/g, "").slice(0, 6))} required value={fields.pincode} /></label>
                    </div>
                </section>
                <p className="affiliate-form-note">Vendor status starts as unverified. ZIDDU reviews new business listings before approval.</p>
                {error && <p className="affiliate-inline-error" role="alert">{error}</p>}
                <div className="affiliate-registration-actions"><Link className="affiliate-secondary" href="/affiliate"><ArrowLeft size={15} /> Cancel</Link><button className="affiliate-primary" disabled={saving} type="submit">{saving ? "Creating account..." : "Create vendor account"}<ArrowRight size={16} /></button></div>
            </div>
        </form>
    </main>;
}
