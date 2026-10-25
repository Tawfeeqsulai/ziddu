import "server-only";

// Shared vendor tables use the main client so the app opens one Prisma pool.
const legacyClient = globalThis as typeof globalThis & {
  zidduSharedPrisma?: { $disconnect: () => Promise<void> };
};
if (legacyClient.zidduSharedPrisma) {
  const oldClient = legacyClient.zidduSharedPrisma;
  legacyClient.zidduSharedPrisma = undefined;
  void oldClient.$disconnect().catch(() => undefined);
}

export { prisma as sharedPrisma } from "@/lib/db/prisma";
