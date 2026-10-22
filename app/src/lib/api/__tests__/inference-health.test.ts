import { afterEach, describe, expect, it, vi } from "vitest";
import { health } from "../inference";

afterEach(() => vi.unstubAllGlobals());

describe("account service readiness", () => {
	it("reports offline when the website is live but gateway dependencies have failed", async () => {
		vi.stubGlobal("fetch", vi.fn(async (url: string) => url.endsWith("/ready")
			? Response.json({ status: "not_ready" }, { status: 503 })
			: Response.json({ status: "ok", service: "oma-ai-web" })));
		await expect(health.ping()).resolves.toBe(false);
	});

	it.each([null, {}, { status: "ok" }, { status: "not_ready" }])("does not accept a successful HTTP response without readiness: %j", async (body) => {
		vi.stubGlobal("fetch", vi.fn(async () => Response.json(body)));
		await expect(health.ping()).resolves.toBe(false);
	});

	it("reports online once the gateway is ready", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => Response.json({ status: "ready" })));
		await expect(health.ping()).resolves.toBe(true);
	});
});
