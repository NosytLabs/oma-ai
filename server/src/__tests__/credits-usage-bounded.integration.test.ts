/**
 * Integration test for the /v1/credits/usage route — bounds verification.
 *
 * The route previously fetched ALL usage_records for a user (no LIMIT) and
 * aggregated in JS. For a heavy user this was O(history). The fix uses
 * SQL `GROUP BY model` to push the aggregation to the DB.
 *
 * This test verifies the BOUND by counting the response entries:
 *  - Even if a user has 10,000 usage records spanning 1,000 models,
 *  - The response should still have at most ~1,000 entries.
 *  - The total `totalUsageCents` should equal the sum across all records.
 *
 * Hits the LIVE DB. Requires a real test user with usage history.
 * The admin user has usage history from prior dev work.
 *
 * SKIPPED if env var `OMA_RUN_INTEGRATION` is not "1".
 */
import { describe, it, expect, beforeAll } from 'vitest'

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
const CSRF_URL = `${BASE}/auth/csrf-token`
const LOGIN_URL = `${BASE}/auth/account/login`
const USAGE_URL = `${BASE}/v1/credits/usage`

const TEST_ACCOUNT = process.env.OMA_TEST_ACCOUNT || '1234567890123456'

let sessionCookie: string | null = null
let csrfCookie: string | null = null

beforeAll(async () => {
  if (process.env.OMA_RUN_INTEGRATION !== '1') return
  // Get CSRF token
  const csrfRes = await fetch(CSRF_URL, { method: 'GET' })
  const csrfSetCookie = csrfRes.headers.get('set-cookie') || ''
  const csrfBody = (await csrfRes.json()) as { token: string }
  const csrfToken = csrfBody.token
  csrfCookie = csrfSetCookie.split(';')[0]
  // Login
  const loginRes = await fetch(LOGIN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-csrf-token': csrfToken,
      cookie: csrfCookie,
    },
    body: JSON.stringify({ accountNumber: TEST_ACCOUNT }),
  })
  expect(loginRes.status).toBe(200)
  const setCookie = loginRes.headers.get('set-cookie') || ''
  sessionCookie = setCookie.split(';')[0]
}, 30000)

describe('/v1/credits/usage — bounded query', () => {
  it('returns at most one entry per unique model (bounded by GROUP BY)', async () => {
    if (process.env.OMA_RUN_INTEGRATION !== '1') {
      console.log('Skipping — set OMA_RUN_INTEGRATION=1 to run against live DB')
      return
    }
    const res = await fetch(USAGE_URL, {
      method: 'GET',
      headers: { cookie: sessionCookie || '' },
    })
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      usageByModel: Array<{ model: string; totalCents: number; requestCount: number }>
      totalUsageCents: number
    }
    // Sanity: each model appears at most once
    const models = body.usageByModel.map((u) => u.model)
    expect(new Set(models).size).toBe(models.length)
    // Sanity: totalUsageCents is the sum of per-model totals
    const sum = body.usageByModel.reduce((acc, u) => acc + u.totalCents, 0)
    expect(body.totalUsageCents).toBeCloseTo(sum, 5)
  }, 30000)
})
