/**
	* Tests for /v1/admin/* routes (site-settings, credit-adjust,
	* user-suspend, rate-limit-override, list-users). Covers the audit
	* middleware factory wiring on /v1/admin/site-settings and the
	* imperative audit-log path on the dynamic-action routes.
	*/
import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const mockDb = vi.hoisted(() => {
		const limitMock = vi.fn().mockReturnThis();
		const whereMock = vi.fn().mockReturnThis();
		const setMock = vi.fn().mockReturnValue({ where: whereMock });
		const updateMock = vi.fn().mockReturnValue({ set: setMock });
		const deleteWhereMock = vi.fn().mockReturnThis();
		const deleteMock = vi.fn().mockReturnValue({ where: deleteWhereMock });
		const onConflictDoUpdateMock = vi.fn().mockReturnThis();
		const valuesMock = vi.fn().mockReturnValue({ onConflictDoUpdate: onConflictDoUpdateMock });
		const insertMock = vi.fn().mockReturnValue({ values: valuesMock });
		const selectMock = vi.fn().mockReturnThis();
		const fromMock = vi.fn().mockReturnThis();
		// For the list-users test we need db.execute(). The hand-rolled SQL
		// returns an array of rows directly.
		const executeMock = vi.fn().mockResolvedValue([]);
		const transactionMock = vi.fn(async (fn: (tx: typeof mockDb) => Promise<void>) =>
				fn(mockDb),
		);

		return {
				insert: insertMock,
				values: valuesMock,
				onConflictDoUpdate: onConflictDoUpdateMock,
				update: updateMock,
				set: setMock,
				where: whereMock,
				delete: deleteMock,
				select: selectMock,
				from: fromMock,
				limit: limitMock,
				execute: executeMock,
				transaction: transactionMock,
		};
});

const mockAuditLog = vi.hoisted(() => vi.fn());
const mockLogger = vi.hoisted(() => ({
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
		fatal: vi.fn(),
}));

// Stub the rate-limit middleware so admin routes don't need Redis.
vi.mock("../../middleware/rate-limit.js", () => ({
		rateLimit: () => async (_c: unknown, next: () => Promise<void>) => next(),
		tokenBucket: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock("../../db/client.js", () => ({ db: mockDb }));

vi.mock("../../middleware/audit.js", () => ({
		auditLog: mockAuditLog,
		createAuditLogger: ({ action, resource }: { action: string; resource: string }) =>
				async (c: { get: (k: string) => unknown; req: { header: (n: string) => string | null } }, next: () => Promise<void>) => {
						await next();
						await mockAuditLog({
								userId: c.get("userId"),
								action,
								resource,
								metadata: c.get("auditMetadata"),
								ipAddress: c.req.header("x-real-ip") ?? "unknown",
						});
				},
		auditWriteOp: () =>
				async (_c: unknown, next: () => Promise<void>) => {
						await next();
				},
}));

vi.mock("../../lib/logger.js", () => ({ logger: mockLogger }));

// Stub requireAdmin so we can test the route logic without going through
// the full auth middleware. The `isAdmin` flag is set on the Hono context
// by the test helper below.
vi.mock("../../auth/middleware.js", async () => {
		const actual = await vi.importActual<typeof import("../../auth/middleware.js")>(
				"../../auth/middleware.js",
		);
		return {
				...actual,
				sessionOrBearerAuth: vi.fn(async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
						c.set("userId", "admin_1");
						c.set("session", { user: { id: "admin_1" } });
						await next();
				}),
				requireAdmin: () =>
						async (_c: unknown, next: () => Promise<void>) => {
								await next();
						},
		};
});

import { adminRoutes } from "../admin.js";

function mockLockedBalance(balanceCents?: string) {
	const lock = vi.fn().mockResolvedValue(balanceCents === undefined ? [] : [{ balanceCents }]);
	mockDb.select.mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ for: lock }) }) });
	return lock;
}

function adminRequest(
		method: "get" | "post",
		path: string,
		body?: unknown,
) {
		const app = new Hono();
		app.route("/", adminRoutes);
		return app.request(
				new Request(`http://localhost${path}`, {
						method: method.toUpperCase(),
						headers: { "Content-Type": "application/json" },
						body: body ? JSON.stringify(body) : undefined,
				}),
		);
}

beforeEach(() => {
		vi.clearAllMocks();
		// Default: site_settings row exists, no users yet
		mockDb.select.mockReturnValue({
				from: vi.fn().mockReturnValue({
						limit: vi.fn().mockResolvedValue([{ id: "default" }]),
				}),
		});
});

describe("admin routes", () => {
		it("keeps full-range usage totals when only one group is returned and flags unknown costs", async () => {
				mockDb.execute.mockResolvedValueOnce([{
					key: "venice", requests: 2, upstream_cents: "100", total_cents: "150",
					unknown_cost_requests: 0, range_requests: 5, range_input_tokens: 200,
					range_output_tokens: 100, range_upstream_cents: "100", range_markup_cents: "50",
					range_total_cents: "160", range_unknown_cost_requests: 3,
				}]);
				const res = await adminRequest("get", "/v1/admin/usage/summary?limit=1");
				expect(res.status).toBe(200);
				const json = await res.json();
				expect(json.items).toHaveLength(1);
				expect(json.items[0].unknownCostRequests).toBe(0);
				expect(json.totals).toEqual({
					requests: 5, inputTokens: 200, outputTokens: 100, upstreamCents: 100,
					markupCents: 50, totalCents: 160, unknownCostRequests: 3,
				});
		});

		describe("POST /v1/admin/site-settings", () => {
				it("rejects invalid body", async () => {
						const res = await adminRequest("post", "/v1/admin/site-settings", {
								cardPaymentsEnabled: "yes", // not a boolean
						});
						expect(res.status).toBe(400);
				});

				it("updates existing settings row and writes audit log", async () => {
						const res = await adminRequest("post", "/v1/admin/site-settings", {
								cardPaymentsEnabled: false,
								maintenanceMode: true,
								maintenanceMessage: "Back at 8pm UTC.",
						});
						expect(res.status).toBe(200);
						// The createAuditLogger middleware wrote the audit row AFTER the
						// handler returned; verify it captured the patch.
						expect(mockAuditLog).toHaveBeenCalledWith(
								expect.objectContaining({
										userId: "admin_1",
										action: "SITE_SETTINGS_UPDATED",
										resource: "site_settings",
										metadata: expect.objectContaining({
												cardPaymentsEnabled: false,
												maintenanceMode: true,
												maintenanceMessage: "Back at 8pm UTC.",
										}),
								}),
						);
				});

				it("inserts a fresh settings row when none exists", async () => {
						mockDb.select.mockReturnValueOnce({
								from: vi.fn().mockReturnValue({
										limit: vi.fn().mockResolvedValueOnce([]),
								}),
						});
						const res = await adminRequest("post", "/v1/admin/site-settings", {
								cryptoPaymentsEnabled: false,
						});
						expect(res.status).toBe(200);
						expect(mockDb.insert).toHaveBeenCalled();
				});
		});

		describe("POST /v1/admin/credit-adjust", () => {
				it("rejects invalid body", async () => {
						const res = await adminRequest("post", "/v1/admin/credit-adjust", {
								userId: "u1",
								deltaCents: "lots",
						});
						expect(res.status).toBe(400);
				});

				it("returns 404 when target user does not exist", async () => {
						mockDb.select.mockReturnValueOnce({
								from: vi.fn().mockReturnValue({
										where: vi.fn().mockReturnValue({
												limit: vi.fn().mockResolvedValueOnce([]),
										}),
								}),
						});
						const res = await adminRequest("post", "/v1/admin/credit-adjust", {
								userId: "missing",
								deltaCents: 100,
								reason: "goodwill credit",
						});
						expect(res.status).toBe(404);
				});

				it("credits the user and writes CREDIT_ADJUSTED audit log", async () => {
						mockDb.select.mockReturnValueOnce({
								from: vi.fn().mockReturnValue({
										where: vi.fn().mockReturnValue({
												limit: vi.fn().mockResolvedValueOnce([{ id: "u_target" }]),
										}),
								}),
						});
						const res = await adminRequest("post", "/v1/admin/credit-adjust", {
								userId: "u_target",
								deltaCents: 500,
								reason: "support credit",
						});
						expect(res.status).toBe(200);
						expect(mockAuditLog).toHaveBeenCalledWith(
								expect.objectContaining({
										action: "CREDIT_ADJUSTED",
										resource: "credit_balance",
										resourceId: "u_target",
										metadata: expect.objectContaining({ requestedDeltaCents: 500, reason: "support credit" }),
								}),
						);
				});

				it("emits CREDIT_DEDUCTED when deltaCents is negative", async () => {
						mockDb.select.mockReturnValueOnce({
								from: vi.fn().mockReturnValue({
										where: vi.fn().mockReturnValue({
												limit: vi.fn().mockResolvedValueOnce([{ id: "u_target" }]),
										}),
								}),
						});
						const lock = mockLockedBalance("500");
						const res = await adminRequest("post", "/v1/admin/credit-adjust", {
								userId: "u_target",
								deltaCents: -250,
								reason: "refund clawback",
						});
						expect(res.status).toBe(200);
						expect(await res.json()).toMatchObject({ deltaCents: -250, requestedDeltaCents: -250, capped: false });
						expect(lock).toHaveBeenCalledWith("update");
						expect(mockAuditLog).toHaveBeenCalledWith(
								expect.objectContaining({ action: "CREDIT_DEDUCTED", metadata: expect.objectContaining({ appliedDeltaCents: -250, deductionCappedAtBalance: false }) }),
						);
				});

				it.each([undefined, "0"])("rejects deductions without an available balance (%s)", async balance => {
					mockDb.select.mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: "u_target" }]) }) }) });
					mockLockedBalance(balance);
					const res = await adminRequest("post", "/v1/admin/credit-adjust", { userId: "u_target", deltaCents: -250, reason: "No available credit" });
					expect(res.status).toBe(400);
					expect(mockDb.insert).not.toHaveBeenCalled();
					expect(mockDb.update).not.toHaveBeenCalled();
					expect(mockAuditLog).not.toHaveBeenCalled();
				});

				it("reports only the applied deduction when the balance caps it", async () => {
					mockDb.select.mockReturnValueOnce({ from: vi.fn().mockReturnValue({ where: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ id: "u_target" }]) }) }) });
					mockLockedBalance("100.12500000");
					const res = await adminRequest("post", "/v1/admin/credit-adjust", { userId: "u_target", deltaCents: -250, reason: "Partial deduction" });
					expect(res.status).toBe(200);
					expect(await res.json()).toMatchObject({ deltaCents: -100.125, requestedDeltaCents: -250, capped: true });
					expect(mockAuditLog).toHaveBeenCalledWith(expect.objectContaining({ metadata: expect.objectContaining({ appliedDeltaCents: -100.125, deductionCappedAtBalance: true }) }));
				});

				it("rejects a zero adjustment without writing an audit or ledger row", async () => {
					const res = await adminRequest("post", "/v1/admin/credit-adjust", { userId: "u_target", deltaCents: 0, reason: "No operation" });
					expect(res.status).toBe(400);
					expect(mockDb.transaction).not.toHaveBeenCalled();
					expect(mockAuditLog).not.toHaveBeenCalled();
				});
		});

		describe("POST /v1/admin/user-suspend", () => {
				it("flips the suspended flag and writes USER_SUSPENDED audit log", async () => {
						mockDb.select.mockReturnValueOnce({
								from: vi.fn().mockReturnValue({
										where: vi.fn().mockReturnValue({
												limit: vi.fn().mockResolvedValueOnce([{ id: "u_target" }]),
										}),
								}),
						});
						const res = await adminRequest("post", "/v1/admin/user-suspend", {
								userId: "u_target",
								suspended: true,
								reason: "policy violation",
						});
						expect(res.status).toBe(200);
						expect(mockAuditLog).toHaveBeenCalledWith(
								expect.objectContaining({
										action: "USER_SUSPENDED",
										resourceId: "u_target",
										metadata: expect.objectContaining({ reason: "policy violation" }),
								}),
						);
				});

				it("writes USER_UNSUSPENDED when unsuspending", async () => {
						mockDb.select.mockReturnValueOnce({
								from: vi.fn().mockReturnValue({
										where: vi.fn().mockReturnValue({
												limit: vi.fn().mockResolvedValueOnce([{ id: "u_target" }]),
										}),
								}),
						});
						const res = await adminRequest("post", "/v1/admin/user-suspend", {
								userId: "u_target",
								suspended: false,
								reason: "appeal granted",
						});
						expect(res.status).toBe(200);
						expect(mockAuditLog).toHaveBeenCalledWith(
								expect.objectContaining({ action: "USER_UNSUSPENDED" }),
						);
				});
		});

		describe("POST /v1/admin/rate-limit-override", () => {
				it("sets an override and writes RATE_LIMIT_OVERRIDE_SET audit log", async () => {
						mockDb.select.mockReturnValueOnce({
								from: vi.fn().mockReturnValue({
										where: vi.fn().mockReturnValue({
												limit: vi.fn().mockResolvedValueOnce([{ id: "u_target" }]),
										}),
								}),
						});
						const res = await adminRequest("post", "/v1/admin/rate-limit-override", {
								userId: "u_target",
								maxRequestsPerMinute: 30,
								reason: "noisy customer",
						});
						expect(res.status).toBe(200);
						expect(mockAuditLog).toHaveBeenCalledWith(
								expect.objectContaining({
										action: "RATE_LIMIT_OVERRIDE_SET",
										resource: "rate_limit_overrides",
										resourceId: "u_target",
										metadata: expect.objectContaining({ maxRequestsPerMinute: 30 }),
								}),
						);
				});

				it("removes the override (null) and writes RATE_LIMIT_OVERRIDE_REMOVED", async () => {
						mockDb.select.mockReturnValueOnce({
								from: vi.fn().mockReturnValue({
										where: vi.fn().mockReturnValue({
												limit: vi.fn().mockResolvedValueOnce([{ id: "u_target" }]),
										}),
								}),
						});
						const res = await adminRequest("post", "/v1/admin/rate-limit-override", {
								userId: "u_target",
								maxRequestsPerMinute: null,
								reason: "reset",
						});
						expect(res.status).toBe(200);
						expect(mockAuditLog).toHaveBeenCalledWith(
								expect.objectContaining({ action: "RATE_LIMIT_OVERRIDE_REMOVED" }),
						);
				});
		});

		describe("GET /v1/admin/users", () => {
				it("returns paginated user list", async () => {
						mockDb.execute.mockResolvedValueOnce([
								{ id: "u1", email: "a@b.com", balance_cents: "100", total_deposited_cents: "200" },
								{ id: "u2", email: "c@d.com", balance_cents: "0", total_deposited_cents: "0" },
						]);
						const res = await adminRequest("get", "/v1/admin/users?limit=10");
						expect(res.status).toBe(200);
						const json = (await res.json()) as { items: Array<{ id: string }> };
						expect(json.items).toHaveLength(2);
						expect(json.items[0].id).toBe("u1");
				});

				it("caps limit at 100", async () => {
						mockDb.execute.mockResolvedValueOnce([]);
						const res = await adminRequest("get", "/v1/admin/users?limit=99999");
						expect(res.status).toBe(400);
				});
		});
});
