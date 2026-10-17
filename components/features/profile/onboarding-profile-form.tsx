"use client";

import { ArrowLeft, ArrowRight, Check, MapPin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { interestOptions, type ProfileInput } from "@/lib/profile";
import { getCurrentLocation } from "@/lib/current-location";
import { clearOnboardingLocation, readOnboardingLocation, saveOnboardingLocation } from "@/lib/onboarding-location";

const interestLabels: Record<ProfileInput["interests"][number], string> = { RESTAURANT: "Restaurants", FURNITURE: "Furniture", ELECTRONICS: "Electronics" };
const cities = ["Chennai", "Coimbatore", "Bengaluru", "Hyderabad", "Kochi", "Madurai", "Trichy", "Salem", "Tirunelveli", "Nagercoil", "Mumbai", "Delhi", "Pune", "Kolkata"];
type Step = 1 | 2 | 3;

type OnboardingProfileFormProps = { initial: ProfileInput };

export default function OnboardingProfileForm({ initial }: OnboardingProfileFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<ProfileInput>(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  // Keep the step layout stable while the user types.
  const [needsName] = useState(() => !initial.name.trim());
  const hasName = !needsName;
  const interestsStep: Step = needsName ? 2 : 1;
  const locationStep: Step = needsName ? 3 : 2;
  const totalSteps = needsName ? 3 : 2;
  const setField = <K extends keyof ProfileInput>(field: K, value: ProfileInput[K]) => setForm((current) => ({ ...current, [field]: value }));
  const toggleInterest = (interest: ProfileInput["interests"][number]) => setField("interests", form.interests.includes(interest) ? form.interests.filter((item) => item !== interest) : [...form.interests, interest]);

  function nextStep() {
    setError("");
    if (needsName && step === 1 && form.name.trim().length < 2) return setError("Enter your name to continue.");
    if (step === interestsStep && form.interests.length === 0) return setError("Choose at least one interest.");
    if (step === locationStep - 1) {
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
    if (step < totalSteps) setStep((current) => (current + 1) as Step);
  }

  async function requestCurrentLocation() {
    setLocationBusy(true); setError(""); setLocationMessage("");
    try {
      const location = await getCurrentLocation();
      setForm((current) => ({ ...current, city: location.city ?? current.city, locality: location.locality ?? current.locality }));
      saveOnboardingLocation(location);
      const response = await fetch("/api/location/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(location) });
      const result = await response.json() as { message?: string };
      if (!response.ok) throw new Error(result.message ?? "We couldn't save your location. Please try again.");
      setLocationMessage([location.locality, location.city].filter(Boolean).join(", "));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "We couldn't determine your location. Enter your area manually."); }
    finally { setLocationBusy(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!form.city || !form.locality.trim()) return setError("Add your city and locality to continue.");
    setSaving(true);
    try {
      const response = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json() as { message?: string };
      if (!response.ok) return setError(result.message ?? "We could not save your profile.");
      clearOnboardingLocation();
      router.replace("/"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Connection issue. Please try again."); }
    finally { setSaving(false); }
  }

  return <form className="profile-flow" onSubmit={save}>
    <div className="profile-flow-top"><span className="section-kicker">STEP {step} OF {totalSteps}</span><div className="profile-progress" aria-label={`${step} of ${totalSteps} steps`}>{Array.from({ length: totalSteps }, (_, index) => <span className={index < step ? "is-current" : ""} key={index} />)}</div></div>
    {!hasName && step === 1 && <section className="profile-step"><span className="profile-step-icon profile-emoji">✦</span><h1>What should we call you?</h1><p>Tell us your name so ZIDDU feels a little more personal.</p><label>Your name<input autoComplete="name" autoFocus value={form.name} onChange={(event) => setField("name", event.target.value)} placeholder="Enter your name" required /></label></section>}
    {step === interestsStep && <section className="profile-step"><span className="profile-step-icon profile-emoji">✦</span><h1>What are you into?</h1><p>Pick one or more so we can tune your local finds.</p><div className="interest-grid">{interestOptions.map((interest) => <button className={form.interests.includes(interest) ? "interest-option selected" : "interest-option"} key={interest} onClick={() => toggleInterest(interest)} type="button"><span>{form.interests.includes(interest) ? <Check size={16} /> : ""}</span>{interestLabels[interest]}</button>)}</div></section>}
    {step === locationStep && <section className="profile-step"><MapPin className="profile-step-icon" size={24} /><h1>Stay local.</h1><p>Choose a place for better nearby discovery. You can change it anytime.</p><label>City<select value={form.city} onChange={(event) => setField("city", event.target.value)}><option value="">Choose your city</option>{[...new Set([...cities, ...(form.city && !cities.includes(form.city) ? [form.city] : [])])].map((city) => <option key={city}>{city}</option>)}</select></label><label>Locality / area<input autoFocus value={form.locality} onChange={(event) => setField("locality", event.target.value)} placeholder="For example, Anna Nagar" /></label><button className="profile-location-button" disabled={locationBusy} onClick={() => { void requestCurrentLocation(); }} type="button"><MapPin size={15} />{locationBusy ? "Finding your location..." : locationMessage ? "Update my current location" : "Use my current location"}</button>{locationMessage && <p aria-live="polite" className="profile-location-success">{locationMessage} is ready to use.</p>}</section>}
    {error && <p className="profile-error" role="alert">{error}</p>}
    <div className="profile-flow-actions">{step > 1 && <button className="profile-back" onClick={() => setStep((current) => (current - 1) as Step)} type="button"><ArrowLeft size={16} /> Back</button>}{step < totalSteps ? <button className="confirm-button" onClick={nextStep} type="button">Continue <ArrowRight size={16} /></button> : <button className="confirm-button" disabled={saving} type="submit">{saving ? "Saving..." : "Finish setup"} <Check size={16} /></button>}</div>
  </form>;
}
