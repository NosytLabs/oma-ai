
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

const RATE_LIMIT_WINDOW = 60 * 1000
const RATE_LIMIT_MAX = 60

function getRateLimitKey(request: Request, keyOverride?: string): string {
  if (keyOverride) return `user:${keyOverride}`
  const url = new URL(request.url)
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : url.hostname
  return ip
}

export type RateLimitResult = {
  allowed: boolean
  headers: Record<string, string>
}

function makeHeaders(count: number, resetTime: number): Record<string, string> {
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(RATE_LIMIT_MAX),
    'X-RateLimit-Remaining': String(Math.max(0, RATE_LIMIT_MAX - count)),
    'X-RateLimit-Reset': String(Math.ceil(resetTime / 1000)),
  }
  const retryAfter = Math.max(1, Math.ceil((resetTime - Date.now()) / 1000))
  if (retryAfter > 0) {
    headers['Retry-After'] = String(retryAfter)
  }
  return headers
}

export function checkRateLimit(request: Request, identifier: string): RateLimitResult {
  const key = getRateLimitKey(request, identifier)
  const now = Date.now()

  const record = rateLimitMap.get(key)

  if (!record || now > record.resetTime) {
    const resetTime = now + RATE_LIMIT_WINDOW
    rateLimitMap.set(key, { count: 1, resetTime })
    return { allowed: true, headers: makeHeaders(1, resetTime) }
  }

  if (record.count >= RATE_LIMIT_MAX) {
    return { allowed: false, headers: makeHeaders(record.count, record.resetTime) }
  }

  record.count++
  return { allowed: true, headers: makeHeaders(record.count, record.resetTime) }
}

setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}, RATE_LIMIT_WINDOW)
