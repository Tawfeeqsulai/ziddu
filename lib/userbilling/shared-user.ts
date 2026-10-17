import "server-only";

import { normalizeIndianPhone } from "@/lib/auth/phone";
import { sharedPrisma } from "@/lib/db/shared-prisma";

export async function syncSharedOrderingUser(phoneNumber: string) {
  const normalizedPhone = normalizeIndianPhone(phoneNumber);
  if (!normalizedPhone) return null;

  const nationalNumber = normalizedPhone.slice(3);
  const phoneVariants = [normalizedPhone, nationalNumber, `91${nationalNumber}`, `0${nationalNumber}`];
  const existing = await sharedPrisma.sharedUser.findFirst({ where: { phoneNumber: { in: phoneVariants } } });
  if (existing) return existing;

  return sharedPrisma.sharedUser.create({
    data: { phoneNumber: nationalNumber, userType: "user", status: "active" },
  });
}
