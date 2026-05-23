import { z } from "zod";

export function validationError(err: z.ZodError) {
  return { error: { message: `Validation error: ${err.errors.map((e) => e.message).join(", ")}`, type: "invalid_request_error" as const } };
}