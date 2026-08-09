import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy for Better Auth — handles all /api/auth/* requests, forwarding to the real backend.
 * This route keeps session cookies/headers so client and SSR flows both work.
 *
 * Configured from env:
 *  - NEXT_PUBLIC_AUTH_BASE_URL (preferred)
 *  - NEXT_PUBLIC_API_URL (fallback)
 *  - default: http://localhost:3001
 */
const resolveAuthBackend = () => {
  return (
    process.env.NEXT_PUBLIC_AUTH_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    'http://localhost:3001'
  ).replace(/\/$/, '');
};

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyToAuth(req, params);
}

export async function POST(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyToAuth(req, params);
}

export async function DELETE(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyToAuth(req, params);
}

export async function PUT(req: NextRequest, { params }: { params: { path: string[] } }) {
  return proxyToAuth(req, params);
}

async function proxyToAuth(req: NextRequest, params: { path: string[] }) {
  const base = resolveAuthBackend();
  const path = params?.path ?? [];
  const endpoint = `${base}/${path.join('/')}`;
  const search = req.nextUrl.search ? req.nextUrl.search : '';
  const url = endpoint + search;

  // Build proxy request: method, body, headers, cookies
  const headers: Record<string, string> = {};
  req.headers.forEach((val, key) => {
    if (key === 'host') return; // never forward host
    headers[key] = val;
  });

  // Forward cookies manually
  if (req.headers.has('cookie')) {
    headers['cookie'] = req.headers.get('cookie')!;
  }

  let body = undefined;
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    body = await req.text();
  }

  try {
    const resp = await fetch(url, {
      method: req.method,
      headers,
      body,
      redirect: 'manual',
    });

    // Forward all status, content-type, etc.
    const proxyRes = new NextResponse(resp.body, {
      status: resp.status,
      headers: resp.headers,
    });

    // Set cookies from auth backend
    const setCookieHeader = resp.headers.get('set-cookie');
    if (setCookieHeader) {
      proxyRes.headers.set('set-cookie', setCookieHeader);
    }

    return proxyRes;
  } catch (e: any) {
    return NextResponse.json(
      { error: 'Auth backend unavailable', detail: e?.message || String(e) },
      { status: 502 }
    );
  }
}
