import "server-only";
import { randomBytes } from "node:crypto";

const globalForAuth = globalThis as typeof globalThis & {
  zidduDevelopmentAuthSecret?: string;
};

const configuredSecret = process.env.BETTER_AUTH_SECRET;
const isProductionBuild = process.env.NEXT_PHASE === "phase-production-build";

if (!configuredSecret && process.env.NODE_ENV === "production" && !isProductionBuild) {
  throw new Error("BETTER_AUTH_SECRET must be configured in production.");
}

export const authSecret = configuredSecret ?? (
  globalForAuth.zidduDevelopmentAuthSecret ??=
    randomBytes(32).toString("base64url")
);