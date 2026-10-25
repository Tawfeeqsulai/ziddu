import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

// Cached per request: the root layout and the page both read the session.
export const getCurrentUser = cache(async () => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user) return session.user;
  } catch {
    // Treat unavailable sessions as unauthenticated.
  }
  return null;
});

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}