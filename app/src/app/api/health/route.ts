import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 5000)

    const res = await fetch(`${apiUrl}/health`, {
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (res.ok) {
      const data = await res.json()
      return NextResponse.json({
        status: data.status || 'online',
        version: data.version,
        service: data.service,
      })
    }

    return NextResponse.json({ status: 'error', message: 'Backend returned error' }, { status: 503 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Backend unavailable'
    return NextResponse.json({ status: 'offline', message }, { status: 503 })
  }
}