import "server-only";
import { ZodError } from "zod";

export type ApiErrorCode =
  | "INVALID_INPUT"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR";

const statusByCode: Record<ApiErrorCode, number> = {
  INVALID_INPUT: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  constructor(
    public readonly code: Exclude<ApiErrorCode, "INVALID_INPUT" | "INTERNAL_ERROR">,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function apiErrorResponse(error: unknown): Response {
  if (error instanceof ZodError) {
    return Response.json(
      {
        error: {
          code: "INVALID_INPUT",
          message: "The submitted data is invalid.",
          issues: error.issues.map(({ path, message }) => ({ path, message })),
        },
      },
      { status: statusByCode.INVALID_INPUT },
    );
  }

  if (error instanceof ApiError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: statusByCode[error.code] },
    );
  }

  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "An unexpected server error occurred." } },
    { status: statusByCode.INTERNAL_ERROR },
  );
}