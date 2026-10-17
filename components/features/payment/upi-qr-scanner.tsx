"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { AlertCircle, Camera, CheckCircle2, ImageUp, QrCode, X } from "lucide-react";
import type { IScannerControls } from "@zxing/browser";

type UpiPayment = { uri: string; payeeId: string; payeeName: string; amount?: string; note?: string };
const allowedUpiParameters = ["pa", "pn", "am", "cu", "tn", "tr", "tid", "mc", "mode", "orgid", "sign", "mid", "msid", "mtid", "qrmedium", "qrtempid", "gstin", "invoiceno"];

function parseUpiPayment(value: string): UpiPayment {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error("This QR code is not a valid UPI payment code.");
  }

  if (url.protocol !== "upi:" || url.hostname.toLowerCase() !== "pay") {
    throw new Error("This QR code is not a UPI payment code. Scan a merchant UPI QR.");
  }

  const payeeId = url.searchParams.get("pa")?.trim() ?? "";
  const [payeeName, provider] = payeeId.split("@");
  if (!payeeName || !provider || !/^[a-z0-9._-]+$/i.test(payeeName) || !/^[a-z0-9.-]+$/i.test(provider)) {
    throw new Error("This UPI QR code does not contain a valid payee ID.");
  }

  const currency = url.searchParams.get("cu")?.trim().toUpperCase();
  if (currency && currency !== "INR") throw new Error("This QR code requests a currency other than INR.");

  const amount = url.searchParams.get("am")?.trim() || undefined;
  if (amount && (!/^\d{1,8}(?:\.\d{1,2})?$/.test(amount) || Number(amount) <= 0 || Number(amount) > 10_000_000)) {
    throw new Error("This QR code contains an invalid payment amount.");
  }

  const safeUrl = new URL("upi://pay");
  url.searchParams.forEach((parameterValue, parameterName) => {
    const normalizedName = parameterName.toLowerCase();
    if (allowedUpiParameters.includes(normalizedName) && !safeUrl.searchParams.has(normalizedName)) {
      safeUrl.searchParams.set(normalizedName, parameterValue);
    }
  });

  return {
    uri: safeUrl.toString(),
    payeeId,
    payeeName: url.searchParams.get("pn")?.trim().slice(0, 100) || payeeId,
    amount,
    note: url.searchParams.get("tn")?.trim().slice(0, 140) || undefined,
  };
}

export function UpiQrScanner({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const activeRef = useRef(true);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState("");
  const [payment, setPayment] = useState<UpiPayment | null>(null);
  const [scanVersion, setScanVersion] = useState(0);
  const hasPaymentRef = useRef(false);

  useEffect(() => {
    activeRef.current = true;
    let controls: IScannerControls | null = null;

    async function startScanner() {
      try {
        const { BrowserQRCodeReader } = await import("@zxing/browser");
        if (!activeRef.current) return;
        const reader = new BrowserQRCodeReader();
        controls = await reader.decodeFromConstraints(
          { audio: false, video: { facingMode: { ideal: "environment" } } },
          videoRef.current ?? undefined,
          (result, _scanError, scannerControls) => {
            if (!result || !activeRef.current || hasPaymentRef.current) return;
            try {
              const parsed = parseUpiPayment(result.getText());
              hasPaymentRef.current = true;
              setPayment(parsed);
              scannerControls.stop();
              setError("");
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "This QR code could not be read as a UPI payment.");
            }
          },
        );
        controlsRef.current = controls;
        if (!activeRef.current) controls.stop();
      } catch (cause) {
        if (!activeRef.current) return;
        setError(cause instanceof Error && cause.name === "NotAllowedError"
          ? "Allow camera access to scan a UPI QR code."
          : "Could not start the camera. Check camera access or choose a QR image instead.");
      } finally {
        if (activeRef.current) setStarting(false);
      }
    }

    void startScanner();
    return () => {
      activeRef.current = false;
      controls?.stop();
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [scanVersion]);

  async function scanImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image containing a UPI QR code.");
      return;
    }
    const imageUrl = URL.createObjectURL(file);
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser");
      const result = await new BrowserQRCodeReader().decodeFromImageUrl(imageUrl);
      const parsed = parseUpiPayment(result.getText());
      hasPaymentRef.current = true;
      setPayment(parsed);
      setError("");
      controlsRef.current?.stop();
    } catch (cause) {
      setError(cause instanceof Error && cause.message.startsWith("This QR")
        ? cause.message
        : "No readable QR code was found in that image.");
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  }

  function openPaymentApp() {
    if (!payment) return;
    window.location.assign(payment.uri);
  }

  return (
    <div className="modal-backdrop upi-scanner-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section aria-labelledby="upi-scanner-title" aria-modal="true" className="upi-scanner-sheet" role="dialog">
        <button aria-label="Close QR scanner" className="close-modal" onClick={onClose} type="button"><X size={17} /></button>
        <span className="section-kicker"><QrCode size={13} /> UPI PAYMENT</span>
        <h2 id="upi-scanner-title">{payment ? "Review payment details" : "Scan a UPI QR code"}</h2>

        {!payment ? <>
          <div className="upi-camera-frame">
            <video aria-label="Camera preview for scanning a UPI QR code" autoPlay muted playsInline ref={videoRef} />
            <span className="upi-scan-corners" />
            {starting && <span className="upi-camera-status"><Camera size={16} /> Starting camera…</span>}
          </div>
          <p className="upi-scanner-help">Point your camera at a merchant UPI QR. The scanned payment details will be shown here before you continue.</p>
          <label className="upi-image-picker"><ImageUp size={16} /> Choose QR image<input accept="image/*" onChange={(event) => { void scanImage(event); }} type="file" /></label>
        </> : <>
          <div className="upi-payment-review">
            <span className="upi-payment-check"><CheckCircle2 size={21} /></span>
            <div><small>PAYING</small><strong>{payment.payeeName}</strong><span>{payment.payeeId}</span></div>
            {payment.amount && <b>₹{Number(payment.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</b>}
          </div>
          {payment.note && <p className="upi-scanner-help">Note: {payment.note}</p>}
          <p className="upi-payment-warning">Review the payee and amount in your UPI app before approving. Ziddu does not process or verify this payment.</p>
          <button className="upi-open-app-button" onClick={openPaymentApp} type="button">Continue to UPI app</button>
          <button className="upi-rescan-button" onClick={() => { hasPaymentRef.current = false; setPayment(null); setError(""); setStarting(true); setScanVersion((version) => version + 1); }} type="button">Scan another QR</button>
        </>}

        {error && <p aria-live="assertive" className="upi-scanner-error" role="alert"><AlertCircle size={15} />{error}</p>}
      </section>
    </div>
  );
}
