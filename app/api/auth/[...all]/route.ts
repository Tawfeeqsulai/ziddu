import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { normalizeIndianPhone } from "@/lib/auth/phone";
import { prisma } from "@/lib/db/prisma";

const handlers = toNextJsHandler(auth);

async function safeAuthHandler(
	handler: (request: Request) => Promise<Response>,
	request: Request,
): Promise<Response> {
	try {
		const response = await handler(request);
		if (response.status < 500) return response;
	} catch {
		// Return the same generic response as an internal Better Auth failure.
	}

	return Response.json(
		{ message: "Authentication service is temporarily unavailable." },
		{ status: 503 },
	);
}

export function GET(request: Request) {
	return safeAuthHandler(handlers.GET, request);
}

export function POST(request: Request) {
  return handlePost(request);
}

async function handlePost(request: Request) {
  const isPhoneVerification = new URL(request.url).pathname.endsWith("/phone-number/verify");
  const body = isPhoneVerification
    ? await request.clone().json().catch(() => null) as { phoneNumber?: unknown; name?: unknown } | null
    : null;
  const phoneNumber = typeof body?.phoneNumber === "string" ? normalizeIndianPhone(body.phoneNumber) : null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const response = await safeAuthHandler(handlers.POST, request);

  if (isPhoneVerification && response.ok && phoneNumber && name.length >= 2) {
    await prisma.user.updateMany({ where: { phoneNumber }, data: { name } });
  }

  return response;
}
