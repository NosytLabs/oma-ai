import { afterEach, describe, expect, it, vi } from "vitest";
import { withRateLimit } from "./rate-limit-middleware";
import { RateLimiter } from "./rate-limiter";

afterEach(() => vi.unstubAllEnvs());
describe("public route visitor identity", () => {
	it("changing untrusted forwarding headers cannot refresh a Vercel visitor's budget", async () => {
		vi.stubEnv("VERCEL", "1");
		const limiter = new RateLimiter(1, 60_000);
		const handler = withRateLimit(async () => Response.json({ ok:true }), { limiter, route:"/test" });
		try {
			for (const [ip, expected] of [["198.51.100.1", 200], ["198.51.100.2", 429]] as const) {
				const req = new Request("https://oma.example/test", { headers:{ "x-vercel-forwarded-for":"203.0.113.1", "x-forwarded-for":ip, "x-real-ip":ip } });
				expect((await handler(req)).status).toBe(expected);
			}
		} finally { limiter.destroy(); }
	});
	it("an arbitrary custom-proxy setting cannot authenticate client headers", async () => {
		vi.stubEnv("VERCEL", ""); vi.stubEnv("TRUSTED_PROXY_IPS", "127.0.0.1");
		const limiter = new RateLimiter(1, 60_000);
		const handler = withRateLimit(async () => Response.json({ ok:true }), { limiter, route:"/test" });
		try {
			for (const [ip, expected] of [["198.51.100.1", 200], ["198.51.100.2", 429]] as const) {
				expect((await handler(new Request("http://local/test", { headers:{ "x-forwarded-for":ip, "x-vercel-forwarded-for":ip } }))).status).toBe(expected);
			}
		} finally { limiter.destroy(); }
	});
});
