import { beforeEach, describe, expect, it, vi } from "vitest";
import { originGuard } from "../origin-guard.js";

const originConfig = vi.hoisted(() => ({
	NODE_ENV: "test", PUBLIC_APP_URL: "http://localhost:3000", PRIMARY_DOMAIN: "localhost",
}));
vi.mock("../../config.js", () => ({ config: originConfig }));
beforeEach(() => Object.assign(originConfig, {	NODE_ENV: "test", PUBLIC_APP_URL: "http://localhost:3000", PRIMARY_DOMAIN: "localhost" }));

const APP = "https://oma-ai.com";

function ctx(method: string, headers: Record<string, string>, env: Record<string, string> = { PUBLIC_APP_URL: APP }) {
	const h = { ...headers };
	return {
		req: { method, header: (k: string) => h[k.toLowerCase()] },
		env,
		header: () => {},
		json: (_b: unknown, status: number) => ({ status }),
	} as never;
}

const next = async () => {};

describe("originGuard", () => {
	it("uses the parsed local default when PUBLIC_APP_URL is absent from the request environment", async () => {
		await expect(originGuard()(ctx("POST", { origin: "http://localhost:3000" }, {}), next)).resolves.toBeUndefined();
	});

	it("accepts the canonical deployed origin when PUBLIC_APP_URL is stale localhost", async () => {
		Object.assign(originConfig, { NODE_ENV: "production", PRIMARY_DOMAIN: "oma-ai.com" });
		await expect(originGuard()(ctx("POST", { origin: "https://www.oma-ai.com" }, {}), next)).resolves.toBeUndefined();
	});

	it("rejects stale localhost origins on a deployed domain", async () => {
		Object.assign(originConfig, { NODE_ENV: "production", PRIMARY_DOMAIN: "oma-ai.com" });
		expect(await originGuard()(ctx("POST", { origin: "http://localhost:3000" }, { PUBLIC_APP_URL: "http://localhost:3000" }), next)).toMatchObject({ status: 403 });
	});

	it("passes same-origin mutations", async () => {
		const mw = originGuard();
		await expect(mw(ctx("POST", { origin: APP }), next)).resolves.toBeUndefined();
	});

	it("passes a same-host origin on the configured scheme", async () => {
		// The app may be reached over either scheme depending on the proxy;
		// the host is the security boundary, not the scheme.
		const mw = originGuard();
		await expect(
			mw(ctx("POST", { origin: "https://www.oma-ai.com" }), next),
		).resolves.toBeUndefined();
	});

	it("rejects a cross-site mutation", async () => {
		const mw = originGuard();
		const res = (await mw(ctx("POST", { origin: "https://evil.example" }), next)) as { status: number };
		expect(res.status).toBe(403);
	});

	it("rejects a sibling subdomain that is not the app host", async () => {
		const mw = originGuard();
		const res = (await mw(ctx("POST", { origin: "https://attacker.oma-ai.com" }), next)) as { status: number };
		expect(res.status).toBe(403);
	});

	it("falls back to Referer when Origin is absent", async () => {
		const mw = originGuard();
		await expect(
			mw(ctx("POST", { referer: `${APP}/dashboard` }), next),
		).resolves.toBeUndefined();
	});

	it("rejects a cross-site Referer", async () => {
		const mw = originGuard();
		const res = (await mw(ctx("POST", { referer: "https://evil.example/x" }), next)) as { status: number };
		expect(res.status).toBe(403);
	});

	it("rejects a mutation with neither header", async () => {
		const mw = originGuard();
		const res = (await mw(ctx("POST", {}), next)) as { status: number };
		expect(res.status).toBe(403);
	});

	it("can allow a missing header when the caller opts in", async () => {
		const mw = originGuard({ allowMissing: true });
		await expect(mw(ctx("POST", {}), next)).resolves.toBeUndefined();
	});

	it("does not gate safe methods", async () => {
		const mw = originGuard();
		for (const method of ["GET", "HEAD", "OPTIONS"]) {
			await expect(mw(ctx(method, { origin: "https://evil.example" }), next)).resolves.toBeUndefined();
		}
	});

	it("honours extra allowed origins", async () => {
		const mw = originGuard({ allowedOrigins: ["https://app.oma-ai.com"] });
		await expect(
			mw(ctx("POST", { origin: "https://app.oma-ai.com" }), next),
		).resolves.toBeUndefined();
	});
});
