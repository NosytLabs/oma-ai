import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { deriveEncryptionKey, encryptSecret, decryptSecret } from '../encryption.js'

const TEST_KEY = 'test-encryption-key-32chr-long-here!'

beforeAll(() => {
  process.env.ENCRYPTION_KEY = TEST_KEY
})

afterAll(() => {
  delete process.env.ENCRYPTION_KEY
})

describe('deriveEncryptionKey', () => {
  it('returns consistent buffer for same master key', () => {
    const a = deriveEncryptionKey('hello')
    const b = deriveEncryptionKey('hello')
    expect(a.equals(b)).toBe(true)
  })

  it('returns different buffers for different master keys', () => {
    const a = deriveEncryptionKey('key-one')
    const b = deriveEncryptionKey('key-two')
    expect(a.equals(b)).toBe(false)
  })

  it('returns a 32-byte buffer', () => {
    const key = deriveEncryptionKey('anything')
    expect(key).toBeInstanceOf(Buffer)
    expect(key.length).toBe(32)
  })
})

describe('encryptSecret / decryptSecret', () => {
  it('encrypts and decrypts a plaintext round-trip', () => {
    const original = 'my-super-secret-api-key'
    const { encrypted, iv, authTag } = encryptSecret(original)
    const decrypted = decryptSecret(encrypted, iv, authTag)
    expect(decrypted).toBe(original)
  })

  it('handles empty string', () => {
    const { encrypted, iv, authTag } = encryptSecret('')
    const decrypted = decryptSecret(encrypted, iv, authTag)
    expect(decrypted).toBe('')
  })

  it('handles unicode and special characters', () => {
    const original = 'héllo wörld 🔐 秘密 \n\t\r\u00a9'
    const { encrypted, iv, authTag } = encryptSecret(original)
    const decrypted = decryptSecret(encrypted, iv, authTag)
    expect(decrypted).toBe(original)
  })

  it('handles long strings', () => {
    const original = 'a'.repeat(10000)
    const { encrypted, iv, authTag } = encryptSecret(original)
    const decrypted = decryptSecret(encrypted, iv, authTag)
    expect(decrypted).toBe(original)
  })

  it('produces unique IVs for the same plaintext', () => {
    const plaintext = 'same-data'
    const a = encryptSecret(plaintext)
    const b = encryptSecret(plaintext)
    expect(a.iv).not.toBe(b.iv)
  })

  it('throws when auth tag is tampered', () => {
    const { encrypted, iv } = encryptSecret('hello')
    const tamperedTag = '00'.repeat(16)
    expect(() => decryptSecret(encrypted, iv, tamperedTag)).toThrow()
  })

  it('throws when decrypting with wrong key', () => {
    const { encrypted, iv, authTag } = encryptSecret('secret')
    process.env.ENCRYPTION_KEY = 'different-key-that-is-also-32-chars!!'
    expect(() => decryptSecret(encrypted, iv, authTag)).toThrow()
    process.env.ENCRYPTION_KEY = TEST_KEY
  })
})
