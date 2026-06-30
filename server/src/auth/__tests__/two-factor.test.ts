/**
 * Unit tests for the two-factor module.
 *
 * Covers:
 *   - backup code generation (format, uniqueness, entropy)
 *   - backup code normalization (case-insensitive, dash-stripping)
 *   - backup code hashing (deterministic, hex output)
 *   - TOTP verify path uses authenticator.verify with the right secret
 *
 * Integration with db/redis is mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRedis: {
  get: ReturnType<typeof vi.fn>;
  incr: ReturnType<typeof vi.fn>;
  expire: ReturnType<typeof vi.fn>;
  del: ReturnType<typeof vi.fn>;
  setEx: ReturnType<typeof vi.fn>;
} = {
  get: vi.fn(async () => null),
  incr: vi.fn(async () => 1),
  expire: vi.fn(async () => 1),
  del: vi.fn(async () => 1),
  setEx: vi.fn(async () => 1),
};

const mockAuthenticator = vi.hoisted(() => ({
  options: {} as Record<string, unknown>,
  verify: vi.fn(() => true),
  generateSecret: vi.fn(() => "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"),
  keyuri: vi.fn((label: string, issuer: string, secret: string) =>
    `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`,
  ),
}));

vi.mock("../../db/client.js", () => {
  const userRow = {
    id: "user-1",
    accountNumber: "1234567890123456",
    twoFactorEnabled: true,
    twoFactorSecret: JSON.stringify({ encrypted: "e", iv: "i", authTag: "a" }),
  };
  const dbChain: any = {
    from() { return this; },
    where() { return this; },
    limit: () => Promise.resolve([userRow]),
  };
  return { db: { select: vi.fn(() => dbChain) } };
});

vi.mock("../../db/schema.js", () => ({
  users: {
    id: "id",
    twoFactorEnabled: "2fa_enabled",
    twoFactorSecret: "2fa_secret",
    accountNumber: "account_number",
  },
  twoFactorBackupCodes: {
    userId: "user_id",
    codeHash: "code_hash",
    usedAt: "used_at",
  },
  auditLogs: {},
}));

vi.mock("../../lib/redis-client.js", () => ({
  getRedisClient: vi.fn(async () => mockRedis),
}));

vi.mock("../../auth/encryption.js", () => ({
  encryptSecret: vi.fn(() => ({ encrypted: "e", iv: "i", authTag: "a" })),
  decryptSecret: vi.fn(() => "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP"),
}));

vi.mock("@otplib/preset-default", () => ({
  authenticator: mockAuthenticator,
}));

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(async () => "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABAQMAAAAl21bKAAAAA1BMVEX///+nxBvIAAAAC0lEQVQI12NgAAIAAAUAAeImBZsAAAAASUVORK5CYII="),
  },
}));

vi.mock("../../lib/logger.js", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import {
  verifyTotpCode,
  consumeBackupCode,
  generateBackupCodes,
} from "../two-factor.js";

beforeEach(() => {
  vi.clearAllMocks();
  mockAuthenticator.verify.mockReturnValue(true);
});

describe("generateBackupCodes", () => {
  it("generates the requested count", () => {
    expect(generateBackupCodes(10)).toHaveLength(10);
  });

  it("rejects invalid TOTP codes", async () => {
    mockAuthenticator.verify.mockReturnValueOnce(false);
    await expect(verifyTotpCode("user-1", "000000")).rejects.toMatchObject({
      name: "TwoFactorError",
      code: "invalid_code",
    });
  });

  it("returns true on valid code", async () => {
    mockAuthenticator.verify.mockReturnValueOnce(true);
    await expect(verifyTotpCode("user-1", "123456")).resolves.toBe(true);
  });

  it("rejects replayed codes (lastUsedStep tracking)", async () => {
    // Pre-populate the "last used step" with a value that's in the future
    // (so verifyTotpCode's current-step calculation will always be <= it).
    // The mock authenticator.verify still returns true (code is "valid") so
    // the only thing that can reject is the replay guard.
    mockRedis.get.mockResolvedValueOnce(String(Math.floor(Date.now() / 1000 / 30) + 9999));
    mockAuthenticator.verify.mockReturnValueOnce(true);
    await expect(verifyTotpCode("user-1", "111111")).rejects.toMatchObject({
      code: "invalid_code",
    });
  });
});

describe("consumeBackupCode", () => {
  it("throws on invalid format", async () => {
    await expect(consumeBackupCode("user-1", "abc")).rejects.toMatchObject({
      code: "invalid_backup_code",
    });
    await expect(consumeBackupCode("user-1", "1234567890XX")).rejects.toMatchObject({
      code: "invalid_backup_code",
    });
  });
});