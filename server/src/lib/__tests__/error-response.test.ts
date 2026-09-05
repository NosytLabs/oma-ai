import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { errorResponse } from "../error-response";

describe("errorResponse", () => {
	const buildCtx = () => {
		const app = new Hono();
		let captured: { status: number; body: unknown } | null = null;
		app.get("/test", (c) => {
			const status = Number(c.req.query("status") ?? "500");
			return errorResponse(c, c.req.query("message") ?? "boom", status as never);
		});
		return async (status: number, message: string) => {
			const res = await app.request(`/test?status=${status}&message=${encodeURIComponent(message)}`);
			captured = { status: res.status, body: await res.json() };
			return captured;
		};
	};

	it("uses OpenAI-shaped body (error.message + error.type)", async () => {
		const ctx = buildCtx();
		const result = await ctx(400, "Missing field");
		expect(result?.body).toEqual({
			error: { message: "Missing field", type: "invalid_request_error" },
		});
	});

	it("maps status 400 → invalid_request_error", async () => {
		const ctx = buildCtx();
		const result = await ctx(400, "bad");
		expect((result?.body as { error: { type: string } }).error.type).toBe("invalid_request_error");
	});

	it("maps status 401 → authentication_error", async () => {
		const ctx = buildCtx();
		const result = await ctx(401, "bad key");
		expect((result?.body as { error: { type: string } }).error.type).toBe("authentication_error");
	});

	it("maps status 403 → permission_error", async () => {
		const ctx = buildCtx();
		const result = await ctx(403, "nope");
		expect((result?.body as { error: { type: string } }).error.type).toBe("permission_error");
	});

	it("maps status 404 → not_found_error", async () => {
		const ctx = buildCtx();
		const result = await ctx(404, "missing");
		expect((result?.body as { error: { type: string } }).error.type).toBe("not_found_error");
	});

	it("maps status 429 → rate_limit_error", async () => {
		const ctx = buildCtx();
		const result = await ctx(429, "slow down");
		expect((result?.body as { error: { type: string } }).error.type).toBe("rate_limit_error");
	});

	it("maps status 500 → api_error", async () => {
		const ctx = buildCtx();
		const result = await ctx(500, "broken");
		expect((result?.body as { error: { type: string } }).error.type).toBe("api_error");
	});

	it("maps status 503 → service_unavailable", async () => {
		const ctx = buildCtx();
		const result = await ctx(503, "down");
		expect((result?.body as { error: { type: string } }).error.type).toBe("service_unavailable");
	});

	it("includes code when provided", async () => {
		const app = new Hono();
		app.get("/test", (c) =>
			errorResponse(c, "expired", 401, { code: "expired_api_key" }),
		);
		const res = await app.request("/test");
		const body = await res.json();
		expect(body.error.code).toBe("expired_api_key");
	});

	it("respects explicit type override", async () => {
		const app = new Hono();
		app.get("/test", (c) =>
			errorResponse(c, "down", 500, { type: "service_unavailable" }),
		);
		const res = await app.request("/test");
		const body = await res.json();
		expect(body.error.type).toBe("service_unavailable");
	});
});
