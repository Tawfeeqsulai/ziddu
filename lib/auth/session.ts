import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export async function getCurrentUser() {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    if (session?.user) return session.user;
  } catch {
    // Treat unavailable sessions as unauthenticated.
  }
  return null;
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}