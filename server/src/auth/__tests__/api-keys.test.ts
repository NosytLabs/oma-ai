import { describe, expect, it, vi, beforeEach } from "vitest";
import { validateApiKey, isIpAllowedByList } from "../api-keys.js";
import crypto from "node:crypto";


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
	setex: vi.fn(),
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
	it("compares equivalent IPv6 addresses by their bits", () => {
		expect(isIpAllowedByList("2001:db8::1", ["2001:0db8:0000:0000:0000:0000:0000:0001"])).toBe(true);
		expect(isIpAllowedByList("::ffff:192.0.2.1", ["::ffff:c000:201"])).toBe(true);
	});
	it("restricts embedded IPv4 addresses to their actual IPv6 CIDR subnet", () => {
		expect(isIpAllowedByList("::ffff:10.1.2.3", ["::ffff:10.0.0.0/104"])).toBe(true);
		expect(isIpAllowedByList("::ffff:11.1.2.3", ["::ffff:10.0.0.0/104"])).toBe(false);
		expect(isIpAllowedByList("::ffff:10.2.2.3", ["::ffff:10.1.0.0/112"])).toBe(false);
		expect(isIpAllowedByList("::ffff:192.0.2.1", ["::ffff:c000:200/120"])).toBe(true);
	});
	it.each(["::/bad", "::/999", "::/-1", "not-an-ip/0"])("denies malformed persisted range %s", range => {
		expect(isIpAllowedByList("::1", [range])).toBe(false);
	});
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
		expect(mockRedis.setex).not.toHaveBeenCalled();
	});

	 it("rejects expired database keys without caching", async () => {
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
		expect(result).toBeNull();
		expect(mockRedis.setex).not.toHaveBeenCalled();
	});

	 it.each(["2000-01-01T00:00:00Z", "invalid", new Date()])("rejects database expiry %s even with a positive stale cache", async expiresAt => {
		const rawKey = "oma_sk_expiredcachekeytestkey123456";
		const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
		mockRedis.get.mockResolvedValue(JSON.stringify({ id: "expired-cache", active: true, keyPrefix: rawKey.slice(0, 12), expiresAt: null }));
		mockDb.limitMock.mockResolvedValueOnce([{ id: "expired-cache", keyHash, active: true, keyPrefix: rawKey.slice(0, 12), expiresAt }]);
		expect(await validateApiKey(rawKey)).toBeNull();
		expect(mockRedis.get).not.toHaveBeenCalled();
		expect(mockDb.select).toHaveBeenCalledOnce();
		expect(mockRedis.setex).not.toHaveBeenCalled();
	});

	 it("rejects a revoked or deleted database key even when Redis still contains a valid credential", async () => {
		const rawKey = "oma_sk_cachedtestkeytestkey123456";
		const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
		const cachedRow = {
			id: "key-3",
			keyHash,
			keyPrefix: rawKey.slice(0, 12),
			active: true,
			expiresAt: null
		};
		
		mockRedis.get.mockResolvedValue(JSON.stringify(cachedRow));
		mockDb.limitMock.mockResolvedValueOnce([]);

		const result = await validateApiKey(rawKey);
		expect(result).toBeNull();
		expect(mockDb.select).toHaveBeenCalledOnce();
		expect(mockRedis.get).not.toHaveBeenCalled();
	});
});
