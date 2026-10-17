"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Smartphone } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/ui/brand-logo";

type LoginStep = "phone" | "otp";

type PhoneLoginFormProps = {
  developmentOtp?: string;
};

function normalizePhoneInput(value: string): string | null {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("91") && digits.length === 12) digits = digits.slice(2);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  return `+91${digits}`;
}

export default function PhoneLoginForm({ developmentOtp }: PhoneLoginFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>("phone");
  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const phoneRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "phone" && !window.matchMedia("(pointer: coarse)").matches) phoneRef.current?.focus();
    else if (step === "otp") codeRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function sendCode(phone: string) {
    setError("");
    setNotice("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/phone-number/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: phone }),
      });
      if (!response.ok) {
        setError(response.status === 429
          ? "Please wait before requesting another code."
          : "We couldn't send a code just now. Check the number and try again.");
        return false;
      }
      setNormalizedPhone(phone);
      setStep("otp");
      setCooldown(60);
      setNotice("Your sign-in code is on its way.");
      return true;
    } catch {
      setError("Connection issue. Please try again.");
      return false;
    } finally {
      setIsLoading(false);
    }
  }

  async function submitPhone(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const phone = normalizePhoneInput(phoneInput);
    const name = nameInput.trim();
    if (name.length < 2) {
      setError("Enter your name to continue.");
      return;
    }
    if (!phone) {
      setError("Enter a valid 10-digit Indian mobile number.");
      return;
    }
    if (phone === normalizedPhone && cooldown > 0) {
      setError(`Request another code in ${cooldown} seconds.`);
      return;
    }
    await sendCode(phone);
  }

  async function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!/^\d{6}$/.test(code)) {
      setError("Enter the 6-digit simulated code: 123456.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch("/api/auth/phone-number/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: normalizedPhone, code, name: nameInput.trim() }),
      });
      if (!response.ok) {
        setError(response.status === 429
          ? "Too many tries. Request a new code in a moment."
          : "That code is incorrect or has expired. Request a new one to try again.");
        return;
      }
      const result = await response.json() as { user?: { onboardingCompleted?: boolean } };
      router.replace(result.user?.onboardingCompleted ? "/" : "/onboarding");
      router.refresh();
    } catch {
      setError("Connection issue. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function resendCode() {
    if (cooldown > 0 || isLoading) return;
    setCode("");
    await sendCode(normalizedPhone);
  }

  return (
    <>
      <section className="login-content" aria-labelledby="login-title">
        <h1 id="login-title"><span>Welcome to</span><BrandLogo className="login-brand-image" /></h1>
        <p className="login-subtitle">{step === "phone" ? "Login to continue" : `Login to continue · ${normalizedPhone}`}{developmentOtp && step === "otp" && <small className="login-dev-otp">Simulated code: {developmentOtp}</small>}</p>

        {step === "phone" ? (
          <form className="login-form" onSubmit={submitPhone}>
            <label className="login-field-label" htmlFor="login-name">Your name</label>
            <input
              autoComplete="name"
              id="login-name"
              onChange={(event) => { setNameInput(event.target.value); setError(""); }}
              placeholder="Enter your name"
              required
              value={nameInput}
            />
            <div className="phone-input-wrap">
              <span className="country-prefix">+91 <i /></span>
              <input
                autoComplete="tel-national"
                id="phone-number"
                inputMode="numeric"
                maxLength={14}
                onChange={(event) => { setPhoneInput(event.target.value.replace(/[^\d\s()-]/g, "")); setError(""); }}
                placeholder="Enter mobile number"
                ref={phoneRef}
                required
                value={phoneInput}
              />
              <Smartphone aria-hidden="true" size={17} />
            </div>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="login-primary-button" disabled={isLoading} type="submit">
              {isLoading ? "Sending code…" : "Send OTP"}<ArrowRight size={17} />
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={submitCode}>
            <label className="login-field-label" htmlFor="otp-code">Enter your 6-digit code</label>
            <input
              autoComplete="one-time-code"
              className="otp-code-input"
              id="otp-code"
              inputMode="numeric"
              maxLength={6}
              onChange={(event) => { setCode(event.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }}
              placeholder="••••••"
              ref={codeRef}
              required
              value={code}
            />
            {notice && <p className="login-notice" role="status">{notice}</p>}
            {error && <p className="login-error" role="alert">{error}</p>}
            <button className="login-primary-button" disabled={isLoading} type="submit">
              {isLoading ? "Verifying…" : "Verify & continue"}<ArrowRight size={17} />
            </button>
            <div className="otp-secondary-actions">
              <button className="login-text-button" onClick={() => { setStep("phone"); setCode(""); setError(""); setNotice(""); }} type="button"><ArrowLeft size={14} /> Change number</button>
              <button className="login-text-button" disabled={cooldown > 0 || isLoading} onClick={resendCode} type="button">{cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}</button>
            </div>
          </form>
        )}

      </section>
      <footer className="login-footer">
        By continuing you agree to the<br />
        <Link href="/">Terms</Link> and <Link href="/">Privacy Policy</Link>
      </footer>
    </>
  )
}
