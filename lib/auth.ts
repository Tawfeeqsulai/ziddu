import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { phoneNumber } from "better-auth/plugins";
import { authSecret } from "@/lib/auth-secret";
import { isNormalizedIndianPhone } from "@/lib/auth/phone";
import { deliverDevelopmentOtp, verifyAndConsumeOtp } from "@/lib/auth/phone-otp";
import { prisma } from "@/lib/db/prisma";

export const auth = betterAuth({
  appName: "ZIDDU",
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: authSecret,
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://localhost:3000"],
  rateLimit: { enabled: true },
  database: prismaAdapter(prisma, { provider: "mysql" }),
  socialProviders: process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      },
    }
    : {},
  user: {
    additionalFields: {
      onboardingCompleted: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
    },
  },
  plugins: [
    phoneNumber({
      otpLength: 6,
      expiresIn: 300,
      allowedAttempts: 5,
      requireVerification: true,
      phoneNumberValidator: isNormalizedIndianPhone,
      sendOTP: deliverDevelopmentOtp,
      verifyOTP: verifyAndConsumeOtp,
      signUpOnVerification: {
        getTempEmail: (phone) => `${phone.slice(1)}@phone.ziddu.invalid`,
        getTempName: () => "ZIDDU member",
      },
    }),
  ],
});