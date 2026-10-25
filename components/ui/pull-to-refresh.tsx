"use client";

import { RotateCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

const TRIGGER_DISTANCE = 72;
const MAX_PULL = 110;
// Gestures here belong to the element itself (maps, reels, dialogs, form fields).
const IGNORED_TARGETS = ".route-map, .reels-page, [role=dialog], .modal-backdrop, .login-prompt-backdrop, input, textarea, select";

function isScrolledInside(target: Element | null) {
  for (let element = target; element && element !== document.body; element = element.parentElement) {
    if (element.scrollTop > 0) return true;
  }
  return false;
}

/**
 * Pull down at the top of a page to re-fetch its server data with router.refresh(),
 * keeping client state and scroll position instead of reloading the document.
 */
export function PullToRefresh() {
  const router = useRouter();
  const [pull, setPull] = useState(0);
  const [refreshing, startRefresh] = useTransition();
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    function reset() {
      startY.current = null;
      pullRef.current = 0;
      setPull(0);
    }

    function onTouchStart(event: TouchEvent) {
      const target = event.target instanceof Element ? event.target : null;
      if (event.touches.length !== 1 || window.scrollY > 0 || target?.closest(IGNORED_TARGETS) || isScrolledInside(target)) return;
      startY.current = event.touches[0].clientY;
    }

    function onTouchMove(event: TouchEvent) {
      if (startY.current === null) return;
      const distance = event.touches[0].clientY - startY.current;
      if (distance <= 0 || window.scrollY > 0) { reset(); return; }
      pullRef.current = Math.min(MAX_PULL, distance * 0.5);
      setPull(pullRef.current);
    }

    function onTouchEnd() {
      if (startY.current === null) return;
      const shouldRefresh = pullRef.current >= TRIGGER_DISTANCE;
      reset();
      if (shouldRefresh) startRefresh(() => router.refresh());
    }

    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", reset);
    return () => {
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", reset);
    };
  }, [router]);

  if (!refreshing && pull === 0) return null;
  const offset = refreshing ? TRIGGER_DISTANCE * 0.75 : pull * 0.75;
  return <div aria-live="polite" className={`pull-to-refresh${refreshing ? " is-refreshing" : ""}${pull >= TRIGGER_DISTANCE ? " is-ready" : ""}`} role="status" style={{ transform: `translate(-50%, ${offset}px)` }}>
    <RotateCw aria-hidden="true" size={18} style={refreshing ? undefined : { transform: `rotate(${pull * 3}deg)` }} />
    <span className="sr-only">{refreshing ? "Refreshing" : pull >= TRIGGER_DISTANCE ? "Release to refresh" : "Pull to refresh"}</span>
  </div>;
}
