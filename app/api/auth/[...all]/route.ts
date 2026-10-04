import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

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
	return safeAuthHandler(handlers.POST, request);
}