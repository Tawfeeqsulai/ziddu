import "server-only";
import { PrismaClient } from "@/lib/db/generated/shared";

const globalForSharedPrisma = globalThis as typeof globalThis & {
  zidduSharedPrisma?: PrismaClient;
};

export const sharedPrisma = globalForSharedPrisma.zidduSharedPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForSharedPrisma.zidduSharedPrisma = sharedPrisma;
}
