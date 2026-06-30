import { describe, it, expect, vi } from "vitest";

// Must mock config before importing encryption so config.ENCRYPTION_KEY is controlled.
const ENCRYPTION_KEY = "test-encryption-key-32-chars-ok!";
vi.mock("../../config.js", () => ({
  config: { ENCRYPTION_KEY },
}));

const { encryptSecret, decryptSecret } = await import("../encryption.js");

describe("encryptSecret / decryptSecret", () => {
  it("encrypts and decrypts a plaintext round-trip", () => {
    const original = "my-super-secret-api-key";
    const { encrypted, iv, authTag } = encryptSecret(original);
    const decrypted = decryptSecret(encrypted, iv, authTag);
    expect(decrypted).toBe(original);
  });

  it("handles empty string", () => {
    const { encrypted, iv, authTag } = encryptSecret("");
    const decrypted = decryptSecret(encrypted, iv, authTag);
    expect(decrypted).toBe("");
  });

  it("handles unicode and special characters", () => {
    const original = "héllo wörld 🔐 秘密 \n\t\r\u00a9";
    const { encrypted, iv, authTag } = encryptSecret(original);
    const decrypted = decryptSecret(encrypted, iv, authTag);
    expect(decrypted).toBe(original);
  });

  it("handles long strings", () => {
    const original = "a".repeat(10000);
    const { encrypted, iv, authTag } = encryptSecret(original);
    const decrypted = decryptSecret(encrypted, iv, authTag);
    expect(decrypted).toBe(original);
  });

  it("produces unique IVs for the same plaintext", () => {
    const plaintext = "same-data";
    const a = encryptSecret(plaintext);
    const b = encryptSecret(plaintext);
    expect(a.iv).not.toBe(b.iv);
  });

  it("throws when auth tag is tampered", () => {
    const { encrypted, iv } = encryptSecret("hello");
    const tamperedTag = "00".repeat(16);
    expect(() => decryptSecret(encrypted, iv, tamperedTag)).toThrow();
  });

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const a = encryptSecret("secret");
    const b = encryptSecret("secret");
    expect(a.encrypted).not.toBe(b.encrypted);
  });
});
