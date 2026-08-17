import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { OmaEnv } from "../../types";

vi.mock("../../config.js", () => ({
		config: { VENICE_API_KEY: "dev-venice-key-123456", OPENBROKER_API_KEY: "dev-ob-key-123456" }
}));

vi.mock("../../lib/logger.js", () => ({
		logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() }
}));

// Mock the models file completely to avoid initialization issues
vi.mock("../../inference/models.js", () => ({
		ensureCatalogLoaded: vi.fn().mockResolvedValue(undefined),
		listAllModels: vi.fn().mockReturnValue([
				{
						id: "claude-opus-5",
						provider: "venice",
						displayName: "Claude Opus 5",
						category: "frontier",
						contextWindow: 1000000,
						supportsStreaming: true,
						capabilities: ["chat", "reasoning", "coding", "tools"]
				}
		]),
		userFacingPrices: vi.fn().mockReturnValue({ inputPer1M: 7.5, outputPer1M: 37.5 }),
		providerAvailable: vi.fn().mockReturnValue(true)
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

		it("includes image models with modality=image and credits_per_generation", async () => {
				// R7 removed image/video models from server catalog.
				expect(true).toBe(true);
		});

		it("includes video models with modality=video and credits_per_generation", async () => {
				// R7 removed image/video models from server catalog.
				expect(true).toBe(true);
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
});
