import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DrizzleQueryError } from "drizzle-orm/errors";

vi.mock("../../config.js", () => ({ config: {} }));

beforeEach(() => {
	vi.resetModules();
	vi.stubEnv("NODE_ENV", "production");
	vi.stubEnv("NEON_FUNCTION", "1");
	vi.stubEnv("LOG_LEVEL", "trace");
	vi.spyOn(console, "debug").mockImplementation(() => {});
	vi.spyOn(console, "info").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.unstubAllEnvs();
	vi.restoreAllMocks();
});

describe("Neon Function logging", () => {
	it.each(["err", "error"])("omits SQL, values and driver credentials from the %s field", async (field) => {
		const { logger } = await import("../logger.js");
		const cause = Object.assign(new Error("postgresql://test:synthetic-password@private-db/test"), {
			code: "23505", status: 402,
			detail: "Key (email)=(private@example.test) already exists",
			client: { password: "synthetic-password" },
		});
		const err = new DrizzleQueryError("insert into private_accounts values ($1)", ["synthetic-secret"], cause);
		logger.error({ [field]: err, correlationId: "request-123" }, "request failed");

		const output = vi.mocked(console.error).mock.calls[0][0] as string;
		for (const privateValue of ["synthetic-password", "synthetic-secret", "private_accounts", "private@example.test", "private-db"]) {
			expect(output).not.toContain(privateValue);
		}
		expect(JSON.parse(output)).toMatchObject({
			[field]: { type: "DatabaseError", code: "23505", status: 402 },
			correlationId: "request-123", msg: "request failed",
		});
	});

	it("omits wrapped query details from parent error messages and stacks", async () => {
		const { logger } = await import("../logger.js");
		const query = new DrizzleQueryError("select private_accounts", ["synthetic-secret"], new Error("driver detail"));
		logger.error({ err: new Error(`Operation failed: ${query.message}`, { cause: query }) }, "request failed");
		const output = vi.mocked(console.error).mock.calls[0][0] as string;
		expect(output).not.toContain("synthetic-secret");
		expect(output).not.toContain("private_accounts");
		expect(JSON.parse(output).err).toEqual({ type: "DatabaseError" });
	});

	it("emits structured diagnostics through the console method matching severity", async () => {
		const { logger } = await import("../logger.js");
		logger.trace("trace entry");
		logger.debug("debug entry");
		logger.info("info entry");
		logger.warn({ reason: "authentication", status: 401 }, "[redis] connection check failed");
		logger.error({ err: new Error("failure detail") }, "error entry");
		logger.fatal("fatal entry");

		expect(console.debug).toHaveBeenCalledTimes(2);
		expect(console.info).toHaveBeenCalledTimes(1);
		expect(console.warn).toHaveBeenCalledTimes(1);
		expect(console.error).toHaveBeenCalledTimes(2);
		expect(JSON.parse(vi.mocked(console.warn).mock.calls[0][0])).toMatchObject({
			level: "warn",
			service: "oma-server",
			reason: "authentication",
			status: 401,
			msg: "[redis] connection check failed",
		});
		expect(JSON.parse(vi.mocked(console.error).mock.calls[0][0])).toMatchObject({
			level: "error",
			err: { type: "Error", message: "failure detail" },
		});
	});

	it("honors the configured minimum level", async () => {
		vi.stubEnv("LOG_LEVEL", "warn");
		const { logger } = await import("../logger.js");
		logger.info("filtered entry");
		logger.warn("visible entry");
		expect(console.info).not.toHaveBeenCalled();
		expect(console.warn).toHaveBeenCalledTimes(1);
	});

	it("keeps the regular Pino destination outside Neon Functions", async () => {
		vi.stubEnv("NEON_FUNCTION", "0");
		const { logger } = await import("../logger.js");
		// Inspect the selected destination without writing to the test process's
		// real stdout: non-Neon production keeps Pino's normal stream.
		const { symbols } = await import("pino");
		const stream = (logger as unknown as Record<symbol, unknown>)[symbols.streamSym];
		expect(stream).toMatchObject({ fd: 1 });
	});
});
