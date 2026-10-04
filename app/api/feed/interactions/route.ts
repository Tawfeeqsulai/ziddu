import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { postInteractionInputSchema, followInputSchema } from "@/lib/validation/domain";
import { z } from "zod";

const interactionSchema = z.object({
  action: z.enum(["like", "save", "follow"]),
  active: z.boolean().optional(),
  postId: z.string().optional(),
  shopId: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user?.id) return NextResponse.json({ message: "Sign in required." }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = interactionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ message: "Invalid interaction." }, { status: 400 });

  const { action, active, postId, shopId } = parsed.data;
  if (action === "follow") {
    const target = followInputSchema.safeParse({ shopId });
    if (!target.success) return NextResponse.json({ message: "Invalid shop." }, { status: 400 });
    let shop: { id: string } | null;
    try {
      shop = await prisma.shop.findUnique({
        where: { id: target.data.shopId },
        select: { id: true },
      });
    } catch {
      return NextResponse.json({ message: "Interactions are temporarily unavailable." }, { status: 503 });
    }
    if (!shop) {
      return NextResponse.json({ message: "Shop not found." }, { status: 404 });
    }
    const key = { userId: user.id, shopId: shop.id };
    try {
      const existing = await prisma.follow.findUnique({ where: { userId_shopId: key } });
      const nextActive = active ?? !existing;
      if (nextActive && !existing) {
        await prisma.follow.upsert({ where: { userId_shopId: key }, update: {}, create: key });
      } else if (!nextActive && existing) {
        await prisma.follow.delete({ where: { id: existing.id } });
      }
      const followerCount = await prisma.follow.count({ where: { shopId: shop.id } });
      return NextResponse.json({ active: nextActive, followerCount });
    } catch {
      return NextResponse.json({ message: "Interactions are temporarily unavailable." }, { status: 503 });
    }
  }

  const target = postInteractionInputSchema.safeParse({ postId });
  if (!target.success) return NextResponse.json({ message: "Invalid post." }, { status: 400 });
  const databasePostId = target.data.postId;
  const key = { userId: user.id, postId: databasePostId };
  let post: { id: string } | null;
  try {
    post = await prisma.post.findUnique({ where: { id: databasePostId }, select: { id: true } });
  } catch {
    return NextResponse.json({ message: "Interactions are temporarily unavailable." }, { status: 503 });
  }
  if (!post) {
    return NextResponse.json({ message: "Post not found." }, { status: 404 });
  }

  try {
    if (action === "like") {
      const existing = await prisma.like.findUnique({ where: { userId_postId: key } });
      const nextActive = active ?? !existing;
      if (nextActive && !existing) {
        await prisma.like.upsert({ where: { userId_postId: key }, update: {}, create: key });
      } else if (!nextActive && existing) {
        await prisma.like.delete({ where: { id: existing.id } });
      }
      return NextResponse.json({ active: nextActive });
    }

    const existing = await prisma.save.findUnique({ where: { userId_postId: key } });
    const nextActive = active ?? !existing;
    if (nextActive && !existing) {
      await prisma.save.upsert({ where: { userId_postId: key }, update: {}, create: key });
    } else if (!nextActive && existing) {
      await prisma.save.delete({ where: { id: existing.id } });
    }
    return NextResponse.json({ active: nextActive });
  } catch {
    return NextResponse.json({ message: "Interactions are temporarily unavailable." }, { status: 503 });
  }
}
