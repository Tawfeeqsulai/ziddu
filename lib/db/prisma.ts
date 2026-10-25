import "server-only";
import { pooledDatabaseUrl } from "@/lib/db/database-url";
import { PrismaClient } from "@/lib/db/generated/main";

const globalForPrisma = globalThis as typeof globalThis & {
  zidduPrisma?: PrismaClient;
};

// Replace a client generated before the shared vendor models were added. Check
// the model delegate instead of instanceof so HMR keeps reusing the same pool.
const existingPrisma = globalForPrisma.zidduPrisma as (PrismaClient & { sharedVendor?: unknown }) | undefined;
if (existingPrisma && !existingPrisma.sharedVendor) {
  void existingPrisma.$disconnect().catch(() => undefined);
  globalForPrisma.zidduPrisma = undefined;
}

export const prisma = globalForPrisma.zidduPrisma ?? new PrismaClient({ datasourceUrl: pooledDatabaseUrl() });

// Reuse one client per instance (and across dev hot reloads) so pools are never duplicated.
globalForPrisma.zidduPrisma = prisma;
