import { NextResponse } from 'next/server'
import { API_URL } from '@/lib/api/admin-config'

// Inlined admin auth helpers (previously imported from src/app/api/admin/auth.ts,
// which was removed in the I-HIGH-1 admin-route cleanup). The /api/admin/* paths
// now proxy straight to the backend; this v1 endpoint is the lone consumer of
// the helpers so inlining here keeps the surface minimal.
function getAdminAuthorization(request: Request) {
  const authorization = request.headers.get('Authorization')
  if (authorization) return authorization
  const cookieHeader = request.headers.get('cookie')
  if (!cookieHeader) return null
  const sessionCookie = cookieHeader
    .split(';')
    .map(part => part.trim())
    .find(part => part.startsWith('oma_session='))
  if (!sessionCookie) return null
  const sessionToken = sessionCookie.slice('oma_session='.length)
  return sessionToken ? `Bearer ${sessionToken}` : null
}

function unauthorizedAdminResponse() {
  return NextResponse.json({ error: { message: 'Authentication required' } }, { status: 401 })
}

/**
 * Surplus Minimum Discount Routing — operator-internal floor policy.
 *
 * Public GET returns the current operator default and the allowed range,
 * so agents and dashboards can render a meaningful guardrail without
 * having to authenticate.
 *
 * POST requires admin auth and forwards the new floor to the backend
 * fee_config table, alongside the existing Venice markup. The Surplus
 * procurement path will refuse to sign an x402 payment for any offer
 * below the configured floor.
 */

const DEFAULT_FLOOR_PCT = 50
const RANGE = { min: 0, max: 95 } as const

function clampFloor(value: unknown): number | null {
  const n = typeof value === 'string' ? parseInt(value, 10) : typeof value === 'number' ? value : NaN
  if (!Number.isFinite(n)) return null
  if (n < RANGE.min || n > RANGE.max) return null
  return Math.round(n)
}

export async function GET() {
  try {
    let currentFloor = DEFAULT_FLOOR_PCT
    try {
      const res = await fetch(`${API_URL}/v1/admin/config/fees`, {
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        const fromServer = data?.config?.procurement?.minDiscountPct
        if (typeof fromServer === 'number' && fromServer >= RANGE.min && fromServer <= RANGE.max) {
          currentFloor = fromServer
        }
      }
    } catch {
      // Backend offline or schema not yet provisioned — return the
      // safe default rather than a 5xx. The dashboard shows "schematic"
      // in that case and the operator knows to re-save from /admin/fees.
    }

    return NextResponse.json(
      {
        service: 'OMA AI',
        feature: 'surplus_min_discount_routing',
        version: '1.0.0',
        min_discount_pct: currentFloor,
        range_pct: [RANGE.min, RANGE.max],
        scope: 'surplus_intelligence_only',
        empty_result: {
          http_status: 422,
          code: 'discount_floor_violation',
        },
        docs: 'https://oma-ai.com/docs#pricing',
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, must-revalidate',
        },
      },
    )
  } catch (err) {
    console.error('Get surplus min discount error:', err)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 },
    )
  }
}

export async function POST(request: Request) {
  try {
    const authorization = getAdminAuthorization(request)
    if (!authorization) {
      return unauthorizedAdminResponse()
    }

    const body = await request.json().catch(() => ({}))
    const floor = clampFloor(body?.min_discount_pct ?? body?.config?.procurement?.minDiscountPct)
    if (floor === null) {
      return NextResponse.json(
        {
          error: {
            message: `min_discount_pct must be an integer between ${RANGE.min} and ${RANGE.max}.`,
            code: 'min_discount_out_of_range',
          },
        },
        { status: 400 },
      )
    }

    const upstream = await fetch(`${API_URL}/v1/admin/config/fees`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authorization,
      },
      body: JSON.stringify({
        config: {
          procurement: {
            minDiscountPct: floor,
            minDiscountRangePct: [RANGE.min, RANGE.max],
          },
        },
      }),
    })

    const data = await upstream.json().catch(() => ({}))
    if (!upstream.ok) {
      return NextResponse.json(data, { status: upstream.status })
    }

    return NextResponse.json({
      min_discount_pct: floor,
      range_pct: [RANGE.min, RANGE.max],
      saved: true,
    })
  } catch (err) {
    console.error('Set surplus min discount error:', err)
    return NextResponse.json(
      { error: { message: 'Internal server error' } },
      { status: 500 },
    )
  }
}
