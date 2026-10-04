import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getReels } from "@/services/reels.service";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Sign in required." }, { status: 401 });
  const pageValue = new URL(request.url).searchParams.get("page");
  const postId = new URL(request.url).searchParams.get("post") ?? undefined;
  const page = Math.max(1, Math.min(Number.parseInt(pageValue ?? "1", 10) || 1, 20));
  return NextResponse.json(await getReels(user.id, page, postId));
}
