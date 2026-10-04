"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BadgeCheck, ChartNoAxesCombined, CircleHelp, Clipboard, Clock3, Copy, CreditCard, Gift, LayoutDashboard, Link2, LoaderCircle, Search, Store, UserRound, UsersRound, Wallet, X } from "lucide-react";
import { BackButton } from "@/components/ui/back-button";

type Section = "dashboard" | "referrals" | "earnings" | "withdrawals" | "profile";
type HubSection = Exclude<Section, "withdrawals" | "referrals">;
type Dashboard = {
    affiliate: { code: string; status: string; createdAt: string; user: { name: string; email: string; image: string | null; phoneNumber: string | null } };
    links: { customer: string; vendor: string };
    stats: { clicks: number; convertedCustomers: number; vendorsReferred: number; totalEarnings: number; availableBalance: number; pendingBalance: number; withdrawn: number };
    recentReferrals: Array<{ id: string; type: string; name: string; status: string; registeredAt: string; earned: number }>;
    payoutAccounts: Array<{ id: string; accountHolderName: string; bankName: string; accountLast4: string; ifscCode: string; verified: boolean }>;
    minimumWithdrawal: number;
    commissionRules: Record<string, { rate?: number; fixedAmount?: number }>;
};

type Payload = Record<string, unknown>;
const labels: Record<Section, string> = {
    dashboard: "Dashboard",
    referrals: "Referrals",
    earnings: "Earnings",
    withdrawals: "Withdrawals",
    profile: "Affiliate profile",
};
const icons = { dashboard: LayoutDashboard, earnings: ChartNoAxesCombined, profile: UserRound };
const hubSections: HubSection[] = ["dashboard", "earnings", "profile"];

function money(value: number) {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(value || 0);
}

function date(value: string) {
    return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

async function readJson(response: Response) {
    return await response.json().catch(() => ({})) as Payload;
}

export default function AffiliateHub({ section }: { section: Section }) {
    const [dashboard, setDashboard] = useState<Dashboard | null>(null);
    const router = useRouter();
    const [payload, setPayload] = useState<Payload>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");
    const [referralFilter, setReferralFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [refresh, setRefresh] = useState(0);
    const [copied, setCopied] = useState("");
    const [working, setWorking] = useState(false);
    const [accountForm, setAccountForm] = useState({ accountHolderName: "", bankName: "", accountLast4: "", ifscCode: "" });
    const activeSection = section;

    useEffect(() => {
        let cancelled = false;
        async function load() {
            setLoading(true);
            setError("");
            try {
                const dashboardResponse = await fetch("/api/affiliate/dashboard", { cache: "no-store" });
                const dashboardResult = await readJson(dashboardResponse);
                if (!dashboardResponse.ok) throw new Error(String(dashboardResult.message ?? "Could not load affiliate data."));
                const nextDashboard = dashboardResult.dashboard as Dashboard;
                let sectionResult: Payload = {};
                if (section === "referrals") {
                    const params = new URLSearchParams({ page: String(page) });
                    if (query.trim()) params.set("q", query.trim());
                    if (referralFilter === "customer" || referralFilter === "vendor") params.set("type", referralFilter.toUpperCase());
                    if (referralFilter === "registered") params.set("status", "REGISTERED");
                    if (referralFilter === "ordered") { params.set("type", "CUSTOMER"); params.set("status", "CONVERTED"); }
                    const response = await fetch(`/api/affiliate/referrals?${params}`, { cache: "no-store" });
                    sectionResult = await readJson(response);
                    if (!response.ok) throw new Error(String(sectionResult.message ?? "Could not load referrals."));
                } else if (section === "earnings") {
                    const response = await fetch(`/api/affiliate/earnings?page=${page}`, { cache: "no-store" });
                    sectionResult = await readJson(response);
                    if (!response.ok) throw new Error(String(sectionResult.message ?? "Could not load earnings."));
                } else if (section === "withdrawals") {
                    const response = await fetch("/api/affiliate/withdrawals", { cache: "no-store" });
                    sectionResult = await readJson(response);
                    if (!response.ok) throw new Error(String(sectionResult.message ?? "Could not load withdrawals."));
                } else if (section === "profile") {
                    const response = await fetch("/api/affiliate/profile", { cache: "no-store" });
                    sectionResult = await readJson(response);
                    if (!response.ok) throw new Error(String(sectionResult.message ?? "Could not load profile."));
                }
                if (!cancelled) {
                    setDashboard(nextDashboard);
                    setPayload(sectionResult);
                }
            } catch (cause) {
                if (!cancelled) setError(cause instanceof Error ? cause.message : "Connection issue. Please try again.");
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        void load();
        return () => { cancelled = true; };
    }, [section, page, query, referralFilter, refresh]);

    async function copyLink(label: string, value: string) {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(label);
            window.setTimeout(() => setCopied(""), 1800);
        } catch {
            setError("Clipboard access is unavailable in this browser.");
        }
    }

    async function submitAccount(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setWorking(true);
        setError("");
        try {
            const response = await fetch("/api/affiliate/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(accountForm) });
            const result = await readJson(response);
            if (!response.ok) throw new Error(String(result.message ?? "Could not add payout destination."));
            setAccountForm({ accountHolderName: "", bankName: "", accountLast4: "", ifscCode: "" });
            setRefresh((current) => current + 1);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Connection issue. Please try again.");
        } finally {
            setWorking(false);
        }
    }

    async function deactivateAffiliate() {
        if (!window.confirm("Deactivate affiliate access? Your ZIDDU account and affiliate history will remain.")) return;
        setWorking(true);
        setError("");
        try {
            const response = await fetch("/api/affiliate/become", { method: "DELETE" });
            const result = await readJson(response);
            if (!response.ok) throw new Error(String(result.message ?? "Could not deactivate affiliate access."));
            router.replace("/affiliate");
            router.refresh();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Connection issue. Please try again.");
        } finally {
            setWorking(false);
        }
    }
    if (loading && !dashboard) return <main className="affiliate-page"><div className="affiliate-loading"><LoaderCircle className="affiliate-spin" size={22} />Loading your affiliate hub</div></main>;
    if (error && !dashboard) return <main className="affiliate-page"><div className="affiliate-error-panel"><CircleHelp size={24} /><h1>Affiliate access unavailable</h1><p>{error}</p><Link className="affiliate-secondary" href="/profile"><ArrowLeft size={15} /> Back to profile</Link></div></main>;
    if (!dashboard) return null;

    const stats = dashboard.stats;
    const accounts = dashboard.payoutAccounts;
    const referrals = (payload.referrals ?? []) as Array<{ id: string; type: string; name: string; status: string; registeredAt: string; earned: number }>;
    const commissions = (payload.commissions ?? []) as Array<{ id: string; type: string; description: string; amount: number; baseAmount: number; commissionRate: number | null; status: string; date: string }>;
    const withdrawals = (payload.withdrawals ?? []) as Array<{ id: string; amount: number; status: string; requestedAt: string; bank: string }>;
    const pageCount = Number(payload.pages ?? 1);
    const referralStats = payload.stats as { clicks: number; registered: number; orders: number; commissionEarned: number } | undefined;
    const breakdown = (payload.breakdown ?? []) as Array<{ type: string; status: string; amount: number; count: number }>;

    return <main className="affiliate-page">
        <header className="affiliate-topbar"><Link className="brand-lockup" href="/"><span className="brand-mark">z</span><span className="brand-name">ziddu<span>.</span></span></Link><div><span className="affiliate-status"><i />{dashboard.affiliate.status}</span><Link href="/profile">ZIDDU profile <ArrowUpRight size={14} /></Link></div></header>
        <div className="affiliate-layout">
            <aside className="affiliate-sidebar"><div className="affiliate-sidebar-title"><span className="affiliate-avatar">{dashboard.affiliate.user.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span><div><strong>{dashboard.affiliate.user.name}</strong><small>Affiliate · {dashboard.affiliate.code}</small></div></div><span className="affiliate-nav-label">AFFILIATE HUB</span><nav>{hubSections.map((item) => { const Icon = icons[item]; return <Link aria-current={activeSection === item ? "page" : undefined} className={activeSection === item ? "is-active" : ""} href={item === "dashboard" ? "/affiliate" : `/affiliate/${item}`} key={item}><Icon size={17} />{labels[item]}</Link>; })}</nav><BackButton className="affiliate-back-link" label="Go back">Back to ZIDDU</BackButton></aside>
            <section className="affiliate-content">
                <div className="affiliate-heading"><div><span className="section-kicker">ZIDDU PARTNER PROGRAM</span><h1>{activeSection === "withdrawals" ? "Withdrawals" : labels[activeSection]}</h1><p>{activeSection === "dashboard" ? "Your referrals and earnings, all in one place." : activeSection === "profile" ? "Your existing ZIDDU identity and affiliate settings." : `Review your ${activeSection} activity.`}</p></div><span className="affiliate-code-badge"><BadgeCheck size={15} />{dashboard.affiliate.code}</span></div>
                {activeSection === "dashboard" && <Link className="affiliate-primary affiliate-vendor-entry" href="/affiliate/vendor"><Store size={15} />Create vendor account<ArrowUpRight size={15} /></Link>}
                {error && <p className="affiliate-inline-error" role="alert">{error}<button aria-label="Dismiss error" onClick={() => setError("")} type="button"><X size={15} /></button></p>}
                {activeSection === "dashboard" && <>
                    <div className="affiliate-stat-grid">{[{ label: "Total clicks", value: stats.clicks, Icon: Link2 }, { label: "Customers", value: stats.convertedCustomers, Icon: UsersRound }, { label: "Businesses", value: stats.vendorsReferred, Icon: Store }, { label: "Available", value: money(stats.availableBalance), Icon: Wallet }, { label: "Lifetime earnings", value: money(stats.totalEarnings), Icon: ChartNoAxesCombined }, { label: "Pending", value: money(stats.pendingBalance), Icon: Clock3 }].map(({ label, value, Icon: StatIcon }) => <article className="affiliate-stat" key={label}><span><StatIcon size={17} /></span><small>{label}</small><strong>{value}</strong></article>)}</div>
                    <div className="affiliate-dashboard-grid"><div className="affiliate-panel affiliate-links-panel"><div className="affiliate-panel-heading"><div><span className="section-kicker">SHARE YOUR LINKS</span><h2>Referral links</h2></div><Gift size={18} /></div><label>Customer referrals</label><div className="affiliate-copy-field"><input aria-label="Customer referral link" readOnly value={dashboard.links.customer} /><button aria-label="Copy customer referral link" onClick={() => { void copyLink("customer", dashboard.links.customer); }} type="button"><Copy size={16} />{copied === "customer" ? "Copied" : "Copy"}</button></div><label>Vendor referrals</label><div className="affiliate-copy-field"><input aria-label="Vendor referral link" readOnly value={dashboard.links.vendor} /><button aria-label="Copy vendor referral link" onClick={() => { void copyLink("vendor", dashboard.links.vendor); }} type="button"><Copy size={16} />{copied === "vendor" ? "Copied" : "Copy"}</button></div><p className="affiliate-note">Clicks are tracked for 30 days. New vendor accounts remain pending until approved by ZIDDU.</p></div></div>
                    <div className="affiliate-bottom-grid"><section className="affiliate-panel"><div className="affiliate-panel-heading"><div><span className="section-kicker">RECENT ACTIVITY</span><h2>Recent referrals</h2></div><Link href="/affiliate/referrals">View all <ArrowUpRight size={14} /></Link></div>{dashboard.recentReferrals.length ? <div className="affiliate-list">{dashboard.recentReferrals.map((item) => <article key={item.id}><span className="affiliate-row-icon">{item.type === "VENDOR" ? <Store size={16} /> : <UserRound size={16} />}</span><div><strong>{item.name}</strong><small>{item.type === "VENDOR" ? "Business" : "Customer"} · {date(item.registeredAt)}</small></div><b>{money(item.earned)}</b></article>)}</div> : <div className="affiliate-empty"><UsersRound size={22} /><strong>No referrals yet</strong><span>Share a referral link to start building your network.</span></div>}</section><section className="affiliate-panel"><div className="affiliate-panel-heading"><div><span className="section-kicker">PROGRAM RULES</span><h2>Commission rates</h2></div><CreditCard size={18} /></div>{Object.entries(dashboard.commissionRules).map(([kind, rule]) => <div className="affiliate-rule" key={kind}><span>{kind.replaceAll("_", " ").toLowerCase()}</span><strong>{rule.rate !== undefined ? `${rule.rate * 100}%` : money(rule.fixedAmount ?? 0)}</strong></div>)}<p className="affiliate-note">Customer orders and eligible vendor activity accrue pending commissions for review.</p></section></div>
                </>}
                {activeSection === "referrals" && <section className="affiliate-panel affiliate-table-panel"><div className="affiliate-panel-heading"><div><span className="section-kicker">YOUR NETWORK</span><h2>Referrals</h2></div><span>{Number(payload.total ?? 0)} records</span></div>{referralStats && <div className="affiliate-referral-stats">{[["Total clicks", referralStats.clicks], ["Registered", referralStats.registered], ["Orders", referralStats.orders], ["Commission earned", money(referralStats.commissionEarned)]].map(([label, value]) => <article key={label}><small>{label}</small><strong>{value}</strong></article>)}</div>}<form className="affiliate-search" onSubmit={(event) => { event.preventDefault(); setPage(1); setRefresh((current) => current + 1); }}><Search size={16} /><input onChange={(event) => setQuery(event.target.value)} placeholder="Search customer or shop" value={query} /><select aria-label="Filter referrals" onChange={(event) => { setReferralFilter(event.target.value); setPage(1); }} value={referralFilter}><option value="all">All referrals</option><option value="customer">Customers</option><option value="vendor">Vendors</option><option value="registered">Registered</option><option value="ordered">Ordered</option></select><button type="submit">Search</button></form>{referrals.length ? <div className="affiliate-table-scroll"><table><thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Registered</th><th>Earned</th></tr></thead><tbody>{referrals.map((item) => <tr key={item.id}><td>{item.name}</td><td>{item.type}</td><td><span className={`affiliate-pill ${item.status.toLowerCase()}`}>{item.status}</span></td><td>{date(item.registeredAt)}</td><td>{money(item.earned)}</td></tr>)}</tbody></table></div> : <div className="affiliate-empty"><UsersRound size={22} /><strong>No referrals yet</strong><span>Share your customer referral link to get started.</span></div>}<Pagination page={page} pages={pageCount} setPage={setPage} /></section>}
                {activeSection === "earnings" && <><div className="affiliate-stat-grid affiliate-earning-stats">{[["Lifetime earnings", money(stats.totalEarnings)], ["Available balance", money(stats.availableBalance)], ["Withdrawn", money(stats.withdrawn)]].map(([label, value]) => <article className="affiliate-stat" key={label}><small>{label}</small><strong>{value}</strong></article>)}</div><section className="affiliate-panel affiliate-breakdown-panel"><div className="affiliate-panel-heading"><div><span className="section-kicker">EARNINGS BREAKDOWN</span><h2>By commission type</h2></div><ChartNoAxesCombined size={18} /></div>{breakdown.length ? breakdown.map((item) => <div className="affiliate-rule" key={`${item.type}-${item.status}`}><span>{item.type.replaceAll("_", " ").toLowerCase()} · {item.status.toLowerCase()}</span><strong>{money(item.amount)} · {item.count}</strong></div>) : <div className="affiliate-empty"><ChartNoAxesCombined size={22} /><strong>No breakdown yet</strong><span>Commission details will appear after referrals convert.</span></div>}</section><section className="affiliate-panel affiliate-table-panel"><div className="affiliate-panel-heading"><div><span className="section-kicker">COMMISSION HISTORY</span><h2>Earnings</h2></div><span>{Number(payload.total ?? 0)} entries</span></div>{commissions.length ? <div className="affiliate-table-scroll"><table><thead><tr><th>Type</th><th>Description</th><th>Base</th><th>Rate</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead><tbody>{commissions.map((item) => <tr key={item.id}><td>{item.type.replaceAll("_", " ")}</td><td>{item.description}</td><td>{money(item.baseAmount)}</td><td>{item.commissionRate === null ? "Fixed" : `${item.commissionRate * 100}%`}</td><td>{money(item.amount)}</td><td>{date(item.date)}</td><td><span className={`affiliate-pill ${item.status.toLowerCase()}`}>{item.status}</span></td></tr>)}</tbody></table></div> : <div className="affiliate-empty"><ChartNoAxesCombined size={22} /><strong>No earnings yet</strong><span>Eligible commissions will appear here after your referrals convert.</span></div>}<Pagination page={page} pages={pageCount} setPage={setPage} /></section></>}
                {activeSection === "withdrawals" && <><section className="affiliate-panel affiliate-withdrawals-form"><div className="affiliate-panel-heading"><div><span className="section-kicker">PAYOUT SETTINGS</span><h2>Simulated payout destination</h2></div><CreditCard size={18} /></div><p className="affiliate-note">Only masked demo details are stored here. Do not enter a real account number. ZIDDU does not transfer funds.</p><form className="affiliate-account-form" onSubmit={(event) => { void submitAccount(event); }}><label>Account holder<input maxLength={80} onChange={(event) => setAccountForm({ ...accountForm, accountHolderName: event.target.value })} required value={accountForm.accountHolderName} /></label><label>Bank display name<input maxLength={80} onChange={(event) => setAccountForm({ ...accountForm, bankName: event.target.value })} required value={accountForm.bankName} /></label><label>Demo last 4 digits<input inputMode="numeric" maxLength={4} onChange={(event) => setAccountForm({ ...accountForm, accountLast4: event.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="0000" required value={accountForm.accountLast4} /></label><label>IFSC display code<input maxLength={11} onChange={(event) => setAccountForm({ ...accountForm, ifscCode: event.target.value.toUpperCase() })} required value={accountForm.ifscCode} /></label><button className="affiliate-primary" disabled={working} type="submit">Add simulated destination<ArrowUpRight size={15} /></button></form></section><section className="affiliate-panel affiliate-table-panel"><div className="affiliate-panel-heading"><div><span className="section-kicker">REQUEST HISTORY</span><h2>Withdrawals</h2></div><span>{withdrawals.length} recent</span></div>{withdrawals.length ? <div className="affiliate-table-scroll"><table><thead><tr><th>Amount</th><th>Destination</th><th>Requested</th><th>Status</th></tr></thead><tbody>{withdrawals.map((item) => <tr key={item.id}><td>{money(item.amount)}</td><td>{item.bank}</td><td>{date(item.requestedAt)}</td><td><span className={`affiliate-pill ${item.status.toLowerCase()}`}>{item.status}</span></td></tr>)}</tbody></table></div> : <div className="affiliate-empty"><Wallet size={22} /><strong>No withdrawals yet</strong><span>Withdrawal requests will be listed here.</span></div>}</section></>}
                {activeSection === "profile" && <div className="affiliate-profile-grid"><section className="affiliate-panel"><div className="affiliate-panel-heading"><div><span className="section-kicker">ZIDDU IDENTITY</span><h2>{dashboard.affiliate.user.name}</h2></div><UserRound size={18} /></div><dl className="affiliate-profile-details"><div><dt>Email</dt><dd>{dashboard.affiliate.user.email}</dd></div><div><dt>Phone</dt><dd>{dashboard.affiliate.user.phoneNumber ?? "Not added"}</dd></div><div><dt>Affiliate code</dt><dd>{dashboard.affiliate.code}</dd></div><div><dt>Status</dt><dd>{dashboard.affiliate.status}</dd></div><div><dt>Joined</dt><dd>{date(dashboard.affiliate.createdAt)}</dd></div></dl><Link className="affiliate-secondary" href="/profile">Edit ZIDDU profile <ArrowUpRight size={15} /></Link></section><section className="affiliate-panel"><div className="affiliate-panel-heading"><div><span className="section-kicker">PAYOUT DESTINATIONS</span><h2>Masked details</h2></div><CreditCard size={18} /></div>{accounts.length ? accounts.map((account) => <article className="affiliate-payout-item" key={account.id}><strong>{account.bankName}</strong><span>{account.accountHolderName} ····{account.accountLast4}</span><small>{account.ifscCode} · Simulated destination</small></article>) : <div className="affiliate-empty"><CreditCard size={22} /><strong>No payout destination</strong><span>Add a simulated payout destination from Withdrawals.</span><Link href="/affiliate/withdrawals">Go to withdrawals <ArrowUpRight size={14} /></Link></div>}</section><section className="affiliate-panel affiliate-profile-links"><div className="affiliate-panel-heading"><div><span className="section-kicker">SHARE LINKS</span><h2>Your links</h2></div><Clipboard size={18} /></div><div className="affiliate-profile-link-row"><span>Customer referral</span><button onClick={() => { void copyLink("customer", dashboard.links.customer); }} type="button"><Copy size={15} />{copied === "customer" ? "Copied" : "Copy"}</button></div><div className="affiliate-profile-link-row"><span>Vendor referral</span><button onClick={() => { void copyLink("vendor", dashboard.links.vendor); }} type="button"><Copy size={15} />{copied === "vendor" ? "Copied" : "Copy"}</button></div></section></div>}
                {activeSection === "profile" && <section className="affiliate-deactivation-panel"><span>Leaving the affiliate program will not delete your ZIDDU account or affiliate history.</span><button className="affiliate-deactivate" disabled={working} onClick={() => { void deactivateAffiliate(); }} type="button">Deactivate affiliate access</button></section>}
                <footer className="affiliate-footnote"><CircleHelp size={14} />Affiliate earnings are tracked records, not a guarantee of payout. No real payment integration is enabled.</footer>
            </section>
        </div>
    </main>;
}

function Pagination({ page, pages, setPage }: { page: number; pages: number; setPage: (page: number) => void }) {
    if (pages < 2) return null;
    return <div className="affiliate-pagination"><button disabled={page <= 1} onClick={() => setPage(page - 1)} type="button">Previous</button><span>{page} / {pages}</span><button disabled={page >= pages} onClick={() => setPage(page + 1)} type="button">Next</button></div>;
}
