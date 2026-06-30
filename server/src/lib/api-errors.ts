import type { Context } from "hono";
import { logger } from "./logger.js";

export function errorResponse(c: Context, err: unknown): Response {
  const correlationId = c.get("correlationId");

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