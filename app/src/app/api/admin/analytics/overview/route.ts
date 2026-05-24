import { NextRequest, NextResponse } from 'next/server'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const period = searchParams.get('period') || '30d'

  try {
    const sessionToken = request.cookies.get('oma_session')?.value

    if (!sessionToken) {
      return NextResponse.json({ error: { message: 'Authentication required' } }, { status: 401 })
    }

    const response = await fetch(`${API_URL}/v1/admin/analytics/overview?period=${period}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(error, { status: response.status })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json(
      { error: { message: 'Failed to fetch analytics data' } },
      { status: 500 }
    )
  }
}