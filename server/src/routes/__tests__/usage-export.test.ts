import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OmaEnv } from "../../types.js";

const fixture = vi.hoisted(() => ({ rows: [] as Record<string, unknown>[] }));
vi.mock("../../db/client.js", () => ({ db: { select: () => {
	const query = { from: () => query, where: () => query, orderBy: () => query,
		limit: async (count: number) => fixture.rows.slice(0, count) };
	return query;
} } }));
vi.mock("../../auth/middleware.js", () => ({ sessionAuth: async (c: { set: (key: string, value: string) => void }, next: () => Promise<void>) => {
	c.set("userId", "export-owner"); await next();
} }));
const { exportRoutes } = await import("../export.js");
const app = new Hono<OmaEnv>().route("/", exportRoutes);
beforeEach(() => { fixture.rows = []; });

describe("usage export contract", () => {
	it.each(["since=invalid", "format=exe", "since=2026-10-11T00:00:00Z&until=2026-10-10T00:00:00Z"])("rejects invalid export filters: %s", async query => {
		expect((await app.request(`/v1/export/usage?${query}`)).status).toBe(400);
	});
	it("reports the exact bounded row count and warns that a larger export was truncated", async () => {
		fixture.rows = Array.from({ length: 10001 }, (_, n) => ({ request_id: `r-${n}`, total_cents: "0.00000600" }));
		const response = await app.request("/v1/export/usage?format=json");
		expect(await response.json()).toHaveLength(10000);
		expect(response.headers.get("X-Export-Row-Count")).toBe("10000");
		expect(response.headers.get("X-Export-Truncated")).toBe("true");
		expect(response.headers.get("Cache-Control")).toBe("private, no-store");
	});
	it("keeps column headings for an empty CSV and does not claim truncation", async () => {
		const response = await app.request("/v1/export/usage");
		expect(await response.text()).toContain("request_id,api_key_id,model,requested_model,provider");
		expect(response.headers.get("X-Export-Row-Count")).toBe("0");
		expect(response.headers.get("X-Export-Truncated")).toBe("false");
	});
	it("neutralizes spreadsheet formulas and quotes carriage returns while preserving tiny amounts", async () => {
		fixture.rows = [{ request_id: '=HYPERLINK("https://example.com")', model: "first\rsecond", total_cents: "0.00000600" }];
		const csv = await (await app.request("/v1/export/usage")).text();
		expect(csv).toContain("'=HYPERLINK");
		expect(csv).toContain('"first\rsecond"');
		expect(csv).toContain("0.00000600");
	});
});
