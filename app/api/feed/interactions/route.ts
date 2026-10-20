import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { sharedPrisma } from "@/lib/db/shared-prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { postInteractionInputSchema, followInputSchema } from "@/lib/validation/domain";
import { getVendorPostsFromApi } from "@/services/vendor-posts-api.service";
import { getExternalLikesForPosts, getSharedLikeUserId, updateExternalLike } from "@/services/likes-api.service";
import { z } from "zod";

const interactionSchema = z.object({
  action: z.enum(["like", "save", "share", "follow", "direction"]),
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
  let localPost: { id: string; shopId: string } | null = null;
  try {
    localPost = await prisma.post.findUnique({ where: { id: databasePostId }, select: { id: true, shopId: true } });
  } catch {
    return NextResponse.json({ message: "Interactions are temporarily unavailable." }, { status: 503 });
  }
  let sharedPost: { id: number; vendorId: number } | null = null;
  if (!localPost && /^\d+$/.test(databasePostId)) {
    try {
      sharedPost = await sharedPrisma.sharedPost.findUnique({ where: { id: Number(databasePostId) }, select: { id: true, vendorId: true } });
    } catch {
      return NextResponse.json({ message: "Interactions are temporarily unavailable." }, { status: 503 });
    }
    if (!sharedPost) {
      try {
        const feed = await getVendorPostsFromApi(user.id);
        const feedPost = feed.posts.find((post) => post.id === databasePostId);
        const vendorId = Number(feedPost?.shopId);
        if (feedPost && Number.isInteger(vendorId)) sharedPost = { id: Number(databasePostId), vendorId };
      } catch {
        return NextResponse.json({ message: "Could not verify this vendor post. Please try again." }, { status: 503 });
      }
    }
  }
  if (!localPost && !sharedPost) {
    return NextResponse.json({ message: "Post not found." }, { status: 404 });
  }

  try {
    if (action === "direction") {
      const directionKey = { userId_targetType_targetId_action: { userId: user.id, targetType: "POST", targetId: databasePostId, action: "DIRECTION" } };
      await prisma.feedInteraction.upsert({
        where: directionKey,
        update: { active: true },
        create: { userId: user.id, targetType: "POST", targetId: databasePostId, action: "DIRECTION", active: true },
      });
      const directionCount = await prisma.feedInteraction.count({ where: { targetType: "POST", targetId: databasePostId, action: "DIRECTION", active: true } });
      return NextResponse.json({ directionCount });
    }

    if (action === "share") {
      const expectedShopId = localPost?.shopId ?? String(sharedPost!.vendorId);
      if (shopId !== expectedShopId) return NextResponse.json({ message: "Shop does not match this post." }, { status: 400 });
      await prisma.feedShare.createMany({ data: [
        { userId: user.id, targetType: "POST", targetId: databasePostId },
        { userId: user.id, targetType: "VENDOR", targetId: expectedShopId },
      ] });
      const [postShareCount, vendorShareCount] = await Promise.all([
        prisma.feedShare.count({ where: { targetType: "POST", targetId: databasePostId } }),
        prisma.feedShare.count({ where: { targetType: "VENDOR", targetId: expectedShopId } }),
      ]);
      return NextResponse.json({ shareCount: postShareCount, vendorShareCount });
    }

    if (sharedPost) {
      if (action === "like") {
        const externalUserId = await getSharedLikeUserId(user.id);
        if (externalUserId === null) {
          return NextResponse.json({ message: "Add a phone number linked to your vendor account before liking posts." }, { status: 400 });
        }
        const currentLikes = await getExternalLikesForPosts(user.id, [databasePostId]);
        const current = currentLikes.get(databasePostId);
        const nextActive = active ?? !current?.liked;
        const updated = await updateExternalLike(sharedPost.id, externalUserId, nextActive);
        const saveCount = await prisma.feedInteraction.count({ where: { targetType: "POST", targetId: databasePostId, action: "SAVE", active: true } }).catch(() => 0);
        return NextResponse.json({ active: nextActive, ...(updated ? { likeCount: updated.likeCount } : {}), saveCount });
      }

      const actionKey = action.toUpperCase();
      const uniqueKey = { userId_targetType_targetId_action: { userId: user.id, targetType: "POST", targetId: databasePostId, action: actionKey } };
      const existing = await prisma.feedInteraction.findUnique({ where: uniqueKey });
      const nextActive = active ?? !existing?.active;
      await prisma.feedInteraction.upsert({ where: uniqueKey, update: { active: nextActive }, create: { userId: user.id, targetType: "POST", targetId: databasePostId, action: actionKey, active: nextActive } });
      const [likeCount, saveCount] = await Promise.all([
        prisma.feedInteraction.count({ where: { targetType: "POST", targetId: databasePostId, action: "LIKE", active: true } }),
        prisma.feedInteraction.count({ where: { targetType: "POST", targetId: databasePostId, action: "SAVE", active: true } }),
      ]);
      return NextResponse.json({ active: nextActive, likeCount, saveCount });
    }

    if (action === "like") {
      const existing = await prisma.like.findUnique({ where: { userId_postId: key } });
      const nextActive = active ?? !existing;
      if (nextActive && !existing) {
        await prisma.like.upsert({ where: { userId_postId: key }, update: {}, create: key });
      } else if (!nextActive && existing) {
        await prisma.like.delete({ where: { id: existing.id } });
      }
      const [likeCount, saveCount] = await Promise.all([
        prisma.like.count({ where: { postId: databasePostId } }),
        prisma.save.count({ where: { postId: databasePostId } }),
      ]);
      return NextResponse.json({ active: nextActive, likeCount, saveCount });
    }

    const existing = await prisma.save.findUnique({ where: { userId_postId: key } });
    const nextActive = active ?? !existing;
    if (nextActive && !existing) {
      await prisma.save.upsert({ where: { userId_postId: key }, update: {}, create: key });
    } else if (!nextActive && existing) {
      await prisma.save.delete({ where: { id: existing.id } });
    }
    const [likeCount, saveCount] = await Promise.all([
      prisma.like.count({ where: { postId: databasePostId } }),
      prisma.save.count({ where: { postId: databasePostId } }),
    ]);
    return NextResponse.json({ active: nextActive, likeCount, saveCount });
  } catch {
    return NextResponse.json({ message: "Interactions are temporarily unavailable." }, { status: 503 });
  }
}
