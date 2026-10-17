"use client";

import { ArrowUpRight, Bot, Check, Clapperboard, Compass, Home, MapPin, Mic, RotateCcw, Send, Sparkles, Square, Trash2, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { BackButton } from "@/components/ui/back-button";
import { BottomNavigation } from "@/components/ui/bottom-navigation";
import { ShopIdentity } from "@/components/ui/shop-identity";
import type { FeedPost, Shop } from "@/types/commerce";
import { BUSINESS_CATEGORY_LABELS } from "@/types/commerce";
import type { AIMessage, AIResult } from "@/services/ai-mock.service";

type AIExperienceProps = { location?: { city?: string | null; locality?: string | null } };
type AIResponse = { question: string; answer: string; results: AIResult[]; message?: string };
type TranscriptionResponse = { transcript?: string; message?: string };

const suggestions = ["Find good biriyani near me", "Show furniture shops in Chennai", "Where can I find wireless earbuds?", "Find electronics offers near me", "Show restaurants open now", "Find a sofa under ₹25,000"];
const quickActions = ["Find nearby", "Find offers", "Find restaurants", "Find furniture", "Find electronics"];

function categoryLabel(shop: Shop) { return BUSINESS_CATEGORY_LABELS[shop.category].replace(/s$/, ""); }
function postHref(post: FeedPost) { return post.mediaType === "video" ? `/reels?post=${encodeURIComponent(post.id)}` : `/?post=${encodeURIComponent(post.id)}`; }

function ResultCard({ result, onOpenShop }: { result: AIResult; onOpenShop: (shop: Shop) => void }) {
  if (result.type === "shop") return <article className="ai-result-card"><ShopIdentity compact onOpen={() => onOpenShop(result.shop)} shop={result.shop} /><p>{result.shop.description ?? `A local ${categoryLabel(result.shop).toLowerCase()} in ${result.shop.area}.`}</p><div className="ai-result-meta"><span className={result.shop.status === "Closed" ? "is-closed" : "is-open"}>{result.shop.status}</span><span>{result.shop.distance}</span><Link href={`/shops/${result.shop.id}`}>View shop <ArrowUpRight size={13} /></Link></div></article>;
  if (result.type === "product") return <article className="ai-result-card ai-product-card"><Avatar alt={result.product.name} image={result.product.shop.image} initials={result.product.shop.initials} size="md" /><div><strong>{result.product.name}</strong><span>{result.product.shop.name} · {result.product.shop.area}, {result.product.shop.city}</span><p>{result.product.description}</p>{result.product.badge && <small className="ai-offer-badge">{result.product.badge}</small>}</div><b>{result.product.originalPrice && <del>₹{result.product.originalPrice.toLocaleString("en-IN")}</del>}₹{result.product.price.toLocaleString("en-IN")}</b></article>;
  if (result.type === "active-offer") return <article className="ai-result-card ai-active-offer-card"><div><span className="ai-offer-badge">{result.offer.badge ?? "Active offer"}</span><strong>{result.offer.title}</strong><ShopIdentity compact onOpen={() => onOpenShop(result.offer.shop)} shop={result.offer.shop} /><p>{result.offer.description}</p><span className="ai-offer-expiry">Valid until {new Date(result.offer.validUntil).toLocaleDateString()}</span></div><div className="ai-offer-price">{result.offer.originalPrice && <del>₹{result.offer.originalPrice.toLocaleString("en-IN")}</del>}{result.offer.price != null && <b>₹{result.offer.price.toLocaleString("en-IN")}</b>}<Link href={`/shops/${result.offer.shop.id}`}>View shop <ArrowUpRight size={13} /></Link></div></article>;
  if (result.type === "location") return <article className="ai-result-card ai-location-card"><MapPin size={19} /><div><strong>{result.label}</strong><span>{result.detail}</span></div></article>;

  const post = result.post;
  const href = postHref(post);
  return <article className="ai-result-card ai-post-card"><div className="ai-post-image" style={{ backgroundImage: `url("${post.image}")` }}><span>{result.type === "offer" ? post.badge ?? "Local offer" : post.mediaType === "video" ? "REEL" : "POST"}</span></div><div className="ai-post-copy"><ShopIdentity compact onOpen={() => onOpenShop(result.shop)} shop={result.shop} /><strong>{post.title}</strong><p>{post.description}</p><Link href={href}>Open in ZIDDU <ArrowUpRight size={13} /></Link></div></article>;
}

export default function AIExperience({ location }: AIExperienceProps) {
  const router = useRouter();
  const messageIdPrefix = useId();
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voicePreview, setVoicePreview] = useState(false);
  const [error, setError] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingTimerRef = useRef<number | null>(null);
  const locationLabel = location?.locality && location.city ? `${location.locality}, ${location.city}` : location?.city ?? "Choose your location";

  useEffect(() => () => {
    if (recordingTimerRef.current !== null) window.clearTimeout(recordingTimerRef.current);
    if (recorderRef.current) {
      recorderRef.current.ondataavailable = null;
      recorderRef.current.onstop = null;
      recorderRef.current.onerror = null;
      if (recorderRef.current.state === "recording") recorderRef.current.stop();
    }
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  function appendResponse(response: AIResponse) {
    setMessages((current) => {
      const index = current.length;
      return [
        ...current,
        { id: `${messageIdPrefix}-user-${index}`, role: "user", text: response.question },
        { id: `${messageIdPrefix}-assistant-${index + 1}`, role: "assistant", text: response.answer, results: response.results },
      ];
    });
  }

  function chatHistory() {
    return messages.slice(-8).map(({ role, text }) => ({ role, text }));
  }

  async function submit(prompt = input) {
    const text = prompt.trim();
    if (!text || loading || recording || transcribing) return;
    setError("");
    setLoading(true);
    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, history: chatHistory() }),
      });
      const result = await response.json() as AIResponse;
      if (!response.ok) throw new Error(result.message ?? "Ziddu AI is temporarily unavailable. Please try again.");
      appendResponse(result);
      setInput("");
      setVoicePreview(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ziddu AI is temporarily unavailable. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function transcribeAudio(audio: Blob) {
    setError("");
    setTranscribing(true);
    try {
      const form = new FormData();
      form.append("audio", audio, "voice-question");
      form.append("operation", "transcribe");
      const response = await fetch("/api/ai/chat", { method: "POST", body: form });
      const result = await response.json() as TranscriptionResponse;
      if (!response.ok) throw new Error(result.message ?? "Voice transcription could not be completed. Please try again.");
      if (!result.transcript?.trim()) throw new Error("No speech was recognized. Please try recording again.");
      setInput(result.transcript.trim());
      setVoicePreview(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Voice transcription could not be completed. Please try again.");
    } finally {
      setTranscribing(false);
    }
  }

  async function toggleRecording() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
      return;
    }
    if (loading || recording) return;
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        throw new Error("Voice recording is not supported in this browser. Please type your question.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"]
        .find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recordingChunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onerror = () => {
        setError("The voice recording could not be read. Please try again.");
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
      };
      recorder.onstop = () => {
        if (recordingTimerRef.current !== null) window.clearTimeout(recordingTimerRef.current);
        recordingTimerRef.current = null;
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        recorderRef.current = null;
        setRecording(false);
        const audio = new Blob(recordingChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        recordingChunksRef.current = [];
        if (audio.size > 0) void transcribeAudio(audio);
        else setError("No audio was captured. Please try recording again.");
      };
      recorder.start();
      setRecording(true);
      recordingTimerRef.current = window.setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, 30_000);
    } catch (cause) {
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      setRecording(false);
      setError(cause instanceof Error && cause.name === "NotAllowedError"
        ? "Allow microphone access to ask Ziddu AI by voice."
        : cause instanceof Error ? cause.message : "The microphone could not be started.");
    }
  }

  function clearChat() { setMessages([]); setError(""); setInput(""); setVoicePreview(false); }

  return <main className="ai-page">
    <header className="ai-header"><BackButton className="ai-back" label="Go back" /><div className="ai-brand"><span className="ai-brand-icon"><Sparkles size={17} /></span><span><strong>ZIDDU AI</strong><small>Your local shopping assistant</small></span></div>{messages.length > 0 && <button aria-label="Clear chat" className="ai-clear" onClick={clearChat} type="button"><Trash2 size={15} /> Clear</button>}</header>
    <section className="ai-location-bar"><MapPin size={15} /><span>{locationLabel}</span>{locationLabel === "Choose your location" ? <Link href="/onboarding">Choose location</Link> : <Link href="/profile">Change</Link>}</section>
    <div className="ai-layout">
      <section aria-label="ZIDDU AI conversation" className="ai-conversation">
        {messages.length === 0 ? <div className="ai-welcome"><span className="ai-welcome-mark"><Bot size={27} /></span><span className="section-kicker">ZIDDU AI</span><h1>Find the right place, product or offer around you.</h1><p>Ask about local shops, food, furniture, electronics, Reels and offers. I&apos;ll help you start with nearby ideas.</p><div className="ai-suggestion-grid">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => { void submit(suggestion); }} type="button">{suggestion}<ArrowUpRight size={14} /></button>)}</div></div> : <div className="ai-messages">{messages.map((message) => <article className={`ai-message ai-message-${message.role}`} key={message.id}><div className="ai-message-label">{message.role === "assistant" ? <><Sparkles size={13} /> ZIDDU AI</> : "You"}</div><p>{message.text}</p>{message.results && <div className="ai-results">{message.results.map((result, index) => <ResultCard key={`${message.id}-${result.type}-${index}`} onOpenShop={(shop) => router.push(`/shops/${shop.id}`)} result={result} />)}</div>}</article>)}{loading && <div aria-label="ZIDDU AI is thinking" className="ai-thinking"><Sparkles size={14} /> Thinking<span><i /><i /><i /></span></div>}</div>}
        {error && <div aria-live="assertive" className="ai-error" role="alert"><span>{error}</span><button onClick={() => { const retry = messages.at(-1)?.role === "user" ? messages.at(-1)?.text : "Find nearby"; if (retry) void submit(retry); }} type="button"><RotateCcw size={14} /> Try again</button></div>}
        <form className="ai-composer" onSubmit={(event) => { event.preventDefault(); void submit(); }}><label className="sr-only" htmlFor="ai-message">Ask ZIDDU AI</label><textarea id="ai-message" onChange={(event) => { setInput(event.target.value); setVoicePreview(false); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void submit(); } }} placeholder="Ask in English, Tamil, or Thunglish..." rows={voicePreview ? 3 : 1} value={input} /><button aria-label={recording ? "Stop recording" : "Ask by voice"} className={recording ? "is-recording" : ""} disabled={loading || transcribing} onClick={() => { void toggleRecording(); }} type="button">{recording ? <Square size={16} /> : <Mic size={18} />}</button><button aria-label="Send message" disabled={!input.trim() || loading || recording || transcribing} type="submit"><Send size={17} /></button></form>
        <p aria-live="polite" className={`ai-voice-disclosure${voicePreview ? " ai-voice-preview-status" : ""}`}>{recording ? "Listening… tap the stop button when you’re done." : transcribing ? "Transcribing your voice…" : voicePreview ? "Voice preview ready — review or edit the text above, then press Send to search." : "Voice recordings are sent to Google Gemini to transcribe your question."}</p>
      </section>
      <aside className="ai-quick-panel"><div><span className="section-kicker">START EXPLORING</span><h2>What are you looking for?</h2></div><div className="ai-quick-actions">{quickActions.map((action) => <button key={action} onClick={() => { void submit(action); }} type="button"><Check size={14} />{action}</button>)}</div><p>Answers use current Ziddu listings and active offers. Conversations stay on this page.</p></aside>
    </div>
    <BottomNavigation items={[{ label: "Home", icon: Home, onClick: () => router.push("/") }, { label: "Discover", icon: Compass, onClick: () => router.push("/search") }, { label: "ZIDDU AI", icon: Sparkles, active: true }, { label: "Reels", icon: Clapperboard, onClick: () => router.push("/reels") }, { label: "Profile", icon: UserRound, onClick: () => router.push("/profile") }]} />
  </main>;
}
