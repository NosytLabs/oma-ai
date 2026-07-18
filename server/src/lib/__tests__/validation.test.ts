import { describe, it, expect } from "vitest";
import { z } from "zod";
import { validationError } from "../validation";

describe("validationError", () => {
	it("returns structured error from ZodError", () => {
		const schema = z.object({ name: z.string(), age: z.number() });
		const result = schema.safeParse({ name: 123, age: "not-a-number" });
		expect(result.success).toBe(false);
		if (!result.success) {
			const err = validationError(result.error);
			expect(err).toHaveProperty("error.message");
			expect(err).toHaveProperty("error.type", "invalid_request_error");
			expect(typeof err.error.message).toBe("string");
			expect(err.error.message).toMatch(/Validation error/);
		}
	});

	it("joins multiple Zod issues into a single message", () => {
		const schema = z.object({ a: z.string(), b: z.number() });
		const result = schema.safeParse({ a: 1, b: "x" });
		expect(result.success).toBe(false);
		if (!result.success) {
			const err = validationError(result.error);
			// Both field errors should appear
			expect(err.error.message).toContain(", ");
		}
	});

	it("always returns type 'invalid_request_error'", () => {
		const schema = z.string();
		const result = schema.safeParse(42);
		expect(result.success).toBe(false);
		if (!result.success) {
			const err = validationError(result.error);
			expect(err.error.type).toBe("invalid_request_error");
		}
	});
});