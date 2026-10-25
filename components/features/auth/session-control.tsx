"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Gift, LogOut, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { useLoginPrompt } from "@/components/features/auth/login-prompt-provider";

export default function SessionControl({ iconButton = false }: { iconButton?: boolean }) {
  const router = useRouter();
  const { requireLogin } = useLoginPrompt();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { data, isPending } = authClient.useSession();

  useEffect(() => {
    if (!open) return;
    function closeOnOutsideClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  if (isPending) {
    return <span aria-label="Checking sign-in status" className="avatar-button avatar-loading">…</span>;
  }

  if (!data?.user) {
    return <button aria-label="Sign in" className={iconButton ? "home-mobile-icon" : "avatar-button"} onClick={() => { requireLogin(); }} type="button">{iconButton ? <UserRound size={17} /> : "RK"}</button>;
  }

  const initials = data.user.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  async function signOut() {
    await authClient.signOut();
    setOpen(false);
    router.replace("/");
    router.refresh();
  }

  return <div className="account-menu" ref={menuRef}>
    <button aria-expanded={open} aria-haspopup="menu" aria-label="Open account menu" className={iconButton ? "home-mobile-icon" : "avatar-button signed-in-avatar"} onClick={() => setOpen((current) => !current)} type="button">{iconButton ? <UserRound size={17} /> : initials}</button>
    {open && <div aria-label="Account menu" className="account-menu-panel" role="menu">
      <div className="account-menu-heading"><strong>{data.user.name}</strong></div>
      <Link href="/profile" onClick={() => setOpen(false)} role="menuitem"><UserRound size={15} /> View profile</Link>
      <Link href="/affiliate" onClick={() => setOpen(false)} role="menuitem"><Gift size={15} /> Affiliate program</Link>
      <button onClick={() => { void signOut(); }} role="menuitem" type="button"><LogOut size={15} /> Log out</button>
    </div>}
  </div>;
}
