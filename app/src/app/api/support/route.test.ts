import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

function makeRequest(body: unknown): Request {
	return new Request("http://localhost/api/support", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("POST /api/support", () => {
	beforeEach(() => vi.stubEnv("SUPPORT_WEBHOOK_URL", ""));
	afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.useRealTimers(); });

	it("does not acknowledge delivery when no support transport is configured", async () => {
		const res = await POST(makeRequest({ topic: "General", email: "a@b.com", message: "Please help with my request" }));
		expect(res.status).toBe(503);
		const body = await res.json();
		expect(body.ok).not.toBe(true);
		expect(body.ticket).toBeUndefined();
	});

	it.each([
		["null", null],
		["numeric topic", { topic: 1, email: "a@b.com", message: "hello world" }],
		["array email", { topic: "General", email: [], message: "hello world" }],
		["object message", { topic: "General", email: "a@b.com", message: {} }],
		["prototype topic", { topic: "toString", email: "a@b.com", message: "hello world" }],
		["oversized message", { topic: "General", email: "a@b.com", message: "x".repeat(10_001) }],
	])("rejects %s without forwarding or crashing", async (_name, body) => {
		const res = await POST(makeRequest(body));
		expect(res.status).toBe(400);
	});

	it("returns a retryable failure when the delivery service stalls", async () => {
		vi.useFakeTimers(); vi.stubEnv("SUPPORT_WEBHOOK_URL", "https://support.example.test/receive");
		let rejectFetch!: (reason: unknown) => void;
		vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
			rejectFetch = reject;
			init.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
		})));
		let status: number | undefined;
		const pending = POST(makeRequest({ topic: "General", email: "a@b.com", message: "hello world" })).then(res => { status = res.status; });
		await vi.advanceTimersByTimeAsync(10_000);
		try { expect(status).toBe(502); }
		finally { rejectFetch(new Error("test cleanup")); await pending; }
	});
	it("rejects empty body with 400", async () => {
		const res = await POST(
			new Request("http://localhost/api/support", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: "not-json",
			}),
		);
		expect(res.status).toBe(400);
	});

	it("rejects unknown topic with 400", async () => {
		const res = await POST(
			makeRequest({ topic: "Nope", email: "a@b.com", message: "hello world" }),
		);
		expect(res.status).toBe(400);
	});

	it("rejects invalid email with 400", async () => {
		const res = await POST(
			makeRequest({ topic: "General", email: "not-an-email", message: "hello world" }),
		);
		expect(res.status).toBe(400);
	});

	it("rejects too-short message with 400", async () => {
		const res = await POST(
			makeRequest({ topic: "General", email: "a@b.com", message: "hi" }),
		);
		expect(res.status).toBe(400);
	});

	it("rejects malformed wallet with 400", async () => {
		const res = await POST(
			makeRequest({
				topic: "General",
				email: "a@b.com",
				message: "hello world",
				wallet: "0xZZZZ",
			}),
		);
		expect(res.status).toBe(400);
	});

	it("returns 202 with ticket id on success", async () => {
		vi.stubEnv("SUPPORT_WEBHOOK_URL", "https://support.example.test/receive");
		vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 202 })));
		const res = await POST(
			makeRequest({
				topic: "Billing",
				email: "a@b.com",
				message: "I need a refund please",
			}),
		);
		expect(res.status).toBe(202);
		const body = (await res.json()) as { ok: boolean; ticket: string; inbox: string };
		expect(body.ok).toBe(true);
		expect(body.ticket).toMatch(/^sup_/);
		expect(body.inbox).toBe("support@nosytlabs.com");
	});
});
