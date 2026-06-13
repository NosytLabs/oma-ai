import { NextResponse } from 'next/server'
import { readSessionOrReject, proxyGet } from '../../usdc/_proxy'

export const runtime = 'nodejs'

export async function GET(): Promise<Response> {
  const session = await readSessionOrReject()
  if (!session) {
    return NextResponse.json(
      { error: { message: 'Not authenticated', type: 'authentication_error' } },
      { status: 401 },
    )
  }
  return proxyGet('/v1/deposit/houdini/tokens', session)
}
