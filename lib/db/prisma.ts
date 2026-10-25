import "server-only";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  zidduPrisma?: PrismaClient;
};

export const prisma = globalForPrisma.zidduPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.zidduPrisma = prisma;
}