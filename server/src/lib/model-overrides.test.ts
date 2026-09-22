import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, sep as pathSep } from "node:path";
import { describe, expect, it } from "vitest";
import { readModelPricingOverrides, resolveModelOverridesFilePath } from "./model-overrides.js";

describe("resolveModelOverridesFilePath", () => {
		it("resolves the repository sidecar next to server/models.json", () => {
				const resolved = resolveModelOverridesFilePath(process.cwd()).split(pathSep).join("/");
				expect(resolved).toMatch(/server\/models-overrides\.json$/);
				expect(resolved).not.toMatch(/server\/models\.json$/);
		});

		it("reads only valid persisted override entries", () => {
				const root = mkdtempSync(join(tmpdir(), "oma-model-overrides-"));
				const file = join(root, "models-overrides.json");
				writeFileSync(file, JSON.stringify({
						schemaVersion: 1,
						updatedAt: new Date().toISOString(),
						overrides: {
								good: { inputPricePer1M: 1, outputPricePer1M: 2, updatedAt: new Date().toISOString() },
								bad: { inputPricePer1M: -1, outputPricePer1M: 2, updatedAt: "now" },
						},
				}));

				expect(readModelPricingOverrides(file)).toHaveProperty("good");
				expect(readModelPricingOverrides(file)).not.toHaveProperty("bad");
		});

		it("uses the custom catalog directory without overwriting the catalog", () => {
				const root = mkdtempSync(join(tmpdir(), "oma-model-overrides-"));
				const catalogDir = join(root, "catalog");
				mkdirSync(catalogDir);
				writeFileSync(join(root, "package.json"), JSON.stringify({ name: "not-oma" }));

				expect(resolveModelOverridesFilePath(root, join(catalogDir, "models.json"))).toBe(
						join(catalogDir, "models-overrides.json"),
				);
		});
});
