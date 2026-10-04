"use client";

import { ArrowUpRight, Bot, Check, Clapperboard, Compass, Home, MapPin, RotateCcw, Send, Sparkles, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { BottomNavigation } from "@/components/ui/bottom-navigation";
import { ShopIdentity } from "@/components/ui/shop-identity";
import type { DiscoveryData, FeedPost, Shop } from "@/types/commerce";
import { BUSINESS_CATEGORY_LABELS } from "@/types/commerce";
import { MockAIService, type AIMessage, type AIResult } from "@/services/ai-mock.service";

type AIExperienceProps = { data: DiscoveryData; location?: { city?: string | null; locality?: string | null } };

const suggestions = ["Find good biriyani near me", "Show furniture shops in Chennai", "Where can I find wireless earbuds?", "Find electronics offers near me", "Show restaurants open now", "Find a sofa under ₹25,000"];
const quickActions = ["Find nearby", "Find offers", "Find restaurants", "Find furniture", "Find electronics"];

function categoryLabel(shop: Shop) { return BUSINESS_CATEGORY_LABELS[shop.category].replace(/s$/, ""); }
function postHref(post: FeedPost) { return post.mediaType === "video" ? `/reels?post=${encodeURIComponent(post.id)}` : `/?post=${encodeURIComponent(post.id)}`; }

function ResultCard({ result, onOpenShop }: { result: AIResult; onOpenShop: (shop: Shop) => void }) {
  if (result.type === "shop") return <article className="ai-result-card"><ShopIdentity compact onOpen={() => onOpenShop(result.shop)} shop={result.shop} /><p>{result.shop.description ?? `A local ${categoryLabel(result.shop).toLowerCase()} in ${result.shop.area}.`}</p><div className="ai-result-meta"><span className={result.shop.status === "Closed" ? "is-closed" : "is-open"}>{result.shop.status}</span><span>{result.shop.distance}</span><Link href={`/shops/${result.shop.id}`}>View shop <ArrowUpRight size={13} /></Link></div></article>;
  if (result.type === "product") return <article className="ai-result-card ai-product-card"><Avatar alt={result.product.name} image={result.product.shop.image} initials={result.product.shop.initials} size="md" /><div><strong>{result.product.name}</strong><span>{result.product.shop.name} · {result.product.shop.area}, {result.product.shop.city}</span><p>{result.product.description}</p></div><b>₹{result.product.price.toLocaleString("en-IN")}</b></article>;
  if (result.type === "location") return <article className="ai-result-card ai-location-card"><MapPin size={19} /><div><strong>{result.label}</strong><span>{result.detail}</span></div></article>;

  const post = result.post;
  const href = postHref(post);
  return <article className="ai-result-card ai-post-card"><div className="ai-post-image" style={{ backgroundImage: `url("${post.image}")` }}><span>{result.type === "offer" ? post.badge ?? "Local offer" : post.mediaType === "video" ? "REEL" : "POST"}</span></div><div className="ai-post-copy"><ShopIdentity compact onOpen={() => onOpenShop(result.shop)} shop={result.shop} /><strong>{post.title}</strong><p>{post.description}</p><Link href={href}>Open in ZIDDU <ArrowUpRight size={13} /></Link></div></article>;
}

export default function AIExperience({ data, location }: AIExperienceProps) {
  const router = useRouter();
  const service = new MockAIService(data);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const locationLabel = location?.locality && location.city ? `${location.locality}, ${location.city}` : location?.city ?? "Choose your location";

  async function submit(prompt = input) {
    const text = prompt.trim();
    if (!text || loading) return;
    setInput("");
    setError("");
    setLoading(true);
    try {
      if (text.toLowerCase().includes("simulate error")) throw new Error("Mock response failed");
      const response = await service.respond(text);
      setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", text }, { id: `assistant-${Date.now()}-reply`, role: "assistant", text: response.text, results: response.results }]);
    } catch {
      setError("Something went wrong while getting a response.");
    } finally {
      setLoading(false);
    }
  }

  function clearChat() { setMessages([]); setError(""); }

  return <main className="ai-page">
    <header className="ai-header"><BackButton className="ai-back" label="Go back" /><div className="ai-brand"><span className="ai-brand-icon"><Sparkles size={17} /></span><span><strong>ZIDDU AI</strong><small>Your local shopping assistant</small></span></div>{messages.length > 0 && <button aria-label="Clear chat" className="ai-clear" onClick={clearChat} type="button"><Trash2 size={15} /> Clear</button>}</header>
    <section className="ai-location-bar"><MapPin size={15} /><span>{locationLabel}</span>{locationLabel === "Choose your location" ? <Link href="/onboarding">Choose location</Link> : <Link href="/profile">Change</Link>}</section>
    <div className="ai-layout">
      <section aria-label="ZIDDU AI conversation" className="ai-conversation">
        {messages.length === 0 ? <div className="ai-welcome"><span className="ai-welcome-mark"><Bot size={27} /></span><span className="section-kicker">ZIDDU AI</span><h1>Find the right place, product or offer around you.</h1><p>Ask about local shops, food, furniture, electronics, Reels and offers. I&apos;ll help you start with nearby ideas.</p><div className="ai-suggestion-grid">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => { void submit(suggestion); }} type="button">{suggestion}<ArrowUpRight size={14} /></button>)}</div></div> : <div className="ai-messages">{messages.map((message) => <article className={`ai-message ai-message-${message.role}`} key={message.id}><div className="ai-message-label">{message.role === "assistant" ? <><Sparkles size={13} /> ZIDDU AI</> : "You"}</div><p>{message.text}</p>{message.results && <div className="ai-results">{message.results.map((result, index) => <ResultCard key={`${message.id}-${result.type}-${index}`} onOpenShop={(shop) => router.push(`/shops/${shop.id}`)} result={result} />)}</div>}</article>)}{loading && <div aria-label="ZIDDU AI is thinking" className="ai-thinking"><Sparkles size={14} /> Thinking<span><i /><i /><i /></span></div>}</div>}
        {error && <div aria-live="assertive" className="ai-error" role="alert"><span>{error}</span><button onClick={() => { const retry = messages.at(-1)?.role === "user" ? messages.at(-1)?.text : "Find nearby"; if (retry) void submit(retry); }} type="button"><RotateCcw size={14} /> Try again</button></div>}
        <form className="ai-composer" onSubmit={(event) => { event.preventDefault(); void submit(); }}><label className="sr-only" htmlFor="ai-message">Ask ZIDDU AI</label><textarea id="ai-message" onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} placeholder="Ask about something nearby..." rows={1} value={input} /><button aria-label="Send message" disabled={!input.trim() || loading} type="submit"><Send size={17} /></button></form>
      </section>
      <aside className="ai-quick-panel"><div><span className="section-kicker">START EXPLORING</span><h2>What are you looking for?</h2></div><div className="ai-quick-actions">{quickActions.map((action) => <button key={action} onClick={() => { void submit(action); }} type="button"><Check size={14} />{action}</button>)}</div><p>Demo responses use local ZIDDU data. Your conversation stays on this page.</p></aside>
    </div>
    <BottomNavigation items={[{ label: "Home", icon: Home, onClick: () => router.push("/") }, { label: "Discover", icon: Compass, onClick: () => router.push("/search") }, { label: "ZIDDU AI", icon: Sparkles, active: true }, { label: "Reels", icon: Clapperboard, onClick: () => router.push("/reels") }, { label: "Profile", icon: UserRound, onClick: () => router.push("/profile") }]} />
  </main>;
}
