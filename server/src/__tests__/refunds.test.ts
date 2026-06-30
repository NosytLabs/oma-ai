import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

// ---------------------------------------------------------------------------
// MOCKS — keep these BEFORE the route import (vi.mock is hoisted)
// ---------------------------------------------------------------------------

// Mock the DB client with chainable methods used by the refunds route.
// The insert chain captures the .values() payload so the test mock can echo
// back the user's `reason` rather than hardcoding one.
vi.mock('../db/client.js', () => {
  const mDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockImplementation(function (this: any, payload: Record<string, unknown>) {
      // Capture payload so the chained .returning() can echo `reason` back.
      ;(this as any).__lastInsert = payload
      return this
    }),
    returning: vi.fn().mockImplementation(function (this: any) {
      const last = (this as any).__lastInsert ?? {}
      return Promise.resolve([{
        id: '11111111-1111-4111-8111-111111111111',
        reason: last.reason ?? 'requested_by_customer',
        status: 'pending',
        createdAt: new Date(),
      }])
    }),
  }
  return { db: mDb }
})

// Bypass any auth middleware (refunds route is auth-gated, but we test the
// validation that happens after the auth check, so we let all requests through).
vi.mock('../auth/middleware.js', () => ({
  sessionAuth: async (_c: any, next: any) => {
    // Set a fake userId on the context for downstream handlers
    _c.set('userId', 'user-test-id')
    await next()
  },
  bearerAuth: async (_c: any, next: any) => next(),
  requireAdmin: () => async (_c: any, next: any) => next(),
  requireTeamRole: () => async (_c: any, next: any) => next(),
  optionalAuth: async (_c: any, next: any) => next(),
}))

// Bypass rate-limit middleware — the route uses rateLimit({windowMs:60_000,
// maxRequests:10}) which trips when prior tests in the same vitest worker
// have incremented the same IP bucket. We test the zod validation, not the
// rate-limit; keep these concerns separate.
vi.mock('../middleware/rate-limit.js', () => ({
  rateLimit: () => async (_c: unknown, next: () => void) => next(),
  tokenBucket: () => async (_c: unknown, next: () => void) => next(),
  modelRateLimit: () => async (_c: unknown, next: () => void) => next(),
  burstRateLimit: () => async (_c: unknown, next: () => void) => next(),
  expressiveRateLimit: () => async (_c: unknown, next: () => void) => next(),
}))

vi.mock('../config.js', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-32-chars-minimum-aaaaaaaa',
    ADMIN_WALLET_ADDRESSES: '',
    RECEIPT_HMAC_SECRET: 'test-receipt-secret-32-chars-minimum-aaaa',
    CORS_ORIGIN: 'http://localhost:3000',
  },
}))

// ---------------------------------------------------------------------------
// IMPORTS — must come AFTER vi.mock calls
// ---------------------------------------------------------------------------

import { refundRoutes } from '../routes/refunds.js'
import { db } from '../db/client.js'

// ---------------------------------------------------------------------------
// FIXTURES
// ---------------------------------------------------------------------------

const VALID_DEPOSIT_ID = '11111111-1111-4111-8111-111111111111'

const validPayload = () => ({
  depositId: VALID_DEPOSIT_ID,
  reason: 'duplicate' as const,
})

/**
 * Configure the DB mocks to respond correctly per scenario.
 *
 * The refunds POST handler issues 1 DB call:
 *   1. select(deposits) → look up the deposit by id
 *
 * Note: the handler uses .where() chained twice (and,eq,eq) and then
 * calls .limit(1) which returns the array.
 */
function setupDbMocks(opts: { deposit?: Record<string, unknown> | null } = {}) {
  const { deposit = null } = opts
  vi.clearAllMocks()

  // Reset the chainable: .select().from().where().limit(1) → returns deposit array
  const chain: any = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
  }
  chain.limit.mockResolvedValue(deposit ? [deposit] : [])
  ;(db.select as any).mockReturnValue(chain)
}

// ---------------------------------------------------------------------------
// TEST SUITE — 6 cases for M5 zod validation of POST /v1/refunds/request
// ---------------------------------------------------------------------------

describe('Refunds POST /v1/refunds/request — zod validation (M5)', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/', refundRoutes)
  })

  // (a) Valid POST returns 200 with refund receipt
  it('(a) returns 200 with a valid payload (reason="duplicate")', async () => {
    setupDbMocks({
      deposit: {
        id: VALID_DEPOSIT_ID,
        userId: 'user-test-id',
        status: 'completed',
        creditsIssued: '100',
        createdAt: new Date(),
      },
    })

    const res = await app.request('/v1/refunds/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload()),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    // H-REFUND-1: refundId is now a UUID from the actual DB insert, not a
    // synthesized `refund_` string. The shape and downstream admin query
    // both work with the UUID.
    expect(body.refundId).toMatch(/^[0-9a-f-]{36}$/i)
    expect(body.depositId).toBe(VALID_DEPOSIT_ID)
    expect(body.reason).toBe('duplicate')
    expect(body.status).toBe('pending')
  })

  // (b) Missing depositId → 400
  it('(b) returns 400 when depositId is missing', async () => {
    setupDbMocks()

    const payload = { reason: 'duplicate' } as Record<string, unknown>

    const res = await app.request('/v1/refunds/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.type).toBe('invalid_request_error')
    expect(body.error.issues.fieldErrors.depositId).toBeDefined()
  })

  // (c) Bad uuid → 400
  it('(c) returns 400 when depositId is not a valid UUID', async () => {
    setupDbMocks()

    const payload = { ...validPayload(), depositId: 'not-a-uuid' }

    const res = await app.request('/v1/refunds/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.type).toBe('invalid_request_error')
    expect(body.error.issues.fieldErrors.depositId).toBeDefined()
  })

  // (d) Invalid reason enum → 400
  it('(d) returns 400 when reason is not in the allowed enum', async () => {
    setupDbMocks()

    const payload = { ...validPayload(), reason: 'invalid_reason_xyz' }

    const res = await app.request('/v1/refunds/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.type).toBe('invalid_request_error')
    expect(body.error.issues.fieldErrors.reason).toBeDefined()
  })

  // (e) reason is optional → 200
  it('(e) returns 200 when reason is omitted (optional field)', async () => {
    setupDbMocks({
      deposit: {
        id: VALID_DEPOSIT_ID,
        userId: 'user-test-id',
        status: 'completed',
        creditsIssued: '50',
        createdAt: new Date(),
      },
    })

    const payload = { depositId: VALID_DEPOSIT_ID }

    const res = await app.request('/v1/refunds/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    // H-REFUND-1: when reason is omitted, the DB stores the canonical
    // default "requested_by_customer" and the response echoes it back. The
    // previous "No reason provided" string was a UI fallback that never
    // reached the database, so admins saw no record.
    expect(body.reason).toBe('requested_by_customer')
  })

  // (f) Each allowed reason enum value works
  it('(f) accepts all four valid reason enum values', async () => {
    const validReasons = ['duplicate', 'fraudulent', 'requested_by_customer', 'service_issue']

    for (const reason of validReasons) {
      setupDbMocks({
        deposit: {
          id: VALID_DEPOSIT_ID,
          userId: 'user-test-id',
          status: 'completed',
          creditsIssued: '10',
          createdAt: new Date(),
        },
      })

      const res = await app.request('/v1/refunds/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ depositId: VALID_DEPOSIT_ID, reason }),
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.reason).toBe(reason)
    }
  })
})
