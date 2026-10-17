"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export default function ProfileSignOutButton() {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.replace("/login");
    router.refresh();
  }

  return <button className="profile-action profile-sign-out" onClick={() => { void signOut(); }} type="button"><LogOut size={18} /><span>Log out</span></button>;
}
