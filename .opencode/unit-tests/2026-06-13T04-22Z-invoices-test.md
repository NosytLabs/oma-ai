# Unit Test Record: invoices.test.ts

## Target File (the SUT being validated)
`server/src/routes/admin/invoices.ts` — POST `/admin/invoices` (zod schema for createInvoice)

## Test File (KEPT IN REPO, not deleted)
`server/src/__tests__/invoices.test.ts` — this is the production test, not an isolated TDD test

## Test Code

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

// ---------------------------------------------------------------------------
// MOCKS — keep these BEFORE the route import (vi.mock is hoisted)
// ---------------------------------------------------------------------------

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

vi.mock('../auth/middleware', () => ({
  sessionAuth: async (_c: any, next: any) => next(),
  bearerAuth: async (_c: any, next: any) => next(),
  requireAdmin: () => async (_c: any, next: any) => next(),
  requireTeamRole: () => async (_c: any, next: any) => next(),
  optionalAuth: async (_c: any, next: any) => next(),
}))

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

import { invoicesRoutes } from '../routes/admin/invoices.js'
import { db } from '../db/client.js'

const VALID_USER_ID = '11111111-1111-4111-8111-111111111111'
const VALID_DUE_DATE = '2026-12-31T23:59:59.000Z'
const VALID_LINE_ITEM = {
  description: 'API usage', quantity: 1, unitPrice: 100, total: 100,
}
const validPayload = () => ({
  userId: VALID_USER_ID, amount: 100,
  lineItems: [VALID_LINE_ITEM], dueDate: VALID_DUE_DATE,
})

function setupDbMocks(opts: { userExists?: boolean; lastInvoiceNumber?: string | null; insertedInvoice?: Record<string, unknown> } = {}) {
  const { userExists = true, lastInvoiceNumber = null, insertedInvoice = { id: 'inv-new', invoiceNumber: 'INV-2026-00001' } } = opts
  vi.clearAllMocks()
  const makeSelectChain = (resolvedValue: unknown) => {
    const chain: any = {
      from: vi.fn().mockReturnThis(), where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(), leftJoin: vi.fn().mockReturnThis(),
    }
    chain.limit.mockResolvedValue(resolvedValue)
    return chain
  }
  const userChain = makeSelectChain(userExists ? [{ id: VALID_USER_ID }] : [])
  const lastInvoiceChain = makeSelectChain(lastInvoiceNumber ? [{ invoiceNumber: lastInvoiceNumber }] : [])
  let selectCallCount = 0
  ;(db.select as any).mockImplementation(() => {
    selectCallCount += 1
    if (selectCallCount === 1) return userChain
    return lastInvoiceChain
  })
  const insertChain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([insertedInvoice]),
  }
  ;(db.insert as any).mockReturnValue(insertChain)
}

describe('Admin Invoices POST /admin/invoices — zod validation (SYNC-9)', () => {
  let app: Hono
  beforeEach(() => { app = new Hono(); app.route('/', invoicesRoutes) })

  it('(a) returns 201 with a valid payload', async () => {
    setupDbMocks({ userExists: true, lastInvoiceNumber: null })
    const res = await app.request('/admin/invoices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload()),
    })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.invoice).toBeDefined()
    expect(db.insert).toHaveBeenCalled()
  })

  it('(b) returns 400 when a required field is missing', async () => {
    setupDbMocks()
    const payload = validPayload()
    // @ts-expect-error — intentionally omit
    delete payload.userId
    const res = await app.request('/admin/invoices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.type).toBe('invalid_request_error')
    expect(body.error.issues.fieldErrors.userId).toBeDefined()
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('(c) returns 400 when userId is not a valid uuid', async () => {
    setupDbMocks()
    const res = await app.request('/admin/invoices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validPayload(), userId: 'not-a-uuid' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.issues.fieldErrors.userId).toBeDefined()
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('(d) returns 400 when amount is not a number', async () => {
    setupDbMocks()
    const res = await app.request('/admin/invoices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validPayload(), amount: 'one hundred' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.issues.fieldErrors.amount).toBeDefined()
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('(e) returns 400 when lineItems is an empty array', async () => {
    setupDbMocks()
    const res = await app.request('/admin/invoices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validPayload(), lineItems: [] }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.issues.fieldErrors.lineItems).toBeDefined()
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('(f) returns 400 when dueDate is not ISO datetime', async () => {
    setupDbMocks()
    const res = await app.request('/admin/invoices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validPayload(), dueDate: 'tomorrow' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.issues.fieldErrors.dueDate).toBeDefined()
    expect(db.insert).not.toHaveBeenCalled()
  })

  it('(g) returns 404 when the user does not exist', async () => {
    setupDbMocks({ userExists: false })
    const res = await app.request('/admin/invoices', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload()),
    })
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.type).toBe('not_found')
    expect(body.error.message).toBe('User not found')
    expect(db.insert).not.toHaveBeenCalled()
  })
})
```

## Test Result
- **Status**: pass
- **Session**: ses_invoices_zod_v2
- **Timestamp**: 2026-06-13T04:22:58Z
- **Tool evidence**:
  - `npx vitest run src/__tests__/invoices.test.ts` → ✓ 7 tests, 7 passed (485ms)
  - `npm test` (full server suite) → 56 files, 652/652 passed (was 645 before, +7)
  - `npm run typecheck` → exit 0
  - `npm run lint` → exit 0
  - `lsp_diagnostics` on `server/src/__tests__/invoices.test.ts` → "No diagnostics found. All clean!"

## Coverage Matrix (SYNC-9 spec)
| Case | Spec | Result |
|------|------|--------|
| (a) | Valid POST returns 201 | PASS — `res.status === 201`, body has `.invoice`, `db.insert` was called |
| (b) | Missing field → 400 | PASS — `res.status === 400`, `body.error.issues.fieldErrors.userId` defined, `db.insert` NOT called |
| (c) | Bad uuid → 400 | PASS — `res.status === 400`, `body.error.issues.fieldErrors.userId` defined, `db.insert` NOT called |
| (d) | Non-numeric amount → 400 | PASS — `res.status === 400`, `body.error.issues.fieldErrors.amount` defined, `db.insert` NOT called |
| (e) | Empty lineItems → 400 | PASS — `res.status === 400`, `body.error.issues.fieldErrors.lineItems` defined, `db.insert` NOT called |
| (f) | Bad dueDate → 400 | PASS — `res.status === 400`, `body.error.issues.fieldErrors.dueDate` defined, `db.insert` NOT called |
| (g) | Non-existent user → 404 | PASS — `res.status === 404`, `body.error.type === 'not_found'`, `body.error.message === 'User not found'`, `db.insert` NOT called |

## Notes
- The test is **kept in the repo** (`server/src/__tests__/invoices.test.ts`) — it is the production test, not an isolated TDD test. There is no separate test file to delete.
- Mock pattern follows the existing `admin.test.ts` style: chainable DB methods with `mockReturnThis()` and a `mockImplementation` to switch between user-lookup and last-invoice-lookup chains.
- Auth + config + middleware mocks are precautionary (the route itself does not call them, but `auth/middleware.ts` and `db/client.ts` have top-level imports that could otherwise trigger production-env validation).
- The 7 cases verify the zod schema defined in `invoices.ts:8-20` and the user-exists branch on line 38.
