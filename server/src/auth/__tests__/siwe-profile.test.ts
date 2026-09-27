import { beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { createSiweMessage } from "viem/siwe";

// Keep Better Auth's real routes, signature checks, hooks and cookies; replace
// only the external database and ENS network lookup.
const memory = vi.hoisted(() => ({
	user: [] as Record<string, unknown>[], session: [], account: [], verification: [], walletAddress: [],
}));
vi.mock("../../db/client.js", async () => {
	const { PgDialect } = await import("drizzle-orm/pg-core");
	return { db: { update: () => ({ set: (values: object) => ({ where: (query: Parameters<InstanceType<typeof PgDialect>["sqlToQuery"]>[0]) => {
		const { params } = new PgDialect().sqlToQuery(query);
		for (const user of memory.user) {
			if (user.email === params[0] && (!user.evmAddress || user.evmAddress === params[1])) Object.assign(user, values);
		}
	} }) }) } };
});
vi.mock("better-auth/adapters/drizzle", async () => {
	const { memoryAdapter } = await import("better-auth/adapters/memory");
	return { drizzleAdapter: () => memoryAdapter(memory) };
});
vi.mock("../../config.js", () => ({ config: {
	NODE_ENV: "test", PUBLIC_APP_URL: "http://localhost:3000", FREE_SIGNUP_CENTS: 0,
	BETTER_AUTH_SECRET: "siwe-regression-secret-96ba02e8-74cf-4fdb-8576",
} }));
vi.mock("viem", async () => {
	const actual = await vi.importActual<typeof import("viem")>("viem");
	return { ...actual, createPublicClient: () => ({ getEnsName: async () => null }) };
});

import { auth } from "../../auth.js";

const wallet = privateKeyToAccount("0x0123456789012345678901234567890123456789012345678901234567890123");
const origin = "http://localhost:3000";
async function post(path: string, body: object) {
	return auth.handler(new Request(`${origin}/api/auth${path}`, {
		method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
	}));
}
async function signIn(validSignature = true) {
	const nonceResponse = await post("/siwe/nonce", {});
	expect(nonceResponse.status).toBe(200);
	const { nonce } = await nonceResponse.json();
	const message = createSiweMessage({ address: wallet.address, domain: "localhost:3000", uri: origin, version: "1", chainId: 8453, nonce });
	const signature = await wallet.signMessage({ message: validSignature ? message : "Different message" });
	return post("/siwe/verify", { message, signature });
}
function cookieHeader(response: Response) {
	// Browsers replace an earlier value when a response sets the same cookie
	// again (the after-hook refreshes Better Auth's initial session cache).
	const jar = new Map<string, string>();
	for (const cookie of response.headers.getSetCookie()) {
		const pair = cookie.split(";")[0]!;
		jar.set(pair.slice(0, pair.indexOf("=")), pair);
	}
	return [...jar.values()].join("; ");
}

beforeEach(() => {
	for (const rows of Object.values(memory)) rows.length = 0;
});

describe("SIWE profile binding", () => {
	it("persists the signed wallet on first signup and includes it in the first cached session", async () => {
		const response = await signIn();
		expect(response.status).toBe(200);
		expect(memory.user).toHaveLength(1);
		expect(memory.user[0]?.evmAddress).toBe(wallet.address);
		const sessionResponse = await auth.handler(new Request(`${origin}/api/auth/get-session`, { headers: { cookie: cookieHeader(response) } }));
		const session = await sessionResponse.json();
		expect(session.user.evmAddress).toBe(wallet.address);
	});

	it("backfills an existing wallet user by verified binding regardless of their email", async () => {
		await signIn();
		memory.user[0]!.email = "changed@example.com";
		memory.user[0]!.evmAddress = null;
		const response = await signIn();
		expect(response.status).toBe(200);
		expect(memory.user).toHaveLength(1);
		expect(memory.user[0]?.evmAddress).toBe(wallet.address);
	});

	it("does not bind a wallet to an unrelated user with a wallet-shaped email", async () => {
		const context = await auth.$context;
		await context.internalAdapter.createUser({ name: "Unrelated user", email: `${wallet.address.toLowerCase()}@oma-ai.com` }, { method: "email" });
		const unrelatedId = memory.user[0]!.id;
		const response = await signIn();
		expect(response.status).toBe(200);
		expect(memory.user.find(user => user.id === unrelatedId)?.evmAddress).toBeFalsy();
		expect(memory.user.find(user => user.id !== unrelatedId)?.evmAddress).toBe(wallet.address);
	});

	it("never persists a wallet or creates a session for an invalid signature", async () => {
		const response = await signIn(false);
		expect(response.status).toBe(401);
		expect(memory.user).toHaveLength(0);
		expect(memory.session).toHaveLength(0);
	});
});
