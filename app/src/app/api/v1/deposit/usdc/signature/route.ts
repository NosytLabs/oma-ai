import { NextResponse } from 'next/server'
import { readSessionOrReject, proxyPost } from '../_proxy'

export const runtime = 'nodejs'

export async function POST(req: Request): Promise<Response> {
  const session = await readSessionOrReject()
  if (!session) {
    return NextResponse.json(
      { error: { message: 'Not authenticated', type: 'authentication_error' } },
      { status: 401 },
    )
  }
  let body: unknown = {}
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  return proxyPost('/v1/deposit/usdc/signature', body, session)
}
