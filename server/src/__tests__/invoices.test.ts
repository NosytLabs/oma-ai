import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

// ---------------------------------------------------------------------------
// MOCKS — keep these BEFORE the route import (vi.mock is hoisted)
// ---------------------------------------------------------------------------

// Mock the DB client with chainable methods used by the invoices route.
// Route usage:
//   db.select().from(users).where(...).limit(1)             // user lookup
//   db.select({...}).from(invoices).orderBy(...).limit(1)   // last invoice
//   db.insert(invoices).values({...}).returning()           // create
vi.mock('../db/client', () => {
  const mDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
  }
  return { db: mDb }
})

// Bypass any auth middleware (invoices route itself is not auth-gated,
// but auth/middleware.ts is imported transitively via config and could
// process.exit on production env validation).
vi.mock('../auth/middleware', () => ({
  sessionAuth: async (_c: any, next: any) => next(),
  bearerAuth: async (_c: any, next: any) => next(),
  requireAdmin: () => async (_c: any, next: any) => next(),
  requireTeamRole: () => async (_c: any, next: any) => next(),
  optionalAuth: async (_c: any, next: any) => next(),
  initAuth: () => {},
}))

// Replace config with a no-op stub so middleware that imports it does not
// trigger NODE_ENV-based validation paths.
vi.mock('../config', () => ({
  config: {
    NODE_ENV: 'test',
    JWT_SECRET: 'test-secret-32-chars-minimum-aaaaaaaa',
    ADMIN_WALLET_ADDRESSES: '',
    RECEIPT_HMAC_SECRET: 'test-receipt-secret-32-chars-minimum-aaaa',
    CORS_ORIGIN: 'http://localhost:3000',
  },
}))

vi.mock('../middleware/rate-limit.js', () => ({
  rateLimit: () => async (_c: unknown, next: () => void) => next(),
}))

vi.mock('../middleware/timeout.js', () => ({
  timeout: () => async (_c: unknown, next: () => void) => next(),
}))

// ---------------------------------------------------------------------------
// IMPORTS — must come AFTER vi.mock calls
// ---------------------------------------------------------------------------

import { invoicesRoutes } from '../routes/admin/invoices.js'
import { db } from '../db/client.js'

// ---------------------------------------------------------------------------
// FIXTURES
// ---------------------------------------------------------------------------

const VALID_USER_ID = '11111111-1111-4111-8111-111111111111'
const VALID_DUE_DATE = '2026-12-31T23:59:59.000Z'

const VALID_LINE_ITEM = {
  description: 'API usage',
  quantity: 1,
  unitPrice: 100,
  total: 100,
}

const validPayload = () => ({
  userId: VALID_USER_ID,
  amount: 100,
  lineItems: [VALID_LINE_ITEM],
  dueDate: VALID_DUE_DATE,
})

/**
 * Configure the chainable DB mocks to respond correctly per scenario.
 *
 * The invoices POST handler issues up to 3 DB calls in this order:
 *   1. select(users)   → user existence check
 *   2. select(invoices) → get last invoice number
 *   3. insert(invoices) → create new invoice (only on 201 path)
 */
function setupDbMocks(opts: {
  userExists?: boolean
  lastInvoiceNumber?: string | null
  insertedInvoice?: Record<string, unknown>
} = {}) {
  const {
    userExists = true,
    lastInvoiceNumber = null,
    insertedInvoice = { id: 'inv-new', invoiceNumber: 'INV-2026-00001' },
  } = opts

  vi.clearAllMocks()

  // Build a chainable that resolves on .limit()
  const makeSelectChain = (resolvedValue: unknown) => {
    const chain: any = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
    }
    chain.limit.mockResolvedValue(resolvedValue)
    return chain
  }

  const userChain = makeSelectChain(userExists ? [{ id: VALID_USER_ID }] : [])
  const lastInvoiceChain = makeSelectChain(
    lastInvoiceNumber ? [{ invoiceNumber: lastInvoiceNumber }] : [],
  )

  let selectCallCount = 0
  ;(db.select as any).mockImplementation(() => {
    selectCallCount += 1
    if (selectCallCount === 1) return userChain
    return lastInvoiceChain
  })

  // Insert chain: .values(...).returning([...])
  const insertChain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([insertedInvoice]),
  }
  ;(db.insert as any).mockReturnValue(insertChain)
}

// ---------------------------------------------------------------------------
// TEST SUITE — 7 cases per SYNC-9 spec
// ---------------------------------------------------------------------------

describe('Admin Invoices POST /admin/invoices — zod validation (SYNC-9)', () => {
  let app: Hono

  beforeEach(() => {
    app = new Hono()
    app.route('/', invoicesRoutes)
  })

  // (a) Valid POST returns 201
  it('(a) returns 201 with a valid payload', async () => {
    setupDbMocks({ userExists: true, lastInvoiceNumber: null })

    const res = await app.request('/admin/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload()),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.invoice).toBeDefined()
    expect(db.insert).toHaveBeenCalled()
  })

  // (b) Missing field → 400
  it('(b) returns 400 when a required field is missing', async () => {
    setupDbMocks()

    // Build a payload object that intentionally omits userId to test
    // the zod required-field validation. The cast keeps TypeScript happy
    // without compromising test fidelity.
    const payload = {
      amount: 100,
      lineItems: [VALID_LINE_ITEM],
      dueDate: VALID_DUE_DATE,
    } as Record<string, unknown>

    const res = await app.request('/admin/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.type).toBe('invalid_request_error')
    expect(body.error.issues.fieldErrors.userId).toBeDefined()
    // Should NOT hit DB on validation failure
    expect(db.insert).not.toHaveBeenCalled()
  })

  // (c) Bad uuid → 400
  it('(c) returns 400 when userId is not a valid uuid', async () => {
    setupDbMocks()

    const payload = { ...validPayload(), userId: 'not-a-uuid' }

    const res = await app.request('/admin/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.type).toBe('invalid_request_error')
    expect(body.error.issues.fieldErrors.userId).toBeDefined()
    expect(db.insert).not.toHaveBeenCalled()
  })

  // (d) Non-numeric amount → 400
  it('(d) returns 400 when amount is not a number', async () => {
    setupDbMocks()

    const payload = { ...validPayload(), amount: 'one hundred' }

    const res = await app.request('/admin/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.type).toBe('invalid_request_error')
    expect(body.error.issues.fieldErrors.amount).toBeDefined()
    expect(db.insert).not.toHaveBeenCalled()
  })

  // (e) Empty lineItems → 400
  it('(e) returns 400 when lineItems is an empty array', async () => {
    setupDbMocks()

    const payload = { ...validPayload(), lineItems: [] }

    const res = await app.request('/admin/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.type).toBe('invalid_request_error')
    expect(body.error.issues.fieldErrors.lineItems).toBeDefined()
    expect(db.insert).not.toHaveBeenCalled()
  })

  // (f) Bad dueDate → 400
  it('(f) returns 400 when dueDate is not ISO datetime', async () => {
    setupDbMocks()

    const payload = { ...validPayload(), dueDate: 'tomorrow' }

    const res = await app.request('/admin/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.type).toBe('invalid_request_error')
    expect(body.error.issues.fieldErrors.dueDate).toBeDefined()
    expect(db.insert).not.toHaveBeenCalled()
  })

  // (g) Non-existent user → 404
  it('(g) returns 404 when the user does not exist', async () => {
    setupDbMocks({ userExists: false })

    const res = await app.request('/admin/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload()),
    })

    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.type).toBe('not_found')
    expect(body.error.message).toBe('User not found')
    // Should NOT insert when user is missing
    expect(db.insert).not.toHaveBeenCalled()
  })
})
