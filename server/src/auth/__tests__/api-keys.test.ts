import { describe, expect, it, vi, beforeEach } from "vitest";
import { validateApiKey, isIpAllowedByList } from "../api-keys.js";
import crypto from "node:crypto";

// Mock timingSafeEqual properly before it gets used
vi.mock("node:crypto", async (importOriginal) => {
	const original = await importOriginal<typeof import("node:crypto")>();
	return {
		...original,
		default: {
			...original,
			timingSafeEqual: vi.fn().mockReturnValue(true)
		},
		timingSafeEqual: vi.fn().mockReturnValue(true)
	};
});

// Avoid the queue push doing real stuff
vi.mock("../../jobs/queue.js", () => ({
	queueLastUsedUpdate: vi.fn()
}));

const mockDb = vi.hoisted(() => {
	const limitMock = vi.fn().mockReturnThis();
	const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
	const fromMock = vi.fn().mockReturnValue({ where: whereMock });
	const selectMock = vi.fn().mockReturnValue({ from: fromMock });
	
	return {
		select: selectMock,
		limitMock
	};
});

const mockRedis = vi.hoisted(() => ({
	get: vi.fn(),
	setEx: vi.fn(),
	del: vi.fn(),
}));

vi.mock("../../db/client.js", () => ({
	db: mockDb,
}));

vi.mock("../../db/schema.js", () => ({
	apiKeys: {
		id: "id",
		keyHash: "keyHash",
		active: "active",
		expiresAt: "expiresAt",
		userId: "userId"
	},
}));

vi.mock("../../lib/redis-client.js", () => ({
	getRedisClient: vi.fn().mockResolvedValue(mockRedis),
}));

describe("isIpAllowedByList", () => {
    it("returns true for empty or null list", () => {
        expect(isIpAllowedByList("1.2.3.4", null)).toBe(true);
        expect(isIpAllowedByList("1.2.3.4", [])).toBe(true);
    });

    it("handles valid IPv4 bare matches", () => {
        expect(isIpAllowedByList("1.2.3.4", ["1.2.3.4", "5.6.7.8"])).toBe(true);
        expect(isIpAllowedByList("1.2.3.4", ["5.6.7.8"])).toBe(false);
    });

    it("handles valid IPv4 CIDR blocks", () => {
        // 192.168.1.0/24 covers 192.168.1.0 to 192.168.1.255
        expect(isIpAllowedByList("192.168.1.50", ["192.168.1.0/24"])).toBe(true);
        expect(isIpAllowedByList("192.168.2.50", ["192.168.1.0/24"])).toBe(false);
        // /0 covers everything
        expect(isIpAllowedByList("8.8.8.8", ["0.0.0.0/0"])).toBe(true);
    });
});

describe("validateApiKey", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns null for malformed or empty keys", async () => {
		expect(await validateApiKey("")).toBeNull();
		// @ts-expect-error
		expect(await validateApiKey(null)).toBeNull();
	});

	it("returns null if key doesn't match db hash", async () => {
		mockRedis.get.mockResolvedValueOnce(null);
		mockDb.limitMock.mockResolvedValueOnce([]); // Empty DB result

		const result = await validateApiKey("oma_sk_invalid1234567890123456789012");
		expect(result).toBeNull();
	});
	
	it("returns key object if hash matches and active", async () => {
		const rawKey = "oma_sk_testkeytestkeytestkey123456";
		const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
		const dbRow = {
			id: "key-1",
			keyHash,
			keyPrefix: rawKey.slice(0, 12),
			active: true,
			expiresAt: null
		};
		
		mockRedis.get.mockResolvedValueOnce(null);
		mockDb.limitMock.mockResolvedValueOnce([dbRow]);

		const result = await validateApiKey(rawKey);
		expect(result).toEqual(dbRow);
		// Should set cache
		expect(mockRedis.setEx).toHaveBeenCalledWith(`apikey:${keyHash}`, expect.any(Number), JSON.stringify(dbRow));
	});

	it("handles expired keys by returning expired=true without caching", async () => {
		const rawKey = "oma_sk_expiredtestkeytestkey123456";
		const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
		const pastDate = new Date(Date.now() - 10000);
		const dbRow = {
			id: "key-2",
			keyHash,
			keyPrefix: rawKey.slice(0, 12),
			active: true,
			expiresAt: pastDate
		};
		
		mockRedis.get.mockResolvedValueOnce(null);
		mockDb.limitMock.mockResolvedValueOnce([dbRow]);

		const result = await validateApiKey(rawKey);
		expect(result).toEqual({ ...dbRow, expired: true });
		expect(mockRedis.setEx).not.toHaveBeenCalled();
	});

	it("retrieves valid keys from redis cache without DB query", async () => {
		const rawKey = "oma_sk_cachedtestkeytestkey123456";
		const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
		const cachedRow = {
			id: "key-3",
			keyHash,
			keyPrefix: rawKey.slice(0, 12),
			active: true,
			expiresAt: null
		};
		
		mockRedis.get.mockResolvedValueOnce(JSON.stringify(cachedRow));
		mockDb.limitMock.mockResolvedValueOnce([]); // Ensure DB isn't accidentally doing this

		const result = await validateApiKey(rawKey);
		expect(result).toEqual(cachedRow);
		expect(mockDb.select).not.toHaveBeenCalled();
	});
});
