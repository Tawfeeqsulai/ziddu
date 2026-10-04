import { z } from "zod";

export const interestOptions = ["RESTAURANT", "FURNITURE", "ELECTRONICS"] as const;

const usernamePattern = /^[a-z0-9](?:[a-z0-9_]*[a-z0-9])?$/;
const reservedUsernames = new Set(["admin", "administrator", "support", "ziddu", "official", "null", "undefined"]);

export const profileInputSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters.").max(80, "Name is too long."),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254, "Email address is too long.").optional().or(z.literal("")),
  phoneNumber: z.string().trim().regex(/^(?:\+91|91)?[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number.").optional().or(z.literal("")),
  username: z.string().trim().toLowerCase().max(24, "Username is too long.").optional().or(z.literal("")),
  image: z.string().trim().url("Enter a valid image URL.").max(500, "Image URL is too long.").optional().or(z.literal("")),
  bio: z.string().trim().max(160, "Bio is too long.").optional().or(z.literal("")),
  city: z.string().trim().min(2, "Choose your city.").max(80, "City is too long."),
  locality: z.string().trim().min(2, "Enter your locality.").max(100, "Locality is too long."),
  interests: z.array(z.enum(interestOptions)).min(1, "Choose at least one interest.").max(3),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;

export function normalizeUsername(value: string | undefined) {
  const username = value?.trim().toLowerCase() ?? "";
  if (!username) return null;
  if (username.length < 3 || !usernamePattern.test(username) || reservedUsernames.has(username)) return null;
  return username;
}

export function profileValues(input: ProfileInput) {
  return {
    name: input.name,
    ...(input.phoneNumber ? { phoneNumber: normalizeProfilePhone(input.phoneNumber) } : {}),
    username: normalizeUsername(input.username) ?? null,
    image: input.image?.trim() || null,
    bio: input.bio?.trim() || null,
    city: input.city,
    locality: input.locality,
    interests: input.interests,
  };
}

function normalizeProfilePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return `+91${digits.length === 12 ? digits.slice(2) : digits}`;
}
