import { NextResponse } from 'next/server'

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

const RATE_LIMIT_WINDOW = 60 * 1000
const RATE_LIMIT_MAX = 60

function getRateLimitKey(request: Request): string {
  const url = new URL(request.url)
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : url.hostname
  return ip
}

function checkRateLimit(request: Request): boolean {
  const key = getRateLimitKey(request)
  const now = Date.now()
  
  const record = rateLimitMap.get(key)
  
  if (!record || now > record.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW })
    return true
  }
  
  if (record.count >= RATE_LIMIT_MAX) {
    return false
  }
  
  record.count++
  return true
}

setInterval(() => {
  const now = Date.now()
  for (const [key, record] of rateLimitMap.entries()) {
    if (now > record.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}, RATE_LIMIT_WINDOW)

export function rateLimitMiddleware(request: Request): NextResponse | null {
  if (!checkRateLimit(request)) {
    return NextResponse.json(
      { error: { message: 'Rate limit exceeded. Please try again later.' } },
      { status: 429 }
    )
  }
  return null
}