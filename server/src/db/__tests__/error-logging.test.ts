import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	config: { DATABASE_URL: "", CONNECTION_POOL_SIZE: 1 },
	listeners: new Map<string, (error: Error) => void>(),
	constructorError: null as Error | null,
}));

vi.mock("../../config.js", () => ({ config: mocks.config }));
vi.mock("@neondatabase/serverless", () => ({
	Pool: class {
		constructor() { if (mocks.constructorError) throw mocks.constructorError; }
		on(event: string, listener: (error: Error) => void) { mocks.listeners.set(event, listener); }
	},
}));
vi.mock("pg", () => ({
	default: { Pool: class {
		constructor() { if (mocks.constructorError) throw mocks.constructorError; }
		on(event: string, listener: (error: Error) => void) { mocks.listeners.set(event, listener); }
	} },
}));
vi.mock("drizzle-orm/neon-serverless", () => ({ drizzle: () => ({ select: () => [] }) }));
vi.mock("drizzle-orm/node-postgres", () => ({ drizzle: () => ({ select: () => [] }) }));

beforeEach(() => {
	vi.resetModules();
	vi.stubEnv("NODE_ENV", "production");
	vi.stubEnv("NEON_FUNCTION", "1");
	vi.spyOn(console, "info").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
	mocks.listeners.clear();
	mocks.constructorError = null;
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

function credentialBearingError() {
	return Object.assign(new Error(`Cannot connect to ${mocks.config.DATABASE_URL}`), {
		code: "XX000", status: 402,
		client: { connectionParameters: { password: "synthetic-password" }, connectionString: mocks.config.DATABASE_URL },
		cause: new Error("password=synthetic-password"),
	});
}

function expectSafeDiagnostic() {
	const output = vi.mocked(console.error).mock.calls[0][0] as string;
	expect(output).not.toContain("synthetic-password");
	expect(output).not.toContain("connectionString");
	expect(output).not.toContain(mocks.config.DATABASE_URL);
	expect(JSON.parse(output)).toMatchObject({
		err: { type: "DatabaseError", code: "XX000", status: 402 },
	});
}

describe("database error logging", () => {
	it.each(["db.example.neon.tech", "127.0.0.1"])("does not serialize pool credentials for %s", async (host) => {
		mocks.config.DATABASE_URL = `postgresql://test:synthetic-password@${host}/test`;
		const { db } = await import("../client.js");
		db.select();
		mocks.listeners.get("error")!(credentialBearingError());
		expectSafeDiagnostic();
	});

	it.each([null, "synthetic-password", { code: "password=synthetic-password", status: "402" }])("omits unstructured or invalid error fields: %j", async (error) => {
		mocks.config.DATABASE_URL = "postgresql://test:synthetic-password@db.example.neon.tech/test";
		const { db } = await import("../client.js");
		db.select();
		mocks.listeners.get("error")!(error as unknown as Error);
		const output = vi.mocked(console.error).mock.calls[0][0] as string;
		expect(output).not.toContain("synthetic-password");
		expect(JSON.parse(output).err).toEqual({ type: "DatabaseError" });
	});

	it("sanitizes fatal initialization failures before refusing startup", async () => {
		mocks.config.DATABASE_URL = "postgresql://test:synthetic-password@db.example.neon.tech/test";
		mocks.constructorError = credentialBearingError();
		vi.spyOn(process, "exit").mockImplementation(() => { throw new Error("process exit"); });
		const { db } = await import("../client.js");
		expect(() => db.select()).toThrow("process exit");
		expect(process.exit).toHaveBeenCalledWith(1);
		expectSafeDiagnostic();
	});
});
