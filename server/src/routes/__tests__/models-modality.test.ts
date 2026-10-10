import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { OmaEnv } from "../../types";

vi.mock("../../config.js", () => ({
		config: { VENICE_API_KEY: "dev-venice-key-123456", OPENBROKER_API_KEY: "dev-ob-key-123456" }
}));

vi.mock("../../lib/logger.js", () => ({
		logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

// Mock the models file completely to avoid initialization issues.
// Prices resolve through billing-service.userFacingFor (the same lookup
// billing deducts with), so that is the mock that matters here.
vi.mock("../../inference/models.js", () => ({
		ensureCatalogLoaded: vi.fn().mockResolvedValue(undefined),
		listAllModels: vi.fn().mockReturnValue([
				{
						id: "claude-opus-5",
						provider: "venice",
						displayName: "Claude Opus 5",
						category: "frontier",
						contextWindow: 1000000,
						maxOutputTokens: 16384,
						extendedPricing: { contextTokenThreshold: 200000, inputPricePer1M: 10, outputPricePer1M: 30 },
						supportsStreaming: true,
						capabilities: ["chat", "reasoning", "coding", "tools"]
				},
				{
						id: "chat-only",
						provider: "venice",
						displayName: "Chat Only",
						category: "budget",
						contextWindow: 128000,
						supportsStreaming: true,
						capabilities: ["chat"]
				}
		]),
		providerAvailable: vi.fn().mockReturnValue(true)
}));

vi.mock("../../inference/billing-service.js", () => ({
		userFacingFor: vi.fn().mockReturnValue({ inputPer1M: 7.5, outputPer1M: 37.5 }),
}));

import { modelRoutes } from "../models";

function makeApp() {
		const app = new Hono<OmaEnv>();
		app.route("/", modelRoutes);
		return app;
}

describe("/v1/models — modality field (R6)", () => {
		let app: Hono<OmaEnv>;
		beforeEach(() => {
				app = makeApp();
		});
		afterEach(() => {
				vi.restoreAllMocks();
		});

		it("returns modality field on every model", async () => {
				const res = await app.request("/v1/models");
				expect(res.status).toBe(200);
				const body = await res.json();
				expect(body.object).toBe("list");
				expect(Array.isArray(body.data)).toBe(true);
				for (const m of body.data) {
						expect(m.modality).toMatch(/^(chat|image|video)$/);
				}
		});

		it("includes chat models with modality=chat (R5 baseline preserved)", async () => {
				const res = await app.request("/v1/models");
				const body = await res.json();
				const chatModels = body.data.filter((m: { modality: string }) => m.modality === "chat");
				expect(chatModels.length).toBeGreaterThanOrEqual(1);
				expect(chatModels[0]).toBeDefined();
				expect(chatModels[0].modality).toBe("chat");
		});

		it("catalog carries no image/video models after R7 removal", async () => {
				const res = await app.request("/v1/models");
				const body = await res.json();
				const removed = body.data.filter((m: { modality: string }) =>
						m.modality === "image" || m.modality === "video",
				);
				expect(removed).toEqual([]);
		});

		it("single-model lookup includes modality (GET /v1/models/:id)", async () => {
				const res = await app.request("/v1/models");
				const body = await res.json();
				const firstModel = body.data[0];
				
				const lookupRes = await app.request(`/v1/models/${firstModel.id}`);
				expect(lookupRes.status).toBe(200);
				const lookupBody = await lookupRes.json();
				expect(lookupBody.id).toBe(firstModel.id);
				expect(lookupBody.modality).toBe("chat");
		});

		it("single-model lookup returns 404 for unknown id (regression)", async () => {
				const res = await app.request("/v1/models/does-not-exist");
				expect(res.status).toBe(404);
				const body = await res.json();
				expect(body.error?.type).toBe("not_found");
		});

		it("exposes the canonical capabilities consistently in list and detail responses", async () => {
				const body = await (await app.request("/v1/models")).json();
				const expected = [
						{ id: "claude-opus-5", capabilities: ["chat", "reasoning", "coding", "tools"], supports_tools: true },
						{ id: "chat-only", capabilities: ["chat"], supports_tools: false },
				];
				for (const model of expected) {
						const listed = body.data.find((entry: { id: string }) => entry.id === model.id);
						expect(listed).toMatchObject(model);
						const detail = await (await app.request(`/v1/models/${model.id}`)).json();
						expect(detail).toMatchObject(model);
						expect(detail.pricing).toMatchObject({ prompt: 7.5, completion: 37.5 });
						expect(listed.pricing).toEqual(detail.pricing);
				}
		});

		it("publishes output limits and long-context pricing in list and detail", async () => {
			const body = await (await app.request("/v1/models")).json();
			const listed = body.data.find((m: { id: string }) => m.id === "claude-opus-5");
			const detail = await (await app.request("/v1/models/claude-opus-5")).json();
			for (const model of [listed, detail]) {
				expect(model.max_output_tokens).toBe(16384);
				expect(model.pricing.extended).toEqual({ context_token_threshold: 200000, prompt: 7.5, completion: 37.5 });
			}
		});
});
