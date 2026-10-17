"use client";

import { ArrowLeft, ArrowRight, Check, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { interestOptions, type ProfileInput } from "@/lib/profile";
import { getCurrentLocation } from "@/lib/current-location";
import { clearOnboardingLocation, readOnboardingLocation, saveOnboardingLocation } from "@/lib/onboarding-location";

const interestLabels: Record<ProfileInput["interests"][number], string> = { RESTAURANT: "Restaurants", FURNITURE: "Furniture", ELECTRONICS: "Electronics" };
const cities = ["Chennai", "Coimbatore", "Bengaluru", "Hyderabad", "Kochi", "Madurai", "Trichy", "Salem", "Tirunelveli", "Nagercoil", "Mumbai", "Delhi", "Pune", "Kolkata"];
type Step = 1 | 2;
type ProfileFormProps = { mode: "onboarding" | "edit"; initial: ProfileInput };

export default function ProfileForm({ mode, initial }: ProfileFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<ProfileInput>(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const setField = <K extends keyof ProfileInput>(field: K, value: ProfileInput[K]) => setForm((current) => ({ ...current, [field]: value }));
  const toggleInterest = (interest: ProfileInput["interests"][number]) => setField("interests", form.interests.includes(interest) ? form.interests.filter((item) => item !== interest) : [...form.interests, interest]);

  async function nextStep() {
    setError("");
    if (step === 1 && form.interests.length === 0) return setError("Choose at least one interest.");
    if (step === 1 && mode === "onboarding") {
      try {
        const location = readOnboardingLocation();
        if (location) {
          setForm((current) => ({ ...current, city: current.city || location.city || "", locality: current.locality || location.locality || "" }));
          setLocationMessage([location.locality, location.city].filter(Boolean).join(", "));
        }
      } catch {
        setError("We couldn't load your earlier location. You can find it again on the location step.");
      }
    }
    if (step < 2) setStep((current) => (current + 1) as Step);
  }

  async function requestCurrentLocation() {
    setLocationBusy(true); setError(""); setLocationMessage("");
    try {
      const location = await getCurrentLocation();
      setForm((current) => ({ ...current, city: location.city ?? current.city, locality: location.locality ?? current.locality }));
      if (mode === "onboarding") saveOnboardingLocation(location);
      const saveResponse = await fetch("/api/location/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(location) });
      const result = await saveResponse.json() as { message?: string };
      if (!saveResponse.ok) throw new Error(result.message ?? "We couldn't save your location. Please try again.");
      setLocationMessage([location.locality, location.city].filter(Boolean).join(", "));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn't determine your location. Enter your area manually."); }
    finally { setLocationBusy(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!form.city || !form.locality.trim()) return setError("Add your city and locality to continue.");
    setSaving(true);
    try {
      if (mode === "onboarding") {
        const location = readOnboardingLocation();
        const matchesDetectedArea = location && form.city.trim().toLowerCase() === location.city?.trim().toLowerCase() && form.locality.trim().toLowerCase() === location.locality?.trim().toLowerCase();
        if (matchesDetectedArea && location) {
          const locationResponse = await fetch("/api/location/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(location) });
          const locationResult = await locationResponse.json() as { message?: string };
          if (!locationResponse.ok) return setError(locationResult.message ?? "We couldn't save your location. Please try again.");
        }
      }
      const response = await fetch("/api/profile", { method: mode === "onboarding" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json() as { message?: string };
      if (!response.ok) return setError(result.message ?? "We could not save your profile.");
      if (mode === "onboarding") clearOnboardingLocation();
      router.replace(mode === "onboarding" ? "/" : "/profile"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Connection issue. Please try again."); }
    finally { setSaving(false); }
  }

  return (
    <form className="profile-flow" onSubmit={save}>
      <div className="profile-flow-top"><span className="section-kicker">{mode === "onboarding" ? `STEP ${step} OF 2` : "YOUR PROFILE"}</span><div className="profile-progress" aria-label={`${step} of 2 steps`}>{[1, 2].map((item) => <span className={item <= step ? "is-current" : ""} key={item} />)}</div></div>
      {mode === "onboarding" && step === 1 && <section className="profile-step"><span className="profile-step-icon profile-emoji">✦</span><h1>What are you into?</h1><p>Pick one or more so we can tune your local finds.</p><div className="interest-grid">{interestOptions.map((interest) => <button className={form.interests.includes(interest) ? "interest-option selected" : "interest-option"} key={interest} onClick={() => toggleInterest(interest)} type="button"><span>{form.interests.includes(interest) ? <Check size={16} /> : ""}</span>{interestLabels[interest]}</button>)}</div></section>}
      {mode === "onboarding" && step === 2 && <section className="profile-step"><MapPin className="profile-step-icon" size={24} /><h1>Stay local.</h1><p>Choose a place for better nearby discovery. You can change it anytime.</p><label>City<select value={form.city} onChange={(event) => setField("city", event.target.value)}><option value="">Choose your city</option>{[...new Set([...cities, ...(form.city && !cities.includes(form.city) ? [form.city] : [])])].map((city) => <option key={city}>{city}</option>)}</select></label><label>Locality / area<input autoFocus value={form.locality} onChange={(event) => setField("locality", event.target.value)} placeholder="For example, Anna Nagar" /></label><button className="profile-location-button" disabled={locationBusy} onClick={() => { void requestCurrentLocation(); }} type="button"><MapPin size={15} />{locationBusy ? "Finding your location..." : locationMessage ? "Update my current location" : "Use my current location"}</button>{locationMessage && <p aria-live="polite" className="profile-location-success">{locationMessage} is ready to use.</p>}</section>}
      {mode === "edit" && <section className="profile-step"><h1>Edit your profile.</h1><p>Keep your ZIDDU identity current.</p><label>Name<input autoFocus value={form.name} onChange={(event) => setField("name", event.target.value)} /></label><label>Username <small>optional</small><input value={form.username ?? ""} onChange={(event) => setField("username", event.target.value)} /></label><label>Bio <small>optional</small><textarea value={form.bio ?? ""} onChange={(event) => setField("bio", event.target.value)} maxLength={160} placeholder="A little about you" /></label><div className="interest-grid">{interestOptions.map((interest) => <button className={form.interests.includes(interest) ? "interest-option selected" : "interest-option"} key={interest} onClick={() => toggleInterest(interest)} type="button"><span>{form.interests.includes(interest) ? <Check size={16} /> : ""}</span>{interestLabels[interest]}</button>)}</div><label>City<select value={form.city} onChange={(event) => setField("city", event.target.value)}><option value="">Choose your city</option>{[...new Set([...cities, ...(form.city && !cities.includes(form.city) ? [form.city] : [])])].map((city) => <option key={city}>{city}</option>)}</select></label><label>Locality / area<input value={form.locality} onChange={(event) => setField("locality", event.target.value)} /></label><button className="profile-location-button" disabled={locationBusy} onClick={() => { void requestCurrentLocation(); }} type="button"><MapPin size={15} />{locationBusy ? "Finding your location..." : locationMessage ? "Update my current location" : "Use my current location"}</button>{locationMessage && <p aria-live="polite" className="profile-location-success">{locationMessage} is ready to use.</p>}</section>}
      {error && <p className="profile-error" role="alert">{error}</p>}
      <div className="profile-flow-actions">{mode === "onboarding" && step > 1 && <button className="profile-back" onClick={() => setStep((current) => (current - 1) as Step)} type="button"><ArrowLeft size={16} /> Back</button>}{mode === "edit" && <button className="profile-back" onClick={() => router.push("/profile")} type="button"><ArrowLeft size={16} /> Cancel</button>} {mode === "onboarding" && step < 2 ? <button className="confirm-button" onClick={() => { void nextStep(); }} type="button">Continue <ArrowRight size={16} /></button> : <button className="confirm-button" disabled={saving} type="submit">{saving ? "Saving..." : mode === "onboarding" ? "Finish setup" : "Save profile"} <Check size={16} /></button>}</div>
    </form>
  );
}
