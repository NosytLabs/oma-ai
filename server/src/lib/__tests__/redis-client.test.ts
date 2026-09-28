import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	ping: vi.fn(),
	warn: vi.fn(),
	info: vi.fn(),
	config: {
		UPSTASH_REDIS_REST_URL: "https://redis.example.test",
		UPSTASH_REDIS_REST_TOKEN: "private-test-token",
		REDIS_URL: undefined,
		REDIS_TOKEN: undefined,
	},
}));

vi.mock("@upstash/redis", () => ({
	Redis: class { ping = mocks.ping; },
}));
vi.mock("../../config.js", () => ({ config: mocks.config }));
vi.mock("../logger.js", () => ({ logger: { warn: mocks.warn, info: mocks.info } }));

import { closeRedisClient, getRedisClient, isRedisReady, redisHealthCheck } from "../redis-client.js";

beforeEach(async () => {
	vi.useFakeTimers();
	vi.setSystemTime(0);
	vi.resetAllMocks();
	await closeRedisClient();
	mocks.ping.mockResolvedValue("PONG");
});
afterEach(() => vi.useRealTimers());

describe("Redis dependency recovery", () => {
	it("retries a transient startup failure after a cooldown and returns a healthy client", async () => {
		mocks.ping.mockRejectedValueOnce(new Error("fetch failed"));
		expect(await getRedisClient()).toBeNull();
		expect(isRedisReady()).toBe(false);
		expect(await getRedisClient()).toBeNull();
		expect(mocks.ping).toHaveBeenCalledTimes(1);
		vi.setSystemTime(1_000);
		expect(await getRedisClient()).not.toBeNull();
		expect(isRedisReady()).toBe(true);
		expect(mocks.ping).toHaveBeenCalledTimes(2);
	});

	it("shares a single pending ping among concurrent consumers and health checks", async () => {
		let resolve!: (value: string) => void;
		mocks.ping.mockReturnValue(new Promise<string>((done) => { resolve = done; }));
		const consumers = [getRedisClient(), getRedisClient(), redisHealthCheck()];
		await Promise.resolve();
		expect(mocks.ping).toHaveBeenCalledTimes(1);
		resolve("PONG");
		const results = await Promise.all(consumers);
		expect(results[0]).toBe(results[1]);
		expect(results[2]).toMatchObject({ status: "ok" });
	});

	it("backs off repeated failures and caps the delay at 30 seconds", async () => {
		mocks.ping.mockRejectedValue(new Error("network unavailable"));
		let now = 0;
		for (const delay of [1_000, 2_000, 4_000, 8_000, 16_000, 30_000, 30_000]) {
			expect(await getRedisClient()).toBeNull();
			const count = mocks.ping.mock.calls.length;
			vi.setSystemTime(now + delay - 1);
			expect(await redisHealthCheck()).toEqual({ status: "error" });
			expect(mocks.ping).toHaveBeenCalledTimes(count);
			now += delay;
			vi.setSystemTime(now);
		}
		expect(mocks.ping).toHaveBeenCalledTimes(7);
	});

	it("a healthy readiness probe restores the client and resets the next failure delay", async () => {
		expect(await getRedisClient()).not.toBeNull();
		mocks.ping.mockRejectedValueOnce(new Error("fetch failed"));
		expect(await redisHealthCheck()).toEqual({ status: "error" });
		expect(isRedisReady()).toBe(false);
		vi.setSystemTime(1_000);
		expect(await redisHealthCheck()).toMatchObject({ status: "ok" });
		expect(await getRedisClient()).not.toBeNull();
		expect(isRedisReady()).toBe(true);
		mocks.ping.mockRejectedValueOnce(new Error("fetch failed"));
		await redisHealthCheck();
		vi.setSystemTime(2_000);
		expect(await getRedisClient()).not.toBeNull();
		expect(mocks.info).toHaveBeenCalledWith("[redis] connection recovered");
	});

	it("does not let a probe from a closed client poison a replacement client", async () => {
		let reject!: (error: Error) => void;
		mocks.ping.mockReturnValueOnce(new Promise<string>((_done, fail) => { reject = fail; }));
		const oldRequest = getRedisClient();
		await Promise.resolve();
		await closeRedisClient();
		expect(await getRedisClient()).not.toBeNull();
		reject(new Error("old request failed"));
		expect(await oldRequest).toBeNull();
		expect(isRedisReady()).toBe(true);
		expect(await getRedisClient()).not.toBeNull();
	});

	it("logs an allowlisted failure reason and status without the SDK error or credentials", async () => {
		const error = Object.assign(new Error("Unauthorized at https://private-test-token@redis.example.test; command was secret-data"), { status: 401 });
		mocks.ping.mockRejectedValueOnce(error);
		await getRedisClient();
		expect(mocks.warn).toHaveBeenCalledWith(
			{ reason: "authentication", status: 401, retryAfterMs: 1_000 },
			"[redis] connection check failed",
		);
		const output = JSON.stringify(mocks.warn.mock.calls);
		expect(output).not.toContain("private-test-token");
		expect(output).not.toContain("redis.example.test");
		expect(output).not.toContain("secret-data");
	});

	it("keeps the allowlisted transport code from a fetch cause without its hostname", async () => {
		mocks.ping.mockRejectedValueOnce(new Error("fetch failed", {
			cause: Object.assign(new Error("getaddrinfo ENOTFOUND private-host.example.test"), {
				code: "ENOTFOUND",
				hostname: "private-host.example.test",
			}),
		}));
		await getRedisClient();
		expect(mocks.warn).toHaveBeenCalledWith(
			{ reason: "network", code: "ENOTFOUND", retryAfterMs: 1_000 },
			"[redis] connection check failed",
		);
		expect(JSON.stringify(mocks.warn.mock.calls)).not.toContain("private-host.example.test");
	});

	it("drops arbitrary codes and messages from a nested error", async () => {
		mocks.ping.mockRejectedValueOnce(new Error("fetch failed", {
			cause: { code: "private-test-token", message: "secret-data" },
		}));
		await getRedisClient();
		expect(mocks.warn).toHaveBeenCalledWith(
			{ reason: "network", retryAfterMs: 1_000 },
			"[redis] connection check failed",
		);
	});
});
