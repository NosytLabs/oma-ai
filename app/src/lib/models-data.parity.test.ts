import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MODELS } from "./models-data";

/**
 * Cross-package catalog parity.
 *
 * `app/src/lib/models-data.ts` ships a static FALLBACK_CATALOG because SSR
 * metadata and generateStaticParams cannot await /v1/models. That fallback
 * duplicates the authoritative server catalog on purpose: the server holds
 * the RAW upstream rate plus a `markupPercent`, and the app holds the rate
 * AFTER markup, so a visitor's SSR price matches what they are billed.
 *
 * The existing guard in models-data.ts only checks that the fallback's length
 * equals MODEL_COUNT. It cannot catch the failure that actually matters:
 * someone edits a price or markupPercent on the server, the count still
 * matches 20, the build still passes, and the website goes on quoting a price
 * the server no longer charges.
 *
 * So assert the actual invariant, per model:
 *   app.inputPricePer1M === server.inputPricePer1M * (1 + markupPercent/100)
 *
 * A model present on only one side is a failure too: a fallback entry the
 * server cannot route 404s, and a server model with no fallback is invisible
 * to SSR metadata.
 *
 * The server side is read as source text rather than imported. Importing it
 * would pull `config.ts` and `lib/logger.ts` into the app's TypeScript
 * program, where the server's wider env union (it permits NODE_ENV=staging)
 * meets the app's narrower one and reports a false error in code this test
 * never runs. Reading the file keeps the test out of both compilers.
 */
const SERVER_MODELS = resolve(
	dirname(fileURLToPath(import.meta.url)),
	"../../../server/src/inference/models.ts",
);

type ServerEntry = {
	id: string;
	inputPricePer1M: number;
	outputPricePer1M: number;
	markupPercent: number;
};

function readServerCatalog(): ServerEntry[] {
	const source = readFileSync(SERVER_MODELS, "utf8");
	const entries: ServerEntry[] = [];

	// Each catalog entry is an object literal starting with `id: "..."`.
	// Splitting on that anchor stops a field bleeding across entries.
	const anchors = [...source.matchAll(/\bid:\s*"([a-z0-9.-]+)"/g)];
	expect(
		anchors.length,
		`found no catalog entries in ${SERVER_MODELS}. If the server catalog ` +
			"format changed, update readServerCatalog() rather than weakening " +
			"this assertion.",
	).toBeGreaterThan(0);

	for (let i = 0; i < anchors.length; i++) {
		const start = anchors[i].index ?? 0;
		const end = anchors[i + 1]?.index ?? source.length;
		const block = source.slice(start, end);

		const num = (key: string) => {
			const m = block.match(new RegExp(`${key}:\\s*([0-9][0-9_]*(?:\\.[0-9]+)?)`));
			return m ? Number(m[1].replace(/_/g, "")) : Number.NaN;
		};

		entries.push({
			id: anchors[i][1],
			inputPricePer1M: num("inputPricePer1M"),
			outputPricePer1M: num("outputPricePer1M"),
			markupPercent: num("markupPercent"),
		});
	}
	return entries;
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
					expectedInput: s.inputPricePer1M * factor,
					actualInput: a.inputPricePer1M,
					expectedOutput: s.outputPricePer1M * factor,
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
