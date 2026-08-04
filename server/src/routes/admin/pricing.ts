/**
 * Admin model pricing — in-memory overrides + durable sidecar.
 */
import { z } from "zod";
import type { Hono } from "hono";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import {
	readModelPricingOverrides,
	resolveModelOverridesFilePath,
	type ModelPricingOverride,
	type PersistedOverridesFile,
} from "../../lib/model-overrides.js";
import type { OmaEnv } from "../../types.js";
import { listAllModels, getModelById } from "../../inference/models.js";
import { logger } from "../../lib/logger.js";
import { auditLog } from "../../middleware/audit.js";

const pricingOverrides = new Map<
	string,
	{ inputPricePer1M: number; outputPricePer1M: number; updatedAt: string }
>();

const MODELS_OVERRIDES_FILE = resolveModelOverridesFilePath();
let persistQueue: Promise<void> = Promise.resolve();

async function loadPersistedOverrides(): Promise<void> {
	const overrides = readModelPricingOverrides(MODELS_OVERRIDES_FILE);
	for (const [modelId, override] of Object.entries(overrides)) {
		pricingOverrides.set(modelId, override);
	}
	if (Object.keys(overrides).length > 0) {
		logger.info(
			{ count: pricingOverrides.size, file: MODELS_OVERRIDES_FILE },
			"[admin] loaded pricing overrides from disk",
		);
	} else {
		logger.info(
			{ file: MODELS_OVERRIDES_FILE },
			"[admin] no valid pricing overrides on disk; using in-memory defaults",
		);
	}
}

const pricingOverridesReady = loadPersistedOverrides();

async function persistOverride(
	modelId: string,
	override: ModelPricingOverride,
): Promise<boolean> {
	const overridesFile = MODELS_OVERRIDES_FILE;
	let persisted = true;
	persistQueue = persistQueue
		.then(async () => {
			const next: PersistedOverridesFile = {
				schemaVersion: 1,
				updatedAt: new Date().toISOString(),
				overrides: { ...Object.fromEntries(pricingOverrides), [modelId]: override },
			};
			try {
				const raw = await fs.readFile(overridesFile, "utf8");
				const existing = JSON.parse(raw) as PersistedOverridesFile;
				if (existing?.schemaVersion === 1) {
					next.overrides = { ...existing.overrides, [modelId]: override };
				}
			} catch (err: unknown) {
				const e = err as NodeJS.ErrnoException;
				if (e.code !== "ENOENT") {
					logger.warn(
						{ err, file: overridesFile },
						"[admin] overrides file unreadable; rewriting",
					);
				}
			}
			next.schemaVersion = 1;
			next.updatedAt = new Date().toISOString();
			await fs.mkdir(path.dirname(overridesFile), { recursive: true });
			const tmp = `${overridesFile}.${process.pid}.${Date.now()}.tmp`;
			await fs.writeFile(tmp, JSON.stringify(next, null, 2), "utf8");
			await fs.rename(tmp, overridesFile);
			logger.info(
				{ modelId, file: overridesFile },
				"[admin] persisted pricing override to disk",
			);
		})
		.catch((err) => {
			persisted = false;
			logger.error({ err, modelId }, "[admin] failed to persist pricing override");
		});
	await persistQueue;
	return persisted;
}

export function getModelPricingOverride(modelId: string) {
	return pricingOverrides.get(modelId);
}

const patchSchema = z.object({
	inputPricePer1M: z.number().min(0).max(1000).optional(),
	outputPricePer1M: z.number().min(0).max(1000).optional(),
});

export function registerPricingRoutes(app: Hono<OmaEnv>): void {
	app.get("/v1/admin/models", async (c) => {
		await pricingOverridesReady;
		const models = listAllModels().map((m) => {
			const override = pricingOverrides.get(m.id);
			return {
				id: m.id,
				displayName: m.displayName,
				provider: m.provider,
				gonkaId: m.gonkaId ?? null,
				category: m.category,
				inputPricePer1M: override?.inputPricePer1M ?? m.inputPricePer1M,
				outputPricePer1M: override?.outputPricePer1M ?? m.outputPricePer1M,
				markupPercent: m.markupPercent,
				contextWindow: m.contextWindow ?? null,
				maxTokens: m.maxTokens,
				supportsStreaming: m.supportsStreaming,
				supportsTools: m.capabilities?.includes("tools") ?? false,
				override: override
					? {
							inputPricePer1M: override.inputPricePer1M,
							outputPricePer1M: override.outputPricePer1M,
							updatedAt: override.updatedAt,
						}
					: null,
			};
		});
		return c.json({ object: "list", data: models, count: models.length });
	});

	app.patch("/v1/admin/models/:id", async (c) => {
		await pricingOverridesReady;
		const id = c.req.param("id");
		const body = await c.req.json().catch(() => null);
		const parsed = patchSchema.safeParse(body);
		if (!parsed.success) {
			return c.json(
				{ error: { message: "Invalid pricing update", issues: parsed.error.flatten() } },
				400,
			);
		}
		const modelDef = getModelById(id);
		if (!modelDef) {
			return c.json({ error: { message: `Model ${id} not found` } }, 404);
		}

		const prev = pricingOverrides.get(id);
		const next = {
			inputPricePer1M:
				parsed.data.inputPricePer1M ?? prev?.inputPricePer1M ?? modelDef.inputPricePer1M,
			outputPricePer1M:
				parsed.data.outputPricePer1M ?? prev?.outputPricePer1M ?? modelDef.outputPricePer1M,
			updatedAt: new Date().toISOString(),
		};
		pricingOverrides.set(id, next);

		const persisted = await persistOverride(id, next);
		if (!persisted) {
			if (prev) pricingOverrides.set(id, prev);
			else pricingOverrides.delete(id);
			return c.json({ error: { message: "Pricing update could not be persisted" } }, 503);
		}

		await auditLog({
			userId: c.get("userId"),
			action: "USER_UPDATED",
			resource: "model_pricing",
			resourceId: id,
			metadata: {
				inputPricePer1M: next.inputPricePer1M,
				outputPricePer1M: next.outputPricePer1M,
				previous: {
					inputPricePer1M: modelDef.inputPricePer1M,
					outputPricePer1M: modelDef.outputPricePer1M,
				},
			},
		});

		return c.json({
			id,
			inputPricePer1M: next.inputPricePer1M,
			outputPricePer1M: next.outputPricePer1M,
			updatedAt: next.updatedAt,
		});
	});
}
