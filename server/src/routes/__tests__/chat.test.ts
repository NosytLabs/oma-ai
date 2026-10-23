/**
 * Integration tests for POST /v1/chat/completions route handler.
 *
 * Covers the critical-path behaviours that were previously only exercised by
 * standalone browser scripts:
 *   - request body validation
 *   - model-not-found rejection
 *   - auth enforcement (non-free models require a userId)
 *   - free-website-model bypass (anonymous allowed when X-OMA-Source=website)
 * Retry admission is exercised against real Postgres in inference-idempotency-integration.test.ts.
 *   - ProviderError mapping to upstream status codes
 *   - unexpected error → 500
 *
 * The inference proxy, billing service, model catalog, auth middleware,
 * rate-limit, daily-limit, and db are mocked so the route handler logic is
 * tested in isolation.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// ─── Mocks ──────────────────────────────────────────────────────────────────

const mockModelDef = {
	id: "deepseek-v4-flash-0731-openbroker",
	provider: "oma-ai",
	name: "DeepSeek V4 Flash",
	inputPricePer1M: 0,
	outputPricePer1M: 0,
	modalities: ["text"],
} as const;

const mockPaidModelDef = {
	id: "llama-3.3-70b",
	provider: "venice",
	name: "Llama 3.3 70B",
	inputPricePer1M: 0.6,
	outputPricePer1M: 0.6,
	modalities: ["text"],
} as const;

vi.mock("../../inference/models.js", () => ({
	getModelById: vi.fn((id: string) => {
		if (id === "deepseek-v4-flash-0731-openbroker") return mockModelDef;
		if (id === "llama-3.3-70b") return mockPaidModelDef;
		return undefined;
	}),
}));

const mockPricing = { inputPricePer1M: 0, outputPricePer1M: 0 };
vi.mock("../../inference/billing-service.ts", () => ({
	getModelPricing: vi.fn(() => mockPricing),
}));

// Stub rate-limit and daily-limit so they never block.
vi.mock("../../middleware/rate-limit.js", () => ({
	rateLimit: () => async (_c: unknown, next: () => Promise<void>) => next(),
	// Per-model RPM/TPM limiter. Stubbed to a pass-through so these tests
	// exercise route + billing logic, not the limiter (covered in
	// src/middleware/__tests__/rate-limit.test.ts).
	modelRateLimit: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock("../../middleware/daily-limit.js", () => ({
	dailyUsageLimit: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));
vi.mock("../../middleware/inference-idempotency.js", () => ({ inferenceIdempotency: () => async (_c: unknown, next: () => Promise<void>) => next() }));
vi.mock("../../inference/credit-reservations.js", () => ({ reservationQuote: () => ({ cents: 1, maxTokens: 32 }), reserveInferenceCredits: vi.fn(), failInferenceReservation: vi.fn(async () => {}) }));

// Auth middleware: optionalAuth sets userId when a Bearer header is present.
vi.mock("../../auth/middleware.js", () => ({
	optionalAuth: async (c: { req: { header: (n: string) => string | undefined }; set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
		if (c.req.header("Cookie") === "local-fixture=session") c.set("userId", "user_123");
		const auth = c.req.header("Authorization");
		if (auth && auth.startsWith("Bearer ")) {
			c.set("userId", "user_123");
			c.set("apiKey", { id: "key_1", userId: "user_123" });
		}
		await next();
	},
}));

// Logger mock so error paths don't spam the test output.
vi.mock("../../lib/logger.js", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), fatal: vi.fn() },
}));

// Inference proxy mock — routeRequestWithFallback returns a fake upstream.
const mockRouteRequest = vi.hoisted(() => vi.fn());
const mockCreateStreamingProxy = vi.hoisted(() => vi.fn(() => new ReadableStream()));
const mockParseNonStreaming = vi.hoisted(() => vi.fn());
vi.mock("../../inference/proxy.js", () => ({
	ProviderError: class ProviderError extends Error {
		status: number;
		constructor(message: string, status: number) {
			super(message);
			this.status = status;
		}
	},
	estimateTokens: vi.fn(() => 10),
	flattenMessageContent: vi.fn((c: unknown) => String(c)),
	assertSufficientBalance: vi.fn(),
	routeRequestWithFallback: mockRouteRequest,
	createStreamingProxy: mockCreateStreamingProxy,
	parseNonStreamingResponse: mockParseNonStreaming,
}));

import { chatRoutes } from "../chat/index.js";

// ─── Helpers ────────────────────────────────────────────────────────────────

function chatRequest(body: unknown, headers: Record<string, string> = {}, path = "/v1/chat/completions") {
	const app = new Hono();
	app.route("/", chatRoutes);
	return app.request(
		new Request(`http://localhost${path}`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(body ? { "Content-Length": String(JSON.stringify(body).length) } : {}),
				...headers,
			},
			body: body ? JSON.stringify(body) : "",
		}),
	);
}

const baseBody = {
	model: "deepseek-v4-flash-0731-openbroker",
	messages: [{ role: "user", content: "Hello" }],
};

beforeEach(() => {
	vi.clearAllMocks();
	mockRouteRequest.mockReset();
	mockParseNonStreaming.mockReset();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("POST /v1/chat/completions", () => {
	it.each([false, true])("exposes the usage request ID for stream=%s without trusting a client ID", async (stream) => {
		mockRouteRequest.mockResolvedValueOnce({ response: new Response("{}"), actualModelId: baseBody.model });
		mockParseNonStreaming.mockResolvedValueOnce({ data: { id: "provider-owned-id" } });
		const res = await chatRequest({ ...baseBody, stream }, { Authorization: "Bearer test-key", "X-OMA-Request-ID": "forged-id" });
		expect(res.status).toBe(200);
		const requestId = res.headers.get("X-OMA-Request-ID");
		expect(requestId).toMatch(/^chatcmpl-/);
		const usageHandler = stream ? mockCreateStreamingProxy : mockParseNonStreaming;
		expect(usageHandler).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ requestId }));
		await res.body?.cancel();
	});

	it("asks old signed-in free-chat clients to reload rather than charging them as API requests", async () => {
		mockRouteRequest.mockResolvedValueOnce({ response: new Response("{}"), actualModelId: baseBody.model });
		mockParseNonStreaming.mockResolvedValueOnce({ data: { ok: true } });
		// The updated public proxy has already stripped the old source header.
		const res = await chatRequest(baseBody, { Cookie: "local-fixture=session", Origin: "http://localhost:3000" });
		expect(res.status).toBe(409);
		expect((await res.json()).error.code).toBe("website_chat_moved");
		expect(mockRouteRequest).not.toHaveBeenCalled();
		expect(mockParseNonStreaming).not.toHaveBeenCalled();
	});
	it("forwards assistant tool calls and tool results for a coding follow-up", async () => {
		const messages = [
			{ role: "user", content: "Read the file." },
			{ role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: { name: "read_file", arguments: '{"path":"README.md"}' } }] },
			{ role: "tool", content: "The file contents.", tool_call_id: "call_1" },
		];
		mockRouteRequest.mockResolvedValueOnce({ response: new Response("{}"), actualModelId: baseBody.model });
		mockParseNonStreaming.mockResolvedValueOnce({ data: { ok: true } });
		const res = await chatRequest({ ...baseBody, messages }, { Authorization: "Bearer test-key" });
		expect(res.status).toBe(200);
		expect(mockRouteRequest).toHaveBeenCalledWith(expect.objectContaining({ messages }));
	});
	describe("request validation", () => {
		it("rejects invalid JSON body with 400", async () => {
			const res = await chatRequest("not json", {});
			// Hono's c.req.json().catch(() => null) returns null → safeParse fails
			expect(res.status).toBe(400);
		});

		it("rejects missing model with 400", async () => {
			const res = await chatRequest({ messages: [{ role: "user", content: "hi" }] });
			expect(res.status).toBe(400);
		});

		it("rejects missing messages with 400", async () => {
			const res = await chatRequest({ model: "deepseek-v4-flash-0731-openbroker" });
			expect(res.status).toBe(400);
		});

		it("rejects empty messages array with 400", async () => {
			const res = await chatRequest({ model: "deepseek-v4-flash-0731-openbroker", messages: [] });
			expect(res.status).toBe(400);
		});
	});

	describe("model resolution", () => {
		it("returns 404 for an unknown model", async () => {
			const res = await chatRequest(
				{ ...baseBody, model: "nonexistent-model" },
				{ Authorization: "Bearer test-key" },
			);
			expect(res.status).toBe(404);
			const data = await res.json();
			expect(data.error.message).toContain("not found");
		});
	});

	describe("authentication enforcement", () => {
		it("does not sponsor public API calls with copied website headers", async () => {
			mockRouteRequest.mockResolvedValueOnce({ response: Response.json({}), actualModelId: baseBody.model });
			mockParseNonStreaming.mockResolvedValueOnce({ data: { ok: true } });
			const response = await chatRequest(baseBody, {
				"X-OMA-Source": "website", Origin: "http://localhost:3000",
			});
			expect(response.status).toBe(401);
			expect(mockRouteRequest).not.toHaveBeenCalled();
		});
		it("requires auth for paid models (no userId → 401)", async () => {
			const res = await chatRequest(
				{ ...baseBody, model: "llama-3.3-70b" },
				{ "X-OMA-Source": "website", Origin: "http://localhost:3000" },
			);
			expect(res.status).toBe(401);
			const data = await res.json();
			expect(data.error.code).toBe("auth_required");
		});

		it("allows free models on the separate local website route", async () => {
			mockRouteRequest.mockResolvedValueOnce({
				response: new Response("{}", { status: 200 }),
				actualModelId: "deepseek-v4-flash-0731-openbroker",
			});
			mockParseNonStreaming.mockResolvedValueOnce({ data: { ok: true } });

			const res = await chatRequest(baseBody, {
				"X-OMA-Source": "website",
				Origin: "http://localhost:3000",
			}, "/website/chat/completions");
			expect(res.status).toBe(200);
		});

		it("rejects free model without website source header (requires auth)", async () => {
			const res = await chatRequest(baseBody);
			expect(res.status).toBe(401);
		});

		it("rejects free model with website source but bad origin", async () => {
			const res = await chatRequest(baseBody, {
				"X-OMA-Source": "website",
				Origin: "https://evil.example.com",
			}, "/website/chat/completions");
			expect(res.status).toBe(403);
		});

		it("bills API-key callers for free models even with website headers", async () => {
			mockRouteRequest.mockResolvedValueOnce({
				response: new Response("{}", { status: 200 }),
				actualModelId: "deepseek-v4-flash-0731-openbroker",
			});
			mockParseNonStreaming.mockResolvedValueOnce({ data: { ok: true } });

			const res = await chatRequest(baseBody, {
				Authorization: "Bearer oma_sk_test",
				"X-OMA-Source": "website",
				Origin: "http://localhost:3000",
			});
			expect(res.status).toBe(200);
			expect(mockRouteRequest).toHaveBeenCalledWith(
				expect.objectContaining({ skipBilling: false }),
			);
			expect(mockParseNonStreaming).toHaveBeenCalledWith(
				expect.anything(),
				expect.objectContaining({ skipBilling: false }),
			);
		});
	});

	describe("upstream error mapping", () => {
		it("maps a ProviderError to the upstream status code", async () => {
			const { ProviderError } = await import("../../inference/proxy.js");
			mockRouteRequest.mockRejectedValueOnce(
				new ProviderError("upstream rate limited", 429),
			);

			const res = await chatRequest(baseBody, {
				Authorization: "Bearer test-key",
			});
			expect(res.status).toBe(429);
			const data = await res.json();
			expect(data.error.type).toBe("upstream_error");
		});

		it("maps a 5xx ProviderError to server_error type", async () => {
			const { ProviderError } = await import("../../inference/proxy.js");
			mockRouteRequest.mockRejectedValueOnce(
				new ProviderError("upstream down", 503),
			);

			const res = await chatRequest(baseBody, {
				Authorization: "Bearer test-key",
			});
			expect(res.status).toBe(503);
			const data = await res.json();
			expect(data.error.type).toBe("server_error");
		});

		it("returns 500 on unexpected (non-ProviderError) errors", async () => {
			mockRouteRequest.mockRejectedValueOnce(new Error("something broke"));

			const res = await chatRequest(baseBody, {
				Authorization: "Bearer test-key",
			});
			expect(res.status).toBe(500);
			const data = await res.json();
			expect(data.error.type).toBe("server_error");
		});
	});

	describe("response headers (fallback transparency)", () => {
		it("sets x-provider and x-actual-model on success", async () => {
			mockRouteRequest.mockResolvedValueOnce({
				response: new Response("{}", { status: 200 }),
				actualModelId: "deepseek-v4-flash-0731-openbroker",
			});
			mockParseNonStreaming.mockResolvedValueOnce({ data: { ok: true } });

			const res = await chatRequest(baseBody, {
				"X-OMA-Source": "website",
				Origin: "http://localhost:3000",
			}, "/website/chat/completions");
			expect(res.status).toBe(200);
			expect(res.headers.get("x-provider")).toBe("oma-ai");
			expect(res.headers.get("x-actual-model")).toBe("deepseek-v4-flash-0731-openbroker");
		});

		it("sets x-oma-fallback when actual model differs from requested", async () => {
			mockRouteRequest.mockResolvedValueOnce({
				response: new Response("{}", { status: 200 }),
				actualModelId: "mistral-small-2603", // fallback target
			});
			mockParseNonStreaming.mockResolvedValueOnce({ data: { ok: true } });

			const res = await chatRequest(baseBody, {
				"X-OMA-Source": "website",
				Origin: "http://localhost:3000",
			}, "/website/chat/completions");
			expect(res.headers.get("x-oma-fallback")).toBe("1");
			expect(res.headers.get("x-oma-requested-model")).toBe("deepseek-v4-flash-0731-openbroker");
		});
	});
});
