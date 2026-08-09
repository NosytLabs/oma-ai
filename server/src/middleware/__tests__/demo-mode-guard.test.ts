import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { Hono } from "hono";
import { demoModeGuard } from "../demo-mode-guard.js";
import { logger } from "../../lib/logger.js";
import type { OmaEnv } from "../../types.js";

function buildApp(extraHandler?: (c: any) => any) {
	const app = new Hono<OmaEnv>();
	app.use("/v1/*", (c, next) => {
		c.set("correlationId", "test-corr-id");
		return next();
	});
	app.use("/v1/*", demoModeGuard);
	app.post("/v1/echo", (c) => c.json({ ok: true }));
	app.put("/v1/echo", (c) => c.json({ ok: true }));
	app.patch("/v1/echo", (c) => c.json({ ok: true }));
	app.delete("/v1/echo", (c) => c.json({ ok: true }));
	app.get("/v1/echo", (c) => c.json({ ok: true }));
	app.on("HEAD", "/v1/echo", (c) => c.body(null, 204));
	app.on("OPTIONS", "/v1/echo", (c) => c.body(null, 204));
	if (extraHandler) app.all("/v1/echo", extraHandler);
	return app;
}

describe("demoModeGuard", () => {
	// `logger` is a module singleton — re-spying in beforeEach without
	// restoring the previous spy would chain them, so we install the
	// spy once and `mockClear` its call log between tests.
	const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => logger);

	beforeEach(() => {
		warnSpy.mockClear();
	});

	afterAll(() => {
		warnSpy.mockRestore();
	});

	it("allows POST when no demo cookie is present", async () => {
		const app = buildApp();
		const res = await app.request("/v1/echo", { method: "POST" });
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
		expect(warnSpy).not.toHaveBeenCalled();
	});

	it("blocks POST when the HttpOnly oma-demo cookie is set to 1", async () => {
		const app = buildApp();
		const res = await app.request("/v1/echo", {
			method: "POST",
			headers: { Cookie: "oma-demo=1" },
		});
		expect(res.status).toBe(403);
		const body = await res.json();
		expect(body.error.message).toBe("Demo mode is read-only");
		expect(body.error.type).toBe("forbidden");
		expect(body.error.code).toBe("demo_mode_read_only");
		expect(warnSpy).toHaveBeenCalledOnce();
		const logArg = warnSpy.mock.calls[0]?.[0] as Record<string, unknown>;
		expect(logArg.event).toBe("demo_mutation_blocked");
		expect(logArg.method).toBe("POST");
		expect(logArg.path).toBe("/v1/echo");
	});

	it("blocks PUT / PATCH / DELETE on demo sessions", async () => {
		const app = buildApp();
		for (const method of ["PUT", "PATCH", "DELETE"] as const) {
			const res = await app.request("/v1/echo", {
				method,
				headers: { Cookie: "oma-demo=1" },
			});
			expect(res.status).toBe(403);
			const body = await res.json();
			expect(body.error.message).toBe("Demo mode is read-only");
		}
		expect(warnSpy).toHaveBeenCalledTimes(3);
	});

	it("allows GET / HEAD / OPTIONS for demo sessions (UI render path)", async () => {
		const app = buildApp();
		for (const method of ["GET", "HEAD", "OPTIONS"] as const) {
			const res = await app.request("/v1/echo", {
				method,
				headers: { Cookie: "oma-demo=1" },
			});
			expect([200, 204]).toContain(res.status);
		}
		expect(warnSpy).not.toHaveBeenCalled();
	});

	it("ignores a forged oma-demo-public cookie (client-readable, not trusted)", async () => {
		const app = buildApp();
		const res = await app.request("/v1/echo", {
			method: "POST",
			headers: { Cookie: "oma-demo-public=1" },
		});
		expect(res.status).toBe(200);
		expect(warnSpy).not.toHaveBeenCalled();
	});

	it("ignores a demo cookie with a value other than '1'", async () => {
		const app = buildApp();
		const res = await app.request("/v1/echo", {
			method: "POST",
			headers: { Cookie: "oma-demo=0; oma-demo=other" },
		});
		expect(res.status).toBe(200);
		expect(warnSpy).not.toHaveBeenCalled();
	});

	it("accepts a real Cookie header (uppercase) variant for the demo cookie", async () => {
		// Some clients send a lowercased `cookie` header. Read both forms
		// so the guard is robust to either — but a demo flag value of "0"
		// must NOT block.
		const app = buildApp();
		const res = await app.request("/v1/echo", {
			method: "POST",
			headers: { cookie: "oma-demo=0" },
		});
		expect(res.status).toBe(200);
	});

	it("does not block mutations on paths outside /v1/* (webhooks etc.)", async () => {
		const app = new Hono<OmaEnv>();
		app.use("/v1/*", (c, next) => {
			c.set("correlationId", "test-corr-id");
			return next();
		});
		app.use("/v1/*", demoModeGuard);
		app.post("/webhooks/example", (c) => c.json({ ok: true }));
		const res = await app.request("/webhooks/example", {
			method: "POST",
			headers: { Cookie: "oma-demo=1" },
		});
		expect(res.status).toBe(200);
		expect(warnSpy).not.toHaveBeenCalled();
	});
});
