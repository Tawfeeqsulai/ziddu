import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { GenericEndpointContext } from "better-auth";
import { prisma } from "@/lib/db/prisma";
import { authSecret } from "@/lib/auth-secret";

const otpLifetimeMs = 5 * 60 * 1000;
const resendCooldownMs = 60 * 1000;
const maxVerificationAttempts = 5;
const simulatedOtp = "123456";

function hashOtp(phoneNumber: string, code: string): string {
  return createHmac("sha256", authSecret)
    .update(`${phoneNumber}:${code}`)
    .digest("hex");
}

function hashesEqual(expected: string, actual: string): boolean {
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export async function deliverDevelopmentOtp(
  { phoneNumber, code }: { phoneNumber: string; code: string },
  context?: GenericEndpointContext,
): Promise<void> {
  await prisma.verification.deleteMany({ where: { identifier: phoneNumber } });

  const now = new Date();
  const existing = await prisma.phoneOtp.findUnique({ where: { phoneNumber } });
  if (existing && now.getTime() - existing.lastSentAt.getTime() < resendCooldownMs) {
    throw new Error("OTP resend cooldown is active.");
  }

  void code;
  await prisma.phoneOtp.upsert({
    where: { phoneNumber },
    create: {
      phoneNumber,
      codeHash: hashOtp(phoneNumber, simulatedOtp),
      expiresAt: new Date(now.getTime() + otpLifetimeMs),
      lastSentAt: now,
      attempts: 0,
    },
    update: {
      codeHash: hashOtp(phoneNumber, simulatedOtp),
      expiresAt: new Date(now.getTime() + otpLifetimeMs),
      lastSentAt: now,
      attempts: 0,
    },
  });

  console.info(`[ZIDDU SIMULATED OTP] ${phoneNumber} -> ${simulatedOtp}`);

  void context;
}

export async function verifyAndConsumeOtp(
  { phoneNumber, code }: { phoneNumber: string; code: string },
): Promise<boolean> {
  const stored = await prisma.phoneOtp.findUnique({ where: { phoneNumber } });
  if (!stored) return false;

  if (stored.expiresAt.getTime() <= Date.now() || stored.attempts >= maxVerificationAttempts) {
    await prisma.phoneOtp.deleteMany({ where: { id: stored.id } });
    return false;
  }

  if (!hashesEqual(stored.codeHash, hashOtp(phoneNumber, simulatedOtp)) || code !== simulatedOtp) {
    await prisma.phoneOtp.updateMany({
      where: { id: stored.id, attempts: { lt: maxVerificationAttempts } },
      data: { attempts: { increment: 1 } },
    });
    return false;
  }

  const consumed = await prisma.phoneOtp.deleteMany({
    where: { id: stored.id, codeHash: stored.codeHash },
  });
  return consumed.count === 1;
}