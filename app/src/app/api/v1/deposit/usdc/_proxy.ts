import { cookies } from 'next/headers'
import { DEFAULT_API_URL } from '@/lib/config'

/**
 * Server-side proxy helpers for /api/v1/deposit/usdc/*.
 *
 * The browser cannot read the `oma_session` cookie when it is HttpOnly, so the
 * client cannot forward the bearer token. These routes read the cookie
 * server-side and forward the request to the Hono backend with the
 * Authorization header attached.
 */

const UPSTREAM = DEFAULT_API_URL

export async function readSessionOrReject(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get('oma_session')?.value ?? null
}

export async function proxyPost(path: string, body: unknown, session: string): Promise<Response> {
  const upstream = await fetch(`${UPSTREAM}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session}`,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const text = await upstream.text()
  return new Response(text, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
    },
  })
}

export async function proxyGet(path: string, session: string): Promise<Response> {
  const upstream = await fetch(`${UPSTREAM}${path}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${session}`,
    },
    cache: 'no-store',
  })
  const text = await upstream.text()
  return new Response(text, {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
    },
  })
}
