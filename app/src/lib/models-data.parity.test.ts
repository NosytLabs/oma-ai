import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MODELS } from "./models-data";

/** SSR prices must match the shared catalog, including fixed retail rates. */
const SERVER_MODELS = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../../server/src/inference/model-catalog.json",
);

type ServerEntry = {
	id: string;
	inputPricePer1M: number;
	outputPricePer1M: number;
	markupPercent: number;
	customerInputPricePer1M?: number;
	customerOutputPricePer1M?: number;
};

function readServerCatalog(): ServerEntry[] {
	return JSON.parse(readFileSync(SERVER_MODELS, "utf8")) as ServerEntry[];
}

const server = readServerCatalog();

describe("app fallback catalog matches the server catalog", () => {
	it("parses the expected number of server entries", () => {
		// Guards the parser itself. Without this, a regex that silently matched
		// nothing would let every assertion below pass vacuously.
		expect(server.length).toBe(MODELS.length);
		expect(server.every((e) => Number.isFinite(e.markupPercent))).toBe(true);
	});

	it("has the same set of model ids on both sides", () => {
		const appIds = MODELS.map((m) => m.id).sort();
		const serverIds = server.map((s) => s.id).sort();

		const onlyApp = appIds.filter((id) => !serverIds.includes(id));
		const onlyServer = serverIds.filter((id) => !appIds.includes(id));

		expect(
			{ onlyApp, onlyServer },
			"the app fallback and the server catalog must list identical ids. " +
				"An id on only one side either 404s at runtime (app-only) or is " +
				"invisible to SSR metadata (server-only).",
		).toEqual({ onlyApp: [], onlyServer: [] });
	});

	it("applies each model's markup exactly once", () => {
		const appById = new Map(MODELS.map((m) => [m.id, m]));

		const drift = server
			.map((s) => {
				const a = appById.get(s.id);
				if (!a) return null; // id drift is asserted separately
				const factor = 1 + s.markupPercent / 100;
				return {
					id: s.id,
					markupPercent: s.markupPercent,
					expectedInput: s.customerInputPricePer1M ?? s.inputPricePer1M * factor,
					actualInput: a.inputPricePer1M,
					expectedOutput: s.customerOutputPricePer1M ?? s.outputPricePer1M * factor,
					actualOutput: a.outputPricePer1M,
				};
			})
			.filter((r): r is NonNullable<typeof r> => r !== null)
			.filter(
				(r) =>
					Math.abs(r.expectedInput - r.actualInput) > 1e-9 ||
					Math.abs(r.expectedOutput - r.actualOutput) > 1e-9,
			);

		expect(
			drift,
			"the app fallback stores the marked-up price, so it must equal the " +
				"server rate * (1 + markupPercent/100). Drift here means the site " +
				"quotes a price the server no longer charges.",
		).toEqual([]);
	});

	it("never prices a model below its raw server rate", () => {
		// Guards the opposite failure: a fallback that dropped below the raw
		// rate would under-quote and lose money on every request.
		const appById = new Map(MODELS.map((m) => [m.id, m]));
		const tooCheap = server
			.map((s) => {
				const a = appById.get(s.id);
				return a && a.inputPricePer1M < s.inputPricePer1M
					? { id: s.id, app: a.inputPricePer1M, serverRaw: s.inputPricePer1M }
					: null;
			})
			.filter((r): r is NonNullable<typeof r> => r !== null);

		expect(tooCheap).toEqual([]);
	});
});
