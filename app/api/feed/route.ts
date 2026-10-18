import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getDiscoveryData } from "@/services/discovery.service";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

  const data = await getDiscoveryData(user.id);
  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
 