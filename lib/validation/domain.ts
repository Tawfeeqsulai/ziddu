import { z } from "zod";
import { BUSINESS_CATEGORIES } from "@/types/commerce";

export const resourceIdSchema = z.string().min(1).max(191);

export const indianPhoneSchema = z.string().regex(/^\+91[6-9]\d{9}$/, "Enter a valid +91 mobile number.");

export const locationInputSchema = z.object({
  address: z.string().trim().min(5).max(240),
  locality: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(100),
  pincode: z.string().regex(/^[1-9]\d{5}$/).optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
});

export const userProfileInputSchema = z.object({
  name: z.string().trim().min(2).max(80),
  phoneNumber: indianPhoneSchema.optional(),
});

export const shopInputSchema = z.object({
  name: z.string().trim().min(2).max(100),
  handle: z.string().trim().min(3).max(40).regex(/^[a-z0-9._-]+$/),
  category: z.enum(BUSINESS_CATEGORIES),
  phone: indianPhoneSchema,
  location: locationInputSchema,
});

export const postInputSchema = z.object({
  shopId: resourceIdSchema,
  type: z.enum(["IMAGE", "VIDEO"]),
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2200),
  mediaUrl: z.string().url(),
  thumbnailUrl: z.string().url().optional(),
  hashtags: z.array(z.string().regex(/^#[\p{L}\p{N}_]+$/u).max(65)).max(20).default([]),
});

export const productInputSchema = z.object({
  shopId: resourceIdSchema,
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().min(2).max(2000),
  priceInr: z.number().int().positive(),
  imageUrl: z.string().url().optional(),
});

export const offerInputSchema = z.object({
  postId: resourceIdSchema,
  productId: resourceIdSchema.optional(),
  priceInr: z.number().int().positive(),
  originalPriceInr: z.number().int().positive().optional(),
  startsAt: z.coerce.date().optional(),
  endsAt: z.coerce.date().optional(),
}).refine(
  (offer) => offer.originalPriceInr === undefined || offer.originalPriceInr >= offer.priceInr,
  { path: ["originalPriceInr"], message: "Original price must not be lower than the offer price." },
);

export const followInputSchema = z.object({ shopId: resourceIdSchema });
export const postInteractionInputSchema = z.object({ postId: resourceIdSchema });