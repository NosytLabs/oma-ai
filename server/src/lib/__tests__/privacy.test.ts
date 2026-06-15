/**
 * V6 #10 — minimal smoke test for redactPii.
 * Ponytail: 2 cases, not 10. Covers key redaction, value-shape detection
 * (private keys, mnemonics), address passthrough, recursion on nested
 * objects and arrays. If you find yourself adding more cases, that's a
 * smell — extract a property-based test instead.
 */
import { describe, it, expect } from 'vitest'
import { redactPii, REDACTED_VALUE } from '../privacy.js'

const PK_64 = '0x' + 'a'.repeat(64)
const ADDR_40 = '0x' + 'b'.repeat(40)
const MNEMONIC_12 =
  'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about'

describe('redactPii', () => {
  it('redacts sensitive keys, value-shaped secrets, and recurses; keeps addresses', () => {
    const input = {
      model: 'claude-opus-4-7',
      stream: false,
      apiKey: 'sk-test-should-disappear',
      authorization: 'Bearer eyJ.should-disappear',
      password: 'hunter2',
      seedPhrase: MNEMONIC_12,
      nested: {
        walletPrivateKey: PK_64,
        userEmail: 'alice@example.com',
        token: 'tok_abc',
        contents: [
          { role: 'user', content: 'hello' },
          { role: 'assistant', content: 'hi' },
        ],
        deepArray: [
          { api_key: PK_64, addr: ADDR_40, msg: 'safe text' },
        ],
      },
      sender: ADDR_40,
      safeText: 'just a normal log message',
    }

    const out = redactPii(input) as Record<string, unknown>
    const nested = out.nested as Record<string, unknown>
    const deepItem = (nested.deepArray as Array<Record<string, unknown>>)[0]

    // Key-based redaction (case-insensitive, includes nested)
    expect(out.apiKey).toBe(REDACTED_VALUE)
    expect(out.authorization).toBe(REDACTED_VALUE)
    expect(out.password).toBe(REDACTED_VALUE)
    expect(out.seedPhrase).toBe(REDACTED_VALUE)
    expect(nested.walletPrivateKey).toBe(REDACTED_VALUE)
    expect(nested.userEmail).toBe(REDACTED_VALUE)
    expect(nested.token).toBe(REDACTED_VALUE)

    // Recursion: arrays of objects get walked
    expect(deepItem.api_key).toBe(REDACTED_VALUE)

    // Value-shape detection: private key → REDACTED
    expect(deepItem.addr).toBe(ADDR_40) // address: kept

    // Non-PII string values pass through unchanged
    expect(out.model).toBe('claude-opus-4-7')
    expect(out.stream).toBe(false)
    expect(out.sender).toBe(ADDR_40) // top-level address: kept
    expect(out.safeText).toBe('just a normal log message')
    expect(deepItem.msg).toBe('safe text')

    // Original input must not be mutated
    expect(input.apiKey).toBe('sk-test-should-disappear')
    expect(input.nested).toBeDefined()
  })

  it('handles plain primitives, null, undefined, and empty containers', () => {
    expect(redactPii(null)).toBeNull()
    expect(redactPii(undefined)).toBeUndefined()
    expect(redactPii(42)).toBe(42)
    expect(redactPii('hello world')).toBe('hello world')
    expect(redactPii([])).toEqual([])
    expect(redactPii({})).toEqual({})
    // Mnemonic detection still fires on a bare string
    expect(redactPii(MNEMONIC_12)).toBe(REDACTED_VALUE)
  })
})
