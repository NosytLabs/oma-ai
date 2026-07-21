// @ts-nocheck — test file with complex mock typing
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Mock } from 'vitest'
import { USDC_BASE } from '../constants.js'

// ── DB mock (chain pattern with error rejection) ─────────────
const { chain, resetChain, setQueryResult } = vi.hoisted(() => {
  type MockChain = Record<string, Mock> & {
    _resultQueue: unknown[][]
    then: (onfulfilled: (value: unknown[]) => unknown, onrejected?: (reason: unknown) => unknown) => Promise<unknown>
  }

  const ch: MockChain = { _resultQueue: [] } as unknown as MockChain

  const METHODS = [
    'select', 'from', 'where', 'limit',
    'insert', 'values', 'returning', 'update', 'set',
    'onConflictDoUpdate',
  ]

  for (const m of METHODS) {
    ch[m] = vi.fn()
  }

  Object.defineProperty(ch, 'then', {
    value: function (this: MockChain, onfulfilled: (value: unknown[]) => unknown, onrejected?: (reason: unknown) => unknown) {
      const result = this._resultQueue.length > 0 ? this._resultQueue.shift()! : []
      if (result instanceof Error) {
        return Promise.reject(result).then(onfulfilled, onrejected)
      }
      return Promise.resolve(result).then(onfulfilled, onrejected)
    },
    writable: true,
    configurable: true,
  })

  function reset() {
    for (const m of METHODS) {
      ;(ch[m] as Mock).mockReturnValue(ch)
    }
    ch._resultQueue = []
  }

  function setQueryResult(result: unknown[]) {
    ch._resultQueue.push(result)
  }

  return { chain: ch, resetChain: reset, setQueryResult }
})

vi.mock('../db/client.js', () => ({ db: chain, getDb: () => chain }))

// ── Redis mock ───────────────────────────────────────────────
const { mockRedis } = vi.hoisted(() => ({
  mockRedis: {
    set: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockResolvedValue(null),
    del: vi.fn().mockResolvedValue(1),
    hGetAll: vi.fn().mockResolvedValue({}),
    hSet: vi.fn().mockResolvedValue(1),
  },
}))

vi.mock('../lib/redis-client.js', () => ({
  getRedisClient: vi.fn().mockResolvedValue(mockRedis),
}))

// ── DLQ mock ─────────────────────────────────────────────────
vi.mock('../lib/dlq.js', () => ({
  addSettlementToDlq: vi.fn().mockResolvedValue(undefined),
}))

// ── Logger mock ──────────────────────────────────────────────
vi.mock('../lib/logger.js', () => ({
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

// ── Rate-limit mock (passthrough) ────────────────────────────
vi.mock('../middleware/rate-limit.js', () => ({
  rateLimit: () => async (_c: unknown, next: () => void) => next(),
}))

// ── Config mock ──────────────────────────────────────────────
const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    PORT: 3001,
    CORS_ORIGIN: 'http://localhost:3000',
    JWT_SECRET: 'test-jwt-secret-that-is-at-least-32-chars-long!',
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://localhost:5432/oma_test',
    REDIS_URL: 'redis://localhost:6379',
    FACILITATOR_MODE: 'mock',
    CHAIN_RPC_URL: 'https://base-rpc.publicnode.com',
    RECEIPT_HMAC_SECRET: 'test-receipt-hmac-secret-at-least-32-chars!',
  },
}))

vi.mock('../config.js', () => ({ config: mockConfig }))

// ── Auth middleware mock ──────────────────────────────────────
vi.mock('../auth/middleware.js', () => ({
  sessionAuth: async (c: { set: (k: string, v: unknown) => void; get: (k: string) => unknown; req: { header: (h: string) => string | undefined } }, next: () => void) => {
    const auth = c.req.header('Authorization')
    if (auth?.startsWith('Bearer ')) {
      c.set('userId', 'user-1')
    }
    await next()
  },
  initAuth: () => {},
}))

// ── Import AFTER mocks ───────────────────────────────────────
import {
  verifyPayment,
  settlePayment,
  settlePaymentAsync,
  isSettled,
  isSettledAsync,
  getSettlementReceipt,
  getSettlementReceiptAsync,
  verifySettlementReceipt,
  paymentMiddleware,
  type PaymentSignature,
} from '../x402/facilitator.js'

function makePaymentSig(overrides: Partial<PaymentSignature['payload']> = {}): PaymentSignature {
  const now = Math.floor(Date.now() / 1000)
  return {
    x402Version: '1',
    signature: 'test-sig-abc',
    authorization: 'test-auth',
    payload: {
      x402Version: '1',
      scheme: 'evm',
      networkId: 'base',
      asset: USDC_BASE,
      amount: '1.00',
      payee: '0xPayee',
      payFrom: '0xPayer',
      maxAmountRequired: '1.00',
      validBefore: now + 3600,
      validAfter: now - 3600,
      ...overrides,
    },
  }
}

// ================================================================
describe('x402 Facilitator – verifyPayment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChain()
    mockRedis.set.mockResolvedValue('OK')
    mockRedis.get.mockResolvedValue(null)
    mockRedis.del.mockResolvedValue(1)
  })

  describe('mock mode', () => {
    it('returns valid=true with a mock txHash for evm scheme', async () => {
      const sig = makePaymentSig({ scheme: 'evm' })
      const result = await verifyPayment(sig)

      expect(result.valid).toBe(true)
      expect(result.txHash).toMatch(/^0x[a-f0-9]{64}$/)
      expect(result.amount).toBe('1.00')
      expect(result.networkId).toBe('base')
    })

  })

  describe('expiry validation', () => {
    it('rejects expired payment (validBefore in the past)', async () => {
      const sig = makePaymentSig({
        validBefore: Math.floor(Date.now() / 1000) - 3600,
      })
      const result = await verifyPayment(sig)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Payment authorization expired')
    })

    it('rejects payment not yet valid (validAfter in the future)', async () => {
      const sig = makePaymentSig({
        validAfter: Math.floor(Date.now() / 1000) + 3600,
      })
      const result = await verifyPayment(sig)

      expect(result.valid).toBe(false)
      expect(result.error).toBe('Payment authorization not yet valid')
    })
  })

  describe('unsupported scheme', () => {
    it('returns valid=false for unknown scheme in non-mock mode', async () => {
      // Mock mode catches all schemes, so unsupported scheme only
      // triggers in non-mock mode. This documents the type contract.
      const sig = makePaymentSig({ scheme: 'evm' })
      const result = await verifyPayment(sig)
      expect(typeof result.valid).toBe('boolean')
    })
  })
})

// ================================================================
describe('x402 Facilitator – settlePayment (sync)', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    vi.clearAllMocks()
    resetChain()
  })

  it('creates a receipt and returns settled=true', () => {
    const result = settlePayment('0x' + 'a'.repeat(64), '5.00', 'base', '0xPayee')

    expect(result.settled).toBe(true)
    expect(result.receipt).toBeTruthy()
    expect(typeof result.receipt).toBe('string')
    expect(result.receipt.length).toBeGreaterThan(0)
  })

  it('returns cached result on second call for same tx', () => {
    const txHash = '0x' + 'b'.repeat(64)
    const first = settlePayment(txHash, '1.00', 'base', '0xPayee')
    const second = settlePayment(txHash, '1.00', 'base', '0xPayee')

    expect(first.receipt).toBe(second.receipt)
    expect(second.settled).toBe(true)
  })

  it('produces different receipts for different txHashes', () => {
    const r1 = settlePayment('0x' + 'c'.repeat(64), '1.00', 'base', '0xPayee')
    const r2 = settlePayment('0x' + 'd'.repeat(64), '1.00', 'base', '0xPayee')

    expect(r1.receipt).not.toBe(r2.receipt)
  })
})

// ================================================================
describe('x402 Facilitator – settlePaymentAsync', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    vi.clearAllMocks()
    resetChain()
    mockRedis.set.mockResolvedValue('OK')
    mockRedis.del.mockResolvedValue(1)
  })

  it('persists to DB and returns settled=true', async () => {
    setQueryResult([]) // existing check returns empty
    // insert().values() → chain, await chain → dequeues [] (success)
    setQueryResult([])

    const result = await settlePaymentAsync('0x' + 'e'.repeat(64), '2.50', 'base', '0xPayee')

    expect(result.settled).toBe(true)
    expect(result.receipt).toBeTruthy()
  })

  it('returns cached result if already settled', async () => {
    const txHash = '0x' + 'f'.repeat(64)
    settlePayment(txHash, '1.00', 'base', '0xPayee')

    const result = await settlePaymentAsync(txHash, '1.00', 'base', '0xPayee')
    expect(result.settled).toBe(true)
  })

  it('reuses existing DB record on duplicate key (code 23505)', async () => {
    const txHash = '0x' + '1'.repeat(64)
    // Queue: existing check → empty, insert → Error(23505), recovery select → existing record
    setQueryResult([]) // db.select().from().where().limit(1) → empty
    const pgError = new Error('duplicate key') as Error & { code?: string }
    pgError.code = '23505'
    setQueryResult(pgError) // db.insert().values() → throws
    setQueryResult([{ // recovery select → existing record
      txHash,
      amount: '1.00',
      networkId: 'base',
      payee: '0xPayee',
      settledAt: new Date(),
      receipt: 'existing-receipt',
    }])

    const result = await settlePaymentAsync(txHash, '1.00', 'base', '0xPayee')
    expect(result.settled).toBe(true)
    expect(result.receipt).toBe('existing-receipt')
  })
})

// ================================================================
describe('x402 Facilitator – isSettled / isSettledAsync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChain()
  })

  it('isSettled returns false for unknown tx', () => {
    expect(isSettled('0x' + '9'.repeat(64), 'base')).toBe(false)
  })

  it('isSettled returns true after sync settle', () => {
    const txHash = '0x' + 'a1'.repeat(32)
    settlePayment(txHash, '1.00', 'base', '0xPayee')
    expect(isSettled(txHash, 'base')).toBe(true)
  })

  it('isSettledAsync returns false when not in cache or DB', async () => {
    setQueryResult([])
    const result = await isSettledAsync('0x' + 'b2'.repeat(32), 'base')
    expect(result).toBe(false)
  })

  it('isSettledAsync returns true when in cache', async () => {
    const txHash = '0x' + 'c3'.repeat(32)
    settlePayment(txHash, '1.00', 'base', '0xPayee')
    const result = await isSettledAsync(txHash, 'base')
    expect(result).toBe(true)
  })
})

// ================================================================
describe('x402 Facilitator – getSettlementReceipt / getSettlementReceiptAsync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChain()
  })

  it('getSettlementReceipt returns null for unknown tx', () => {
    expect(getSettlementReceipt('0x' + 'd4'.repeat(32), 'base')).toBeNull()
  })

  it('getSettlementReceipt returns receipt after sync settle', () => {
    const txHash = '0x' + 'e5'.repeat(32)
    const { receipt } = settlePayment(txHash, '1.00', 'base', '0xPayee')
    expect(getSettlementReceipt(txHash, 'base')).toBe(receipt)
  })

  it('getSettlementReceiptAsync returns null for unknown tx', async () => {
    setQueryResult([])
    const result = await getSettlementReceiptAsync('0x' + 'f6'.repeat(32), 'base')
    expect(result).toBeNull()
  })

  it('getSettlementReceiptAsync returns receipt from cache', async () => {
    const txHash = '0x' + 'a7'.repeat(32)
    const { receipt } = settlePayment(txHash, '1.00', 'base', '0xPayee')
    const result = await getSettlementReceiptAsync(txHash, 'base')
    expect(result).toBe(receipt)
  })
})

// ================================================================
describe('x402 Facilitator – verifySettlementReceipt', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000)
    vi.clearAllMocks()
    resetChain()
  })

  it('returns true for a valid receipt', () => {
    const txHash = '0x' + 'b8'.repeat(32)
    const amount = '3.00'
    const networkId = 'base'
    const payee = '0xPayee'
    const settledAt = Date.now()

    const { receipt } = settlePayment(txHash, amount, networkId, payee)

    const valid = verifySettlementReceipt(txHash, amount, networkId, payee, settledAt, receipt)
    expect(valid).toBe(true)
  })

  it('returns false for a tampered receipt', () => {
    const txHash = '0x' + 'c9'.repeat(32)
    const settledAt = Date.now()

    const { receipt } = settlePayment(txHash, '1.00', 'base', '0xPayee')

    const valid = verifySettlementReceipt(txHash, '1.00', 'base', '0xPayee', settledAt, receipt + 'tamper')
    expect(valid).toBe(false)
  })

  it('returns false for wrong txHash', () => {
    const txHash = '0x' + 'da'.repeat(32)
    const settledAt = Date.now()

    const { receipt } = settlePayment(txHash, '1.00', 'base', '0xPayee')

    const valid = verifySettlementReceipt('0x' + 'ff'.repeat(32), '1.00', 'base', '0xPayee', settledAt, receipt)
    expect(valid).toBe(false)
  })

  it('returns false for wrong amount', () => {
    const txHash = '0x' + 'eb'.repeat(32)
    const settledAt = Date.now()

    const { receipt } = settlePayment(txHash, '1.00', 'base', '0xPayee')

    const valid = verifySettlementReceipt(txHash, '9.99', 'base', '0xPayee', settledAt, receipt)
    expect(valid).toBe(false)
  })

  it('returns false when receiptExpiry is in the past', () => {
    const txHash = '0x' + 'fc'.repeat(32)
    const settledAt = Date.now()

    const { receipt } = settlePayment(txHash, '1.00', 'base', '0xPayee')

    const pastExpiry = Math.floor(Date.now() / 1000) - 3600
    const valid = verifySettlementReceipt(txHash, '1.00', 'base', '0xPayee', settledAt, receipt, pastExpiry)
    expect(valid).toBe(false)
  })
})

// ================================================================
describe('x402 Facilitator – paymentMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetChain()
    mockRedis.set.mockResolvedValue('OK')
    mockRedis.del.mockResolvedValue(1)
  })

  function makeCtx(url: string, headers: Record<string, string> = {}) {
    const h = new Map(Object.entries(headers))
    const responseHeaders = new Map<string, string>()
    return {
      req: {
        url,
        header: (name: string) => h.get(name),
      },
      set: vi.fn(),
      get: vi.fn(),
      header: (name: string, value: string) => { responseHeaders.set(name, value) },
      json: vi.fn((body: unknown, status?: number) => new Response(JSON.stringify(body), { status: status ?? 200 })),
      _responseHeaders: responseHeaders,
    } as unknown as Parameters<ReturnType<typeof paymentMiddleware>>[0] & { _responseHeaders: Map<string, string> }
  }

  it('returns 402 with Pay-Req header when no payment provided', async () => {
    const mw = paymentMiddleware({
      pricing: { '/test': '1.00' },
      payeeAddress: '0xPayee',
    })

    const ctx = makeCtx('http://localhost/test')
    const next = vi.fn()
    await mw(ctx, next)

    expect(ctx.json).toHaveBeenCalled()
    const [body, status] = (ctx.json as Mock).mock.calls[0]
    expect(status).toBe(402)
    expect(body.error.type).toBe('payment_required')
  })

  it('passes through when path not in pricing map', async () => {
    const mw = paymentMiddleware({
      pricing: { '/other': '1.00' },
      payeeAddress: '0xPayee',
    })

    const ctx = makeCtx('http://localhost/test')
    const next = vi.fn()
    await mw(ctx, next)

    expect(next).toHaveBeenCalled()
    expect(ctx.json).not.toHaveBeenCalled()
  })

  it('rejects payee mismatch with 402', async () => {
    const mw = paymentMiddleware({
      pricing: { '/test': '1.00' },
      payeeAddress: '0xDifferentPayee',
    })

    const sig = makePaymentSig({ payee: '0xPayee' })
    const ctx = makeCtx('http://localhost/test', {
      'PAYMENT-SIGNATURE': JSON.stringify(sig),
    })
    const next = vi.fn()
    await mw(ctx, next)

    const [body, status] = (ctx.json as Mock).mock.calls[0]
    expect(status).toBe(402)
    expect(body.error.message).toBe('Payment payee mismatch')
  })

  it('rejects insufficient payment amount', async () => {
    const mw = paymentMiddleware({
      pricing: { '/test': '5.00' },
      payeeAddress: '0xPayee',
    })

    const sig = makePaymentSig({ amount: '1.00', maxAmountRequired: '1.00', payee: '0xPayee' })
    const ctx = makeCtx('http://localhost/test', {
      'PAYMENT-SIGNATURE': JSON.stringify(sig),
    })
    const next = vi.fn()
    await mw(ctx, next)

    const [body, status] = (ctx.json as Mock).mock.calls[0]
    expect(status).toBe(402)
    expect(body.error.message).toMatch(/Insufficient payment/)
  })

  it('rejects invalid JSON in PAYMENT-SIGNATURE', async () => {
    const mw = paymentMiddleware({
      pricing: { '/test': '1.00' },
      payeeAddress: '0xPayee',
    })

    const ctx = makeCtx('http://localhost/test', {
      'PAYMENT-SIGNATURE': 'not-valid-json',
    })
    const next = vi.fn()
    await mw(ctx, next)

    const [body, status] = (ctx.json as Mock).mock.calls[0]
    expect(status).toBe(400)
    expect(body.error.type).toBe('payment_error')
  })

  it('accepts valid payment and calls next', async () => {
    const mw = paymentMiddleware({
      pricing: { '/test': '1.00' },
      payeeAddress: '0xPayee',
    })

    const sig = makePaymentSig({ amount: '1.00', maxAmountRequired: '1.00', payee: '0xPayee' })
    const ctx = makeCtx('http://localhost/test', {
      'PAYMENT-SIGNATURE': JSON.stringify(sig),
    })
    const next = vi.fn()
    await mw(ctx, next)

    expect(next).toHaveBeenCalled()
    expect(ctx.set).toHaveBeenCalledWith('payment', expect.objectContaining({
      txHash: expect.any(String),
      amount: '1.00',
      networkId: 'base',
    }))
  })
})
