import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	account,
	auditLogs,
	apiKeys,
	session,
	user,
	verification,
	walletAddress,
} from "../../../db/schema.js";

const state = vi.hoisted(() => {
	const txDelete = vi.fn(() => ({
		where: vi.fn(async () => undefined),
	}));
	const txUpdateSets: Array<Record<string, unknown>> = [];
	const txUpdate = vi.fn(() => ({
		set: vi.fn((fields: Record<string, unknown>) => {
			txUpdateSets.push(fields);
			return { where: vi.fn(async () => undefined) };
		}),
	}));
	const txInsertValues: Array<Record<string, unknown>> = [];
	const txInsert = vi.fn(() => ({
		values: vi.fn(async (fields: Record<string, unknown>) => {
			txInsertValues.push(fields);
			return undefined;
		}),
	}));

	type MockTx = {
		delete: typeof txDelete;
		update: typeof txUpdate;
		insert: typeof txInsert;
	};
	const tx: MockTx = {
		delete: txDelete,
		update: txUpdate,
		insert: txInsert,
	};
	const db = {
		select: vi.fn(() => {
			const result = state.selectResults.shift() ?? [];
			return {
				from: vi.fn(() => ({
					where: vi.fn(() => {
						const query = {
							limit: vi.fn(async () => result),
						};
						// Drizzle's count query is awaited without `.limit()`;
						// make this mock chain awaitable as well.
						return Object.assign(query, {
							then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
								Promise.resolve(result).then(resolve, reject),
						});
					}),
				})),
			};
		}),
		transaction: vi.fn(async (callback: (transaction: MockTx) => unknown) => callback(tx)),
		delete: txDelete,
		update: txUpdate,
		insert: txInsert,
	};

	return {
		adminId: "admin-1",
		authenticated: true,
		selectResults: [] as unknown[][],
		walletAdmins: new Set<string>(),
		db,
		txDelete,
		txUpdate,
		txUpdateSets,
		txInsert,
		txInsertValues,
		getSession: vi.fn(async () =>
			state.authenticated
				? {
						user: { id: state.adminId },
						session: { id: "session-1", userId: state.adminId },
					}
				: null,
		),
	};
});

vi.mock("../../../auth.js", () => ({
	auth: { api: { getSession: state.getSession } },
}));

vi.mock("../../../db/client.js", () => ({ db: state.db }));

vi.mock("../../../config.js", async () => {
	const actual = await vi.importActual<typeof import("../../../config.js")>(
		"../../../config.js",
	);
	return { ...actual, ADMIN_WALLET_ADDRESSES_SET: state.walletAdmins };
});

vi.mock("../../../middleware/audit.js", () => ({
	auditLog: vi.fn(async () => undefined),
}));

const { adminRoutes } = await import("../index.js");
const app = new Hono();
app.route("/", adminRoutes);

const DELETE_BODY = {
	confirmation: "DELETE",
	reason: "Requested by the account owner",
};

function queueAuthenticatedAdmin(target: {
	role: string | null;
	evmAddress: string | null;
	email?: string | null;
}) {
	// sessionAuth suspension check, requireAdmin lookup, DELETE target lookup
	state.selectResults.push(
		[{ banned: false, suspended: false }],
		[{ role: "admin", evmAddress: null, suspended: false }],
		[
			{
				id: "target-1",
				role: target.role,
				evmAddress: target.evmAddress,
				email: target.email ?? "target@example.com",
			},
		],
	);
}

async function deleteUser(body: unknown = DELETE_BODY, targetId = "target-1") {
	return app.request(`http://localhost/v1/admin/users/${targetId}`, {
		method: "DELETE",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}

beforeEach(() => {
	state.adminId = "admin-1";
	state.authenticated = true;
	state.selectResults.length = 0;
	state.walletAdmins.clear();
	state.txDelete.mockClear();
	state.txUpdate.mockClear();
	state.txInsert.mockClear();
	state.db.transaction.mockClear();
	state.txUpdateSets.length = 0;
	state.txInsertValues.length = 0;
	state.getSession.mockClear();
});

describe("DELETE /v1/admin/users/:id", () => {
	it("rejects unauthenticated requests before reaching the admin route", async () => {
		state.authenticated = false;

		const response = await deleteUser();
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body.error.type).toBe("authentication_error");
		expect(state.db.transaction).not.toHaveBeenCalled();
	});

	it("requires the literal DELETE confirmation and a non-empty reason", async () => {
		state.selectResults.push(
			[{ banned: false, suspended: false }],
			[{ role: "admin", evmAddress: null, suspended: false }],
		);

		const response = await deleteUser({ confirmation: "delete", reason: "" });
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error.message).toContain("Type DELETE");
		expect(state.db.transaction).not.toHaveBeenCalled();
	});

	it("rejects self-delete even with a valid confirmation", async () => {
		state.selectResults.push(
			[{ banned: false, suspended: false }],
			[{ role: "admin", evmAddress: null, suspended: false }],
		);

		const response = await deleteUser(DELETE_BODY, state.adminId);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error.message).toContain("own account");
		expect(state.db.transaction).not.toHaveBeenCalled();
	});

	it("protects an account whose wallet is in the admin allowlist", async () => {
		const protectedWallet = "0x1111111111111111111111111111111111111111";
		state.walletAdmins.add(protectedWallet.toLowerCase());
		queueAuthenticatedAdmin({ role: null, evmAddress: protectedWallet });

		const response = await deleteUser();
		const body = await response.json();

		expect(response.status).toBe(409);
		expect(body.error.message).toContain("admin wallet allowlist");
		expect(state.db.transaction).not.toHaveBeenCalled();
	});

	it("protects the last role-based administrator", async () => {
		queueAuthenticatedAdmin({ role: "admin", evmAddress: null });
		// The DELETE handler counts administrators after loading the target.
		state.selectResults.push([{ total: 1 }]);

		const response = await deleteUser();
		const body = await response.json();

		expect(response.status).toBe(409);
		expect(body.error.message).toContain("last administrator");
		expect(state.db.transaction).not.toHaveBeenCalled();
	});

	it("anonymizes a regular user and revokes their auth material", async () => {
		queueAuthenticatedAdmin({ role: null, evmAddress: null, email: "target@example.com" });

		const response = await deleteUser();
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			success: true,
			userId: "target-1",
			anonymized: true,
		});
		expect(state.db.transaction).toHaveBeenCalledTimes(1);
		expect(state.txDelete).toHaveBeenCalledTimes(4);
		expect(state.txDelete).toHaveBeenNthCalledWith(1, session);
		expect(state.txDelete).toHaveBeenNthCalledWith(2, account);
		expect(state.txDelete).toHaveBeenNthCalledWith(3, walletAddress);
		expect(state.txDelete).toHaveBeenNthCalledWith(4, verification);
		expect(state.txUpdate).toHaveBeenCalledTimes(2);
		expect(state.txUpdate).toHaveBeenNthCalledWith(1, apiKeys);
		expect(state.txUpdate).toHaveBeenNthCalledWith(2, user);
		expect(state.txInsert).toHaveBeenCalledTimes(1);
		expect(state.txInsert).toHaveBeenCalledWith(auditLogs);
		expect(state.txUpdateSets).toEqual(
			expect.arrayContaining([
			expect.objectContaining({ active: false }),
			expect.objectContaining({
				name: "Deleted user",
				emailVerified: false,
				banned: true,
				suspended: true,
				isAnonymous: true,
				role: null,
			}),
		]),
	);
		expect(state.txUpdateSets.find((fields) => fields.name === "Deleted user")?.email).toMatch(
		/^deleted-.+@deleted\.invalid$/,
		);
		expect(state.txInsertValues[0]).toMatchObject({
			userId: state.adminId,
			action: "USER_DELETED",
			resource: "user",
			resourceId: "target-1",
			metadata: expect.objectContaining({
				reason: DELETE_BODY.reason,
				anonymized: true,
			}),
		});
	});
});
