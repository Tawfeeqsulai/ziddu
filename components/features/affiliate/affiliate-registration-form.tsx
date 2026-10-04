"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, BadgePercent, Landmark, MapPin, UserRound } from "lucide-react";

type RegistrationIdentity = { name: string; email: string; phoneNumber: string | null; address: string | null; city: string | null; state: string | null; pincode: string | null };
type RegistrationFields = { address: string; city: string; state: string; pincode: string; accountHolderName: string; bankName: string; branchName: string; accountNumber: string; confirmAccountNumber: string; ifscCode: string; upiId: string; termsAccepted: boolean };

export default function AffiliateRegistrationForm({ identity, commissionRate }: { identity: RegistrationIdentity; commissionRate: number }) {
    const router = useRouter();
    const [fields, setFields] = useState<RegistrationFields>({
        address: identity.address ?? "",
        city: identity.city ?? "",
        state: identity.state ?? "",
        pincode: identity.pincode ?? "",
        accountHolderName: identity.name,
        bankName: "",
        branchName: "",
        accountNumber: "",
        confirmAccountNumber: "",
        ifscCode: "",
        upiId: "",
        termsAccepted: false,
    });
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const setField = <K extends keyof RegistrationFields>(key: K, value: RegistrationFields[K]) => setFields((current) => ({ ...current, [key]: value }));

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setSaving(true);
        try {
            const response = await fetch("/api/affiliate/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(fields) });
            const result = await response.json() as { message?: string };
            if (!response.ok) throw new Error(result.message ?? "We could not complete registration.");
            router.replace("/affiliate");
            router.refresh();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Connection issue. Please try again.");
        } finally {
            setSaving(false);
        }
    }

    return <main className="affiliate-page affiliate-register-page">
        <nav className="affiliate-register-breadcrumb"><Link href="/">Home</Link><span>›</span><strong>Affiliate Registration</strong></nav>
        <div className="affiliate-register-intro"><h1>Earn by referring</h1><p>Join ZIDDU&apos;s affiliate program and track commissions from successful referrals.</p></div>
        <form className="affiliate-registration-card" onSubmit={(event) => { void submit(event); }}>
            <header className="affiliate-registration-banner"><h2>Affiliate Registration</h2><p>Customer order referrals earn {commissionRate * 100}% commission</p><span><BadgePercent size={14} /> Commission rules are managed by ZIDDU</span></header>
            <div className="affiliate-registration-body">
                <section className="affiliate-form-section">
                    <h3><UserRound size={17} /> Personal information</h3>
                    <div className="affiliate-form-grid">
                        <label className="affiliate-form-wide">Full name<input autoComplete="name" readOnly value={identity.name} /></label>
                        <label>Email address<input autoComplete="email" readOnly value={identity.email} /></label>
                        <label>Phone number<input autoComplete="tel" readOnly value={identity.phoneNumber ?? "Not added to your ZIDDU account"} /></label>
                    </div>
                    <p className="affiliate-form-note">Your existing ZIDDU account is used for sign-in and identity. To change these details, edit your ZIDDU profile.</p>
                </section>
                <section className="affiliate-form-section">
                    <h3><MapPin size={17} /> Address information</h3>
                    <div className="affiliate-form-grid">
                        <label className="affiliate-form-wide">Street address<textarea autoComplete="street-address" maxLength={200} onChange={(event) => setField("address", event.target.value)} placeholder="Street address, apartment, area" required value={fields.address} /></label>
                        <label>City<input autoComplete="address-level2" maxLength={80} onChange={(event) => setField("city", event.target.value)} placeholder="City" required value={fields.city} /></label>
                        <label>State<input autoComplete="address-level1" maxLength={80} onChange={(event) => setField("state", event.target.value)} placeholder="State" required value={fields.state} /></label>
                        <label>Pincode<input autoComplete="postal-code" inputMode="numeric" maxLength={6} onChange={(event) => setField("pincode", event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit pincode" required value={fields.pincode} /></label>
                    </div>
                </section>
                <section className="affiliate-form-section">
                    <h3><Landmark size={17} /> Bank details</h3>
                    <div className="affiliate-form-grid">
                        <label className="affiliate-form-wide">Account Holder Name *<input autoComplete="name" maxLength={80} onChange={(event) => setField("accountHolderName", event.target.value)} placeholder="Name as per bank account" required value={fields.accountHolderName} /></label>
                        <label>Bank Name *<input autoComplete="organization" maxLength={80} onChange={(event) => setField("bankName", event.target.value)} placeholder="Name of bank" required value={fields.bankName} /></label>
                        <label>Branch Name<input autoComplete="off" maxLength={80} onChange={(event) => setField("branchName", event.target.value)} placeholder="Branch (optional)" value={fields.branchName} /></label>
                        <label>Account Number *<input autoComplete="off" inputMode="numeric" maxLength={18} onChange={(event) => setField("accountNumber", event.target.value.replace(/\D/g, "").slice(0, 18))} placeholder="Bank account number" required value={fields.accountNumber} /></label>
                        <label>Confirm Account Number *<input autoComplete="off" inputMode="numeric" maxLength={18} onChange={(event) => setField("confirmAccountNumber", event.target.value.replace(/\D/g, "").slice(0, 18))} placeholder="Re-enter account number" required value={fields.confirmAccountNumber} /></label>
                        <label>IFSC Code *<input autoComplete="off" maxLength={11} onChange={(event) => setField("ifscCode", event.target.value.toUpperCase())} placeholder="IFSC code" required value={fields.ifscCode} /></label>
                        <label>UPI ID (Optional)<input autoComplete="off" maxLength={100} onChange={(event) => setField("upiId", event.target.value)} placeholder="example@okhdfcbank" value={fields.upiId} /></label>
                    </div>
                </section>
                <div className="affiliate-registration-commission"><BadgePercent size={19} /><span>Eligible customer orders accrue <strong>{commissionRate * 100}%</strong> as a pending commission for review. No payout is automatic.</span></div>
                <label className="affiliate-terms-check"><input checked={fields.termsAccepted} onChange={(event) => setField("termsAccepted", event.target.checked)} required type="checkbox" /><span>I confirm my details are accurate and agree to ZIDDU&apos;s affiliate terms.</span></label>
                {error && <p className="affiliate-inline-error" role="alert">{error}</p>}
                <div className="affiliate-registration-actions"><Link className="affiliate-secondary" href="/profile"><ArrowLeft size={15} /> Cancel</Link><button className="affiliate-primary" disabled={saving} type="submit">{saving ? "Registering..." : "Register and start earning"}<ArrowRight size={16} /></button></div>
                <p className="affiliate-existing-note">Already registered? <Link href="/affiliate">Open your Affiliate Hub</Link></p>
            </div>
        </form>
    </main>;
}
