import type { Context } from "hono";
import { logger } from "./logger.js";

export class ApiError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly details?: unknown;

  constructor(
    message: string,
    code: string,
    status: number,
    details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorResponse(c: Context, err: unknown): Response {
  const correlationId = c.get("correlationId");

  if (err instanceof ApiError) {
    logger.error({
      correlationId,
      error: {
        message: err.message,
        code: err.code,
        status: err.status,
        details: err.details,
        stack: err.stack,
      },
      type: "api_error",
    });

    return c.json(
      {
        error: {
          message: err.message,
          type: err.code,
          correlationId,
        },
      },
      err.status as 400 | 401 | 403 | 404 | 409 | 422 | 500
    );
  }

  if (err instanceof Error) {
    logger.error({
      correlationId,
      error: {
        message: err.message,
        name: err.name,
        stack: err.stack,
      },
      type: "internal_error",
    });

    return c.json(
      {
        error: {
          message: "Internal server error",
          type: "server_error",
          correlationId,
        },
      },
      500
    );
  }

  logger.error({
    correlationId,
    error: { message: String(err) },
    type: "unknown_error",
  });

  return c.json(
    {
      error: {
        message: "Internal server error",
        type: "server_error",
        correlationId,
      },
    },
    500
  );
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}