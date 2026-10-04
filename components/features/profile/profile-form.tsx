"use client";

import { ArrowLeft, ArrowRight, Check, MapPin, Smartphone, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { interestOptions, profileInputSchema, type ProfileInput } from "@/lib/profile";

const interestLabels: Record<ProfileInput["interests"][number], string> = {
  RESTAURANT: "Restaurants",
  FURNITURE: "Furniture",
  ELECTRONICS: "Electronics",
};

const cities = ["Chennai", "Coimbatore", "Bengaluru", "Hyderabad", "Kochi", "Madurai", "Trichy", "Salem", "Tirunelveli", "Nagercoil", "Mumbai", "Delhi", "Pune", "Kolkata"];
const indianPhonePattern = /^(?:\+91|91)?[6-9]\d{9}$/;
type Step = 1 | 2 | 3;

type ProfileFormProps = { mode: "onboarding" | "edit"; initial: ProfileInput; emailEditable?: boolean };

export default function ProfileForm({ mode, initial, emailEditable = false }: ProfileFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState<ProfileInput>(initial);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [locationBusy, setLocationBusy] = useState(false);
  const [verificationPhone, setVerificationPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationLoading, setVerificationLoading] = useState(false);
  const phoneNumberLocked = mode === "onboarding" && Boolean(initial.phoneNumber);

  const setField = <K extends keyof ProfileInput>(field: K, value: ProfileInput[K]) => setForm((current) => ({ ...current, [field]: value }));
  const toggleInterest = (interest: ProfileInput["interests"][number]) => setField("interests", form.interests.includes(interest) ? form.interests.filter((item) => item !== interest) : [...form.interests, interest]);

  async function nextStep() {
    setError("");
    if (step === 1 && form.name.trim().length < 2) return setError("Add your name to continue.");
    if (step === 1 && emailEditable) {
      const email = form.email?.trim() ?? "";
      if (!email) return setError("Enter your email address to continue.");
      const parsedEmail = profileInputSchema.shape.email.safeParse(email);
      if (!parsedEmail.success) return setError(parsedEmail.error.issues[0]?.message ?? "Enter a valid email address.");
    }
    if (step === 1 && !form.phoneNumber) return setError("Add your mobile number to continue.");
    if (step === 1 && !indianPhonePattern.test(form.phoneNumber ?? "")) return setError("Enter a valid 10-digit Indian mobile number.");
    if (step === 1 && !phoneNumberLocked) {
      const phoneNumber = `+91${(form.phoneNumber ?? "").replace(/\D/g, "").replace(/^91(?=\d{10}$)/, "")}`;
      setVerificationLoading(true);
      try {
        const response = await fetch("/api/onboarding/phone-number/send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber }) });
        const result = await response.json() as { message?: string; phoneNumber?: string };
        if (!response.ok) return setError(result.message ?? "We could not send a verification code.");
        setVerificationPhone(result.phoneNumber ?? phoneNumber);
        setVerificationCode("");
        return;
      } catch {
        return setError("Connection issue. Please try again.");
      } finally {
        setVerificationLoading(false);
      }
    }
    if (step === 2 && form.interests.length === 0) return setError("Choose at least one interest.");
    if (step < 3) setStep((current) => (current + 1) as Step);
  }

  async function verifyPhone() {
    if (!/^\d{6}$/.test(verificationCode)) return setError("Enter the 6-digit simulated code: 123456.");
    setError("");
    setVerificationLoading(true);
    try {
      const response = await fetch("/api/onboarding/phone-number/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phoneNumber: verificationPhone, code: verificationCode }) });
      const result = await response.json() as { message?: string };
      if (!response.ok) return setError(result.message ?? "That code is incorrect or has expired.");
      setField("phoneNumber", verificationPhone);
      setVerificationPhone("");
      setVerificationCode("");
      setStep(2);
    } catch {
      setError("Connection issue. Please try again.");
    } finally {
      setVerificationLoading(false);
    }
  }

  async function requestCurrentLocation() {
    if (!navigator.geolocation) return setError("Location is not available in this browser.");
    setLocationBusy(true);
    setError("");
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      try {
        const response = await fetch("/api/location/reverse-geocode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude }) });
        const result = await response.json() as { location?: { city?: string; locality?: string; address?: string; state?: string; pincode?: string; latitude?: number; longitude?: number }; message?: string };
        if (!response.ok || !result.location) throw new Error(result.message);
        const location = result.location;
        setForm((current) => ({ ...current, city: location.city ?? current.city, locality: location.locality ?? current.locality }));
        const saveResponse = await fetch("/api/location/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(location) });
        if (!saveResponse.ok) throw new Error("Could not save location");
      } catch { setError("We could not determine your location. Search for your area instead."); }
      finally { setLocationBusy(false); }
    }, () => { setError("Location permission was denied. Search for your area instead."); setLocationBusy(false); });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!form.city || !form.locality.trim()) return setError("Add your city and locality to continue.");
    setSaving(true);
    try {
      const response = await fetch("/api/profile", { method: mode === "onboarding" ? "POST" : "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json() as { message?: string };
      if (!response.ok) return setError(result.message ?? "We could not save your profile.");
      router.replace(mode === "onboarding" ? "/" : "/profile");
      router.refresh();
    } catch {
      setError("Connection issue. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="profile-flow" onSubmit={save}>
      <div className="profile-flow-top"><span className="section-kicker">{mode === "onboarding" ? `STEP ${step} OF 3` : "YOUR PROFILE"}</span><div className="profile-progress" aria-label={`${step} of 3 steps`}>{[1, 2, 3].map((item) => <span className={item <= step ? "is-current" : ""} key={item} />)}</div></div>
      {mode === "onboarding" && step === 1 && <section className="profile-step"><UserRound className="profile-step-icon" size={24} /><h1>Make it yours.</h1><p>Tell your neighborhood who they&apos;re meeting.</p><label>Name<input autoFocus value={form.name} onChange={(event) => setField("name", event.target.value)} placeholder="Your name" /></label><label><span>Mobile number {phoneNumberLocked && <small>verified</small>}</span><div className="phone-input-wrap"><input autoComplete="tel-national" disabled={phoneNumberLocked} inputMode="numeric" maxLength={14} onChange={(event) => { setField("phoneNumber", event.target.value.replace(/[^\d+]/g, "")); setError(""); }} placeholder="10-digit mobile number" required value={form.phoneNumber ?? ""} /><Smartphone aria-hidden="true" size={17} /></div></label><label>Email address<input autoComplete="email" disabled={!emailEditable} onChange={(event) => { setField("email", event.target.value); setError(""); }} placeholder="you@example.com" required={emailEditable} type="email" value={form.email ?? ""} /></label><label>Username <small>optional</small><input value={form.username ?? ""} onChange={(event) => setField("username", event.target.value)} placeholder="yourhandle" /></label>{verificationPhone && <div className="profile-phone-verification"><p>Enter your 6-digit code</p><small>Simulated code: 123456</small><input autoComplete="one-time-code" inputMode="numeric" maxLength={6} onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="••••••" value={verificationCode} /><button className="confirm-button" disabled={verificationLoading} onClick={() => { void verifyPhone(); }} type="button">{verificationLoading ? "Verifying..." : "Verify mobile number"}</button></div>}</section>}
      {mode === "onboarding" && step === 2 && <section className="profile-step"><span className="profile-step-icon profile-emoji">✦</span><h1>What are you into?</h1><p>Pick one or more so we can tune your local finds.</p><div className="interest-grid">{interestOptions.map((interest) => <button className={form.interests.includes(interest) ? "interest-option selected" : "interest-option"} key={interest} onClick={() => toggleInterest(interest)} type="button"><span>{form.interests.includes(interest) ? <Check size={16} /> : ""}</span>{interestLabels[interest]}</button>)}</div></section>}
      {mode === "onboarding" && step === 3 && <section className="profile-step"><MapPin className="profile-step-icon" size={24} /><h1>Stay local.</h1><p>Choose a place for better nearby discovery. You can change it anytime.</p><label>City<select value={form.city} onChange={(event) => setField("city", event.target.value)}><option value="">Choose your city</option>{cities.map((city) => <option key={city}>{city}</option>)}</select></label><label>Locality / area<input autoFocus value={form.locality} onChange={(event) => setField("locality", event.target.value)} placeholder="For example, Anna Nagar" /></label></section>}
      {mode === "edit" && <section className="profile-step"><h1>Edit your profile.</h1><p>Keep your ZIDDU identity current.</p><label>Name<input autoFocus value={form.name} onChange={(event) => setField("name", event.target.value)} /></label><label>Username <small>optional</small><input value={form.username ?? ""} onChange={(event) => setField("username", event.target.value)} /></label><label>Bio <small>optional</small><textarea value={form.bio ?? ""} onChange={(event) => setField("bio", event.target.value)} maxLength={160} placeholder="A little about you" /></label><div className="interest-grid">{interestOptions.map((interest) => <button className={form.interests.includes(interest) ? "interest-option selected" : "interest-option"} key={interest} onClick={() => toggleInterest(interest)} type="button"><span>{form.interests.includes(interest) ? <Check size={16} /> : ""}</span>{interestLabels[interest]}</button>)}</div><label>City<select value={form.city} onChange={(event) => setField("city", event.target.value)}><option value="">Choose your city</option>{cities.map((city) => <option key={city}>{city}</option>)}</select></label><label>Locality / area<input value={form.locality} onChange={(event) => setField("locality", event.target.value)} /></label><button className="profile-location-button" disabled={locationBusy} onClick={() => { void requestCurrentLocation(); }} type="button"><MapPin size={15} />{locationBusy ? "Finding your location..." : "Use my current location"}</button></section>}
      {error && <p className="profile-error" role="alert">{error}</p>}
      <div className="profile-flow-actions">{mode === "onboarding" && step > 1 && <button className="profile-back" onClick={() => setStep((current) => (current - 1) as Step)} type="button"><ArrowLeft size={16} /> Back</button>}{mode === "edit" && <button className="profile-back" onClick={() => router.push("/profile")} type="button"><ArrowLeft size={16} /> Cancel</button>}      {mode === "onboarding" && step < 3 ? <button className="confirm-button" disabled={verificationLoading || Boolean(verificationPhone)} onClick={() => { void nextStep(); }} type="button">{verificationLoading ? "Sending code..." : "Continue"} <ArrowRight size={16} /></button> : <button className="confirm-button" disabled={saving} type="submit">{saving ? "Saving..." : mode === "onboarding" ? "Finish setup" : "Save profile"} <Check size={16} /></button>}</div>
    </form>
  );
}
