import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Hono } from 'hono'

// ---------------------------------------------------------------------------
// MOCKS — keep these BEFORE the route import (vi.mock is hoisted)
// ---------------------------------------------------------------------------

// Mock the DLQ settlement-retry library that the route depends on.
vi.mock('../lib/settlement-retry.js', () => ({
  retrySettlementById: vi.fn(),
  discardSettlementFromDlq: vi.fn(),
  processSettlementDLQ: vi.fn(),
  getSettlementDlqStatus: vi.fn(),
}))

vi.mock('../lib/dlq.js', () => ({
  getSettlementDlqEntries: vi.fn().mockResolvedValue([]),
  getSettlementDlqLength: vi.fn().mockResolvedValue(0),
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

import { dlqRoutes } from '../routes/admin/dlq.js'
import {
  retrySettlementById,
  discardSettlementFromDlq,
  processSettlementDLQ,
  getSettlementDlqStatus,
} from '../lib/settlement-retry.js'

// ---------------------------------------------------------------------------
// FIXTURES
// ---------------------------------------------------------------------------

const VALID_UUID = '11111111-1111-4111-8111-111111111111'

const validRetryResult = {
  orderId: VALID_UUID,
  success: true,
  attempts: 1,
  permanentlyFailed: false,
}

const validProcessResults = [
  {
    orderId: VALID_UUID,
    success: true,
    attempts: 1,
    permanentlyFailed: false,
  },
]

// ---------------------------------------------------------------------------
// TEST SUITE — 9 cases for M5 zod validation of admin DLQ POST endpoints
// ---------------------------------------------------------------------------

describe('Admin DLQ POST — zod validation (M5)', () => {
  let app: Hono

  beforeEach(() => {
    vi.clearAllMocks()
    app = new Hono()
    app.route('/', dlqRoutes)
  })

  // ----- /v1/admin/dlq/settlements/:id/retry --------------------------------

  describe('POST /v1/admin/dlq/settlements/:id/retry', () => {
    it('accepts a valid UUID and returns 200 on success', async () => {
      ;(retrySettlementById as ReturnType<typeof vi.fn>).mockResolvedValue(validRetryResult)

      const res = await app.request(`/v1/admin/dlq/settlements/${VALID_UUID}/retry`, {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.orderId).toBe(VALID_UUID)
      expect(body.success).toBe(true)
    })

    it('returns 400 when id is not a valid UUID', async () => {
      const res = await app.request('/v1/admin/dlq/settlements/not-a-uuid/retry', {
        method: 'POST',
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.type).toBe('invalid_request_error')
      expect(body.error.issues).toBeDefined()
      // Should NOT call the retry handler on validation failure
      expect(retrySettlementById).not.toHaveBeenCalled()
    })

    it('returns 400 when id is missing (empty path segment)', async () => {
      // Empty string id is not a valid uuid
      const res = await app.request('/v1/admin/dlq/settlements//retry', {
        method: 'POST',
      })

      // The route either 404s (no match) or 400s; both are correct rejections.
      expect([400, 404]).toContain(res.status)
      expect(retrySettlementById).not.toHaveBeenCalled()
    })
  })

  // ----- /v1/admin/dlq/settlements/:id/discard ------------------------------

  describe('POST /v1/admin/dlq/settlements/:id/discard', () => {
    it('accepts a valid UUID and returns 200 on success', async () => {
      ;(discardSettlementFromDlq as ReturnType<typeof vi.fn>).mockResolvedValue(true)

      const res = await app.request(`/v1/admin/dlq/settlements/${VALID_UUID}/discard`, {
        method: 'POST',
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.orderId).toBe(VALID_UUID)
      expect(body.discarded).toBe(true)
    })

    it('returns 400 when id is not a valid UUID', async () => {
      const res = await app.request('/v1/admin/dlq/settlements/12345/discard', {
        method: 'POST',
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.type).toBe('invalid_request_error')
      expect(body.error.issues).toBeDefined()
      expect(discardSettlementFromDlq).not.toHaveBeenCalled()
    })

    it('returns 404 when settlement is not found', async () => {
      ;(discardSettlementFromDlq as ReturnType<typeof vi.fn>).mockResolvedValue(false)

      const res = await app.request(`/v1/admin/dlq/settlements/${VALID_UUID}/discard`, {
        method: 'POST',
      })

      expect(res.status).toBe(404)
      const body = await res.json()
      expect(body.error.type).toBe('not_found')
    })
  })

  // ----- /v1/admin/dlq/settlements/process ----------------------------------

  describe('POST /v1/admin/dlq/settlements/process', () => {
    it('accepts an empty body and returns 200 with processed count', async () => {
      ;(processSettlementDLQ as ReturnType<typeof vi.fn>).mockResolvedValue(validProcessResults)
      ;(getSettlementDlqStatus as ReturnType<typeof vi.fn>).mockResolvedValue({
        total: 1,
        retryable: 1,
        permanentlyFailed: 0,
      })

      const res = await app.request('/v1/admin/dlq/settlements/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '',
      })

      expect(res.status).toBe(200)
      const body = await res.json()
      expect(body.processed).toBe(1)
      expect(body.results).toHaveLength(1)
    })

    it('accepts an empty JSON body and returns 200', async () => {
      ;(processSettlementDLQ as ReturnType<typeof vi.fn>).mockResolvedValue([])

      const res = await app.request('/v1/admin/dlq/settlements/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      expect(res.status).toBe(200)
    })

    it('returns 400 when body has invalid id (not a UUID)', async () => {
      const res = await app.request('/v1/admin/dlq/settlements/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'bad-id' }),
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.type).toBe('invalid_request_error')
      expect(body.error.issues).toBeDefined()
      expect(processSettlementDLQ).not.toHaveBeenCalled()
    })

    it('returns 400 when force is not a boolean', async () => {
      const res = await app.request('/v1/admin/dlq/settlements/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: 'yes' }),
      })

      expect(res.status).toBe(400)
      const body = await res.json()
      expect(body.error.type).toBe('invalid_request_error')
      expect(processSettlementDLQ).not.toHaveBeenCalled()
    })
  })
})
