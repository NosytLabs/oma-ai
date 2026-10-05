/**
 * Usage metering invariants that protect the ledger and the operator's view
 * of it. These are regression guards for defects that were live:
 *
 *  1. `latency_ms` existed on usage_records from the initial migration and
 *     was never written by any code path, so every latency query returned
 *     NULL and "which provider is slow" was unanswerable.
 *
 *  2. recordUsage() deducted credits BEFORE inserting the usage row. A
 *     double-record path (createStreamingProxy has three recordUsage call
 *     sites reachable in one request lifetime: done / read-error /
 *     client-abort) therefore charged twice: the unique-violation on
 *     request_id fired only AFTER the deduction had run, the insert rolled
 *     back, and the outer catch swallowed it. The user was billed twice and
 *     the ledger kept one row. The insert must now CLAIM the request_id
 *     first and only deduct if it won.
 *
 *  3. `model` records the model that actually served the request after
 *     failover, so without requested_model / routed_via / attempt_count the
 *     admin cannot compute a failover rate.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const insertedValues: Array<Record<string, unknown>> = [];
const auditActions: string[] = [];
/** Set to make the ON CONFLICT claim lose, simulating a duplicate requestId. */
let conflictOnRequestId = false;
let deductionCalls = 0;

function makeTx() {
	return {
		insert: () => ({
			values: (v: Record<string, unknown>) => {
				insertedValues.push(v);
				const builder = {
					onConflictDoNothing: () => builder,
					returning: async () =>
						conflictOnRequestId ? [] : [{ requestId: v.requestId }],
				};
				return builder;
			},
		}),
		update: () => ({
			set: () => ({
				where: () => ({
					// Report a successful deduction unless told otherwise.
					returning: async () => {
						deductionCalls++;
						return [{ userId: "u1" }];
					},
				}),
			}),
		}),
	};
}

vi.mock("../../db/client.js", () => ({
	db: {
		transaction: async (fn: (tx: unknown) => Promise<void>) => fn(makeTx()),
		select: () => ({ from: () => ({ where: () => ({ limit: async () => [] }) }) }),
	},
}));

vi.mock("../logger.js", () => ({
	logger: {
		error: vi.fn(),
		warn: vi.fn(),
		info: vi.fn(),
		debug: vi.fn(),
		fatal: vi.fn(),
	},
}));

vi.mock("../../middleware/audit.js", () => ({
	auditLog: async (args: { action: string }) => {
		auditActions.push(args.action);
	},
}));

vi.mock("./billing-service.js", () => ({
	getModelPricing: () => ({ inputPer1M: 1, outputPer1M: 2, markup: 10 }),
}));

import { recordUsage } from "../billing.js";

const baseArgs = {
	userId: "u1",
	model: "llama-3.3-70b",
	requestedModel: "kimi-k3",
	provider: "venice" as const,
	routedVia: "fallback",
	attemptCount: 2,
	promptTokens: 1000,
	outputTokens: 500,
	pricing: { inputPer1M: 1, outputPer1M: 2, markup: 10 },
	requestId: "chatcmpl-test-1",
	status: "completed" as const,
};

describe("recordUsage metering", () => {
	beforeEach(() => {
		insertedValues.length = 0;
		auditActions.length = 0;
		deductionCalls = 0;
		conflictOnRequestId = false;
	});

	it("persists latency_ms from startedAt", async () => {
		await recordUsage({ ...baseArgs, startedAt: Date.now() - 1_500 });

		expect(insertedValues).toHaveLength(1);
		const latency = insertedValues[0].latencyMs;
		// Measured from the caller's start timestamp, not a constant.
		expect(typeof latency).toBe("number");
		expect(latency as number).toBeGreaterThanOrEqual(1_400);
		expect(latency as number).toBeLessThan(10_000);
	});

	it("persists null latency when no start timestamp is supplied", async () => {
		await recordUsage({ ...baseArgs });

		expect(insertedValues[0].latencyMs).toBeNull();
	});

	it("records the requested model, routing label and attempt count", async () => {
		await recordUsage({ ...baseArgs });

		expect(insertedValues[0]).toMatchObject({
			// What the client asked for (failover input) …
			requestedModel: "kimi-k3",
			// … and what actually served it.
			model: "llama-3.3-70b",
			routedVia: "fallback",
			attemptCount: 2,
		});
	});

	it("deducts credits exactly once for a normal request", async () => {
		await recordUsage({ ...baseArgs });

		expect(deductionCalls).toBe(1);
		expect(auditActions).toEqual(["CREDIT_DEDUCTED"]);
	});

	it("does NOT double-charge when the requestId is already recorded", async () => {
		// The unique-violation branch: the insert claims 0 rows.
		conflictOnRequestId = true;

		await recordUsage({ ...baseArgs });

		// The critical assertion — the balance is NOT touched.
		expect(deductionCalls).toBe(0);
		// And the audit trail must not claim a charge that never happened.
		expect(auditActions).toEqual(["USAGE_RECORD_DUPLICATE"]);
		expect(auditActions).not.toContain("CREDIT_DEDUCTED");
	});

	it("is safe against a genuine double-record race", async () => {
		// Two recordUsage calls for the same requestId — the shape produced by
		// the stream done/read-error/client-abort paths.
		conflictOnRequestId = false;
		await recordUsage({ ...baseArgs });
		expect(deductionCalls).toBe(1);

		// The second call loses the claim.
		conflictOnRequestId = true;
		await recordUsage({ ...baseArgs });
		expect(deductionCalls).toBe(1);
	});

	it("skips anonymous users entirely", async () => {
		await recordUsage({ ...baseArgs, userId: "anonymous" });

		expect(insertedValues).toHaveLength(0);
		expect(deductionCalls).toBe(0);
	});
});