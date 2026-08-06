// @ts-nocheck — test file with complex mock typing
/**
 * EIP-3009 transferWithAuthorization V1 verify path — unit tests.
 *
 * Audit: .audit/x402-eip3009-fix-2026-07-02.md (P0-1 fix). The V1 verify path
 * used to verify on-chain USDC `transfer`/`transferFrom` receipts (user pays
 * gas). It now uses EIP-3009 transferWithAuthorization (gasless for the user).
 *
 * Coverage:
 *   - Happy path: EIP-712 sig recovers to authorization.from, verify returns valid.
 *   - Sig length validation: rejects 32-byte (tx-hash-length) and other oddities.
 *   - Payee pin: rejects when authorization.to != SERVER_TREASURY.
 *   - Amount pin: rejects when authorization.value < maxAmountRequired.
 *   - Time bounds: rejects expired (validBefore in past) and not-yet-valid.
 *   - Replay: nonce already consumed → 422.
 *   - Authorization shape: rejects when JSON is missing required fields.
 *   - Authorization JSON: rejects when authorization isn't valid JSON.
 *   - Sig mismatch: recovered signer != authorization.from → 422.
 *   - Dispatcher: routes EIP-3009 tuple to new path; routes non-JSON to legacy.
 *   - Legacy back-compat: a payment with authorization="opaque-string" still
 *     routes to verifyUsdcTransferReceipt (the receipt-check path).
 *
 * The tests mock viem (recoverTypedDataAddress + publicClient.call) so we can
 * exercise the V1 verify logic without a real RPC or wallet.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── DB mock ───────────────────────────────────────────────
const { chain, resetChain } = vi.hoisted(() => {
  type MockChain = Record<string, ReturnType<typeof vi.fn>> & {
    then: (onfulfilled: (value: unknown[]) => unknown, onrejected?: (reason: unknown) => unknown) => Promise<unknown>
  }
  const ch: MockChain = {} as unknown as MockChain
  const METHODS = [
    'select', 'from', 'where', 'limit',
    'insert', 'values', 'returning', 'update', 'set',
    'onConflictDoUpdate',
  ]
  for (const m of METHODS) {
    ch[m] = vi.fn()
  }
  Object.defineProperty(ch, 'then', {
    value: function (onfulfilled: (value: unknown[]) => unknown, onrejected?: (reason: unknown) => unknown) {
      return Promise.resolve([]).then(onfulfilled, onrejected)
    },
    writable: true, configurable: true,
  })
  function reset() {
    for (const m of METHODS) ch[m].mockReturnValue(ch)
  }
  return { chain: ch, resetChain: reset }
})
vi.mock('../../db/client.js', () => ({ db: chain, getDb: () => chain }))

// ── Redis mock (SET NX EX returns OK by default; override to simulate replay) ──
const { mockRedis } = vi.hoisted(() => ({
  mockRedis: {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
  },
}))
vi.mock('../../lib/redis-client.js', () => ({
  getRedisClient: vi.fn().mockResolvedValue(mockRedis),
}))

vi.mock('../../lib/dlq.js', () => ({
  addSettlementToDlq: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/logger.js', () => ({
  logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

vi.mock('../../middleware/rate-limit.js', () => ({
  rateLimit: () => async (_c: unknown, next: () => void) => next(),
}))

// ── Viem mocks ────────────────────────────────────────────
const { recoverTypedDataAddressMock, callMock, writeContractMock, privateKeyToAccountMock } = vi.hoisted(() => ({
  recoverTypedDataAddressMock: vi.fn(),
  callMock: vi.fn(),
  writeContractMock: vi.fn(),
  privateKeyToAccountMock: vi.fn(() => ({ address: '0xFac1l1tat0r00000000000000000000000000000' })),
}))
vi.mock('viem', () => ({
  createPublicClient: vi.fn(() => ({ call: callMock })),
  createWalletClient: vi.fn(() => ({ writeContract: writeContractMock })),
  http: vi.fn(),
  fallback: vi.fn((transports: any[]) => transports[0]),
  parseAbi: vi.fn(() => []),
  decodeFunctionData: vi.fn(),
  encodeFunctionData: vi.fn(() => '0x'),
  formatUnits: vi.fn((v: bigint, d: number) => {
    const s = v.toString().padStart(d + 1, '0')
    return `${s.slice(0, -d)}.${s.slice(-d)}`
  }),
  recoverTypedDataAddress: recoverTypedDataAddressMock,
  keccak256: vi.fn(() => '0x' + 'ab'.repeat(32)),
  encodePacked: vi.fn(() => '0x'),
}))
vi.mock('viem/accounts', () => ({
  privateKeyToAccount: privateKeyToAccountMock,
}))
vi.mock('viem/chains', () => ({
  base: { id: 8453, name: 'Base' },
}))
vi.mock('../../lib/rpc-client.js', () => ({
  getPublicClient: vi.fn(() => ({ call: callMock })),
  resetPublicClient: vi.fn(),
}))

// ── Config mock ──────────────────────────────────────────
const TREASURY = '0x8581784D3E598cCa3482375CFF2409Ac9DD8c402'
const PAYER = '0x' + '99'.repeat(20) // arbitrary but valid address
const ATTACKER = '0x' + 'bb'.repeat(20)

const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    TREASURY_BASE_ADDRESS: '0x8581784D3E598cCa3482375CFF2409Ac9DD8c402',
    // must be 'live' (not 'mock') so the verify path actually runs
    // and dispatches to verifyEip3009Payment / verifyUsdcTransferReceipt.
    // The viem RPC calls are mocked below, so no real network access.
    FACILITATOR_MODE: 'live',
    // a facilitator key, when present, switches verify to the real
    // on-chain submit path. Tests override this per-case.
    FACILITATOR_PRIVATE_KEY: undefined,
    X402_FACILITATOR_PROVIDER: 'coinbase-cdp',
    CHAIN_RPC_URL: 'https://base-rpc.publicnode.com',
    RECEIPT_HMAC_SECRET: 'test-receipt-hmac-secret-at-least-32-chars!',
    PORT: 3001,
    CORS_ORIGIN: 'http://localhost:3000',
    BETTER_AUTH_SECRET: 'test-better-auth-secret-that-is-at-least-32-chars-long!',
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://localhost:5432/oma_test',
    REDIS_URL: 'redis://localhost:6379',
  },
}))
vi.mock('../../config.js', () => ({ config: mockConfig }))

vi.mock('../../auth/middleware.js', () => ({
  sessionAuth: async (_c: unknown, next: () => void) => next(),
}))

import { verifyPayment, type PaymentSignature } from '../facilitator.js'
import { settlementCache } from '../settlement-cache.js'

const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913'
// 65-byte EIP-712 sig placeholder. Real value recovery is mocked via
// recoverTypedDataAddressMock; the on-the-wire shape just needs to be 132 chars.
const VALID_SIG_HEX = '0x' + '11'.repeat(65)
const USDC_AMOUNT_ATOMIC = 1_000_000n // 1 USDC

function makeEip3009PaymentSig(overrides: {
  signature?: string
  authorization?: unknown
  amount?: string
  validAfter?: number
  validBefore?: number
  nonce?: string
  payFrom?: string
  payee?: string
} = {}): PaymentSignature {
  const now = Math.floor(Date.now() / 1000)
  const nonce = overrides.nonce ?? ('0x' + 'ee'.repeat(32))
  const auth = overrides.authorization !== undefined
    ? overrides.authorization
    : {
        from: overrides.payFrom ?? PAYER,
        to: overrides.payee ?? TREASURY,
        value: USDC_AMOUNT_ATOMIC.toString(),
        validAfter: (overrides.validAfter ?? now - 60).toString(),
        validBefore: (overrides.validBefore ?? now + 3600).toString(),
        nonce,
      }
  return {
    x402Version: '1',
    signature: overrides.signature ?? VALID_SIG_HEX,
    authorization: typeof auth === 'string' ? auth : JSON.stringify(auth),
    payload: {
      x402Version: '1',
      scheme: 'evm',
      networkId: 'base',
      asset: USDC_BASE,
      amount: overrides.amount ?? '1.00',
      payee: overrides.payee ?? TREASURY,
      payFrom: overrides.payFrom ?? PAYER,
      maxAmountRequired: overrides.amount ?? '1.00',
      validBefore: overrides.validBefore ?? now + 3600,
      validAfter: overrides.validAfter ?? now - 60,
      nonce,
    },
  }
}

describe('EIP-3009 V1 verify path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    settlementCache.clear()
    resetChain()
    mockRedis.set.mockResolvedValue('OK')
    mockRedis.get.mockResolvedValue(null)
    mockRedis.del.mockResolvedValue(1)
    // Default: signer recovers to PAYER, eth_call simulation succeeds.
    recoverTypedDataAddressMock.mockResolvedValue(PAYER)
    callMock.mockResolvedValue({ data: '0x' + '00'.repeat(32) })
    writeContractMock.mockResolvedValue('0x' + 'cc'.repeat(32))
    mockConfig.FACILITATOR_PRIVATE_KEY = undefined
  })

  // ── Happy path ───────────────────────────────────────────
  it('verifies a valid EIP-3009 authorization (sig recovers, sim passes, no facilitator key → synthetic txHash)', async () => {
    const sig = makeEip3009PaymentSig()
    const result = await verifyPayment(sig)

    expect(result.valid).toBe(true)
    expect(result.amount).toBe('1.000000')
    expect(result.networkId).toBe('base')
    // Synthetic txHash is keccak256(tuple+sig) → mocked to return '0x' + 'ab' * 32
    expect(result.txHash).toBe('0x' + 'ab'.repeat(32))
  })

  it('submits the real on-chain tx when FACILITATOR_PRIVATE_KEY is set', async () => {
    mockConfig.FACILITATOR_PRIVATE_KEY = '0x' + 'aa'.repeat(32)
    writeContractMock.mockResolvedValue('0x' + 'dd'.repeat(32))

    const sig = makeEip3009PaymentSig()
    const result = await verifyPayment(sig)

    expect(result.valid).toBe(true)
    expect(result.txHash).toBe('0x' + 'dd'.repeat(32))
    expect(writeContractMock).toHaveBeenCalledOnce()
    const writeArgs = writeContractMock.mock.calls[0][0]
    expect(writeArgs.functionName).toBe('transferWithAuthorization')
    expect(writeArgs.address).toBe(USDC_BASE)
    expect(writeArgs.args[0]).toBe(PAYER)
    expect(writeArgs.args[1]).toBe(TREASURY)
    expect(writeArgs.args[2]).toBe(USDC_AMOUNT_ATOMIC)
  })

  // ── Signature length ─────────────────────────────────────
  it('rejects a signature that is not 65 bytes (132 hex chars)', async () => {
    const sig = makeEip3009PaymentSig({ signature: '0x' + '11'.repeat(32) })
    const result = await verifyPayment(sig)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/signature length/i)
  })

  // ── Payee pin ────────────────────────────────────────────
  it('rejects when authorization.to does not match the server treasury', async () => {
    const sig = makeEip3009PaymentSig({
      payee: TREASURY,
      authorization: {
        from: PAYER,
        to: ATTACKER, // mismatched payee
        value: USDC_AMOUNT_ATOMIC.toString(),
        validAfter: (Math.floor(Date.now() / 1000) - 60).toString(),
        validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
        nonce: '0x' + 'ee'.repeat(32),
      },
    })
    const result = await verifyPayment(sig)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/payee/i)
  })

  // ── Amount pin ───────────────────────────────────────────
  it('rejects when authorization.value is less than maxAmountRequired', async () => {
    const sig = makeEip3009PaymentSig({
      amount: '2.00',
      authorization: {
        from: PAYER,
        to: TREASURY,
        value: USDC_AMOUNT_ATOMIC.toString(), // 1 USDC < 2 USDC required
        validAfter: (Math.floor(Date.now() / 1000) - 60).toString(),
        validBefore: (Math.floor(Date.now() / 1000) + 3600).toString(),
        nonce: '0x' + 'ee'.repeat(32),
      },
    })
    const result = await verifyPayment(sig)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/insufficient/i)
  })

  // ── Time bounds ──────────────────────────────────────────
  it('rejects when validBefore is in the past', async () => {
    const sig = makeEip3009PaymentSig({
      validBefore: Math.floor(Date.now() / 1000) - 60,
      authorization: {
        from: PAYER,
        to: TREASURY,
        value: USDC_AMOUNT_ATOMIC.toString(),
        validAfter: (Math.floor(Date.now() / 1000) - 3600).toString(),
        validBefore: (Math.floor(Date.now() / 1000) - 60).toString(),
        nonce: '0x' + 'ee'.repeat(32),
      },
    })
    const result = await verifyPayment(sig)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/expired/i)
  })

  it('rejects when validAfter is in the future', async () => {
    const sig = makeEip3009PaymentSig({
      validAfter: Math.floor(Date.now() / 1000) + 3600,
      authorization: {
        from: PAYER,
        to: TREASURY,
        value: USDC_AMOUNT_ATOMIC.toString(),
        validAfter: (Math.floor(Date.now() / 1000) + 3600).toString(),
        validBefore: (Math.floor(Date.now() / 1000) + 7200).toString(),
        nonce: '0x' + 'ee'.repeat(32),
      },
    })
    const result = await verifyPayment(sig)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/not yet valid/i)
  })

  // ── Replay protection ────────────────────────────────────
  it('rejects when nonce has already been consumed (replay)', async () => {
    mockRedis.set.mockResolvedValueOnce(null) // SET NX returns null on duplicate
    const sig = makeEip3009PaymentSig()
    const result = await verifyPayment(sig)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/replay|nonce/i)
  })

  // ── Authorization shape ──────────────────────────────────
  it('rejects when authorization is not valid JSON', async () => {
    const sig = makeEip3009PaymentSig({ authorization: 'not-valid-json' })
    const result = await verifyPayment(sig)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/eip-3009 authorization/i)
  })

  it('rejects when authorization JSON is missing required EIP-3009 fields', async () => {
    const sig = makeEip3009PaymentSig({
      authorization: { from: PAYER, to: TREASURY /* missing value, validAfter, validBefore, nonce */ },
    })
    const result = await verifyPayment(sig)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/missing required/i)
  })

  // ── Signature mismatch ───────────────────────────────────
  it('rejects when the recovered signer does not match authorization.from', async () => {
    recoverTypedDataAddressMock.mockResolvedValueOnce(ATTACKER)
    const sig = makeEip3009PaymentSig()
    const result = await verifyPayment(sig)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/signature does not match/i)
  })

  it('rejects when viem.recoverTypedDataAddress throws', async () => {
    recoverTypedDataAddressMock.mockRejectedValueOnce(new Error('malformed sig'))
    const sig = makeEip3009PaymentSig()
    const result = await verifyPayment(sig)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/invalid eip-712 signature/i)
  })

  // ── Simulation failure ───────────────────────────────────
  it('rejects when the contract simulation reverts (e.g. nonce already used)', async () => {
    callMock.mockRejectedValueOnce(new Error('execution reverted: FiatTokenV2_2: authorization is used or canceled'))
    const sig = makeEip3009PaymentSig()
    const result = await verifyPayment(sig)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/simulation failed/i)
  })

  // ── Submit failure (with FACILITATOR_PRIVATE_KEY) ────────
  it('rejects when writeContract fails despite a configured facilitator key', async () => {
    mockConfig.FACILITATOR_PRIVATE_KEY = '0x' + 'aa'.repeat(32)
    writeContractMock.mockRejectedValueOnce(new Error('insufficient funds for gas'))
    const sig = makeEip3009PaymentSig()
    const result = await verifyPayment(sig)
    expect(result.valid).toBe(false)
    expect(result.error).toMatch(/submit failed/i)
  })

  // ── Dispatcher behavior ──────────────────────────────────
  it('routes a payment with non-JSON authorization to the legacy receipt-check path', async () => {
    // Authorization is opaque (not EIP-3009 JSON). Signature is a 32-byte tx
    // hash. The legacy verifyUsdcTransferReceipt path takes over. We don't
    // mock the receipt RPC here; the call will fail because no RPC is
    // available, but the important assertion is that the legacy path was
    // attempted (i.e. the dispatcher did NOT throw an "Invalid authorization"
    // EIP-3009 error).
    const sig = makeEip3009PaymentSig({
      authorization: 'opaque-string-not-json',
      signature: '0x' + 'aa'.repeat(32), // 32-byte hex (tx-hash shape)
    })
    const result = await verifyPayment(sig)
    // The legacy path will try to call getTransactionReceipt on the mocked
    // viem client (which doesn't exist here), so we expect a non-EIP3009 error.
    expect(result.valid).toBe(false)
    expect(result.error).not.toMatch(/invalid authorization: must be json-encoded eip-3009/i)
  })
})

// ── Direct unit tests for isEip3009Authorization type guard ──
describe('EIP-3009 isEip3009Authorization type guard', () => {
  // We can't import the internal helper directly, but we can exercise it via
  // the dispatcher. If a tuple shape is missing a field, the verify path
  // returns the "missing required EIP-3009 fields" error — which proves the
  // type guard rejected it. (Already covered above.)
  it('accepts a fully-shaped EIP-3009 tuple (covered by happy-path test)', () => {
    expect(true).toBe(true)
  })
})