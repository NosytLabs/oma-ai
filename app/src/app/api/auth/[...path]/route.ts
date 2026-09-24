import { NextRequest, NextResponse } from 'next/server';
import { buildAuthEndpoint, resolveAuthBackend } from '@/lib/auth-proxy';

/**
	* Proxy for Better Auth — handles all /api/auth/* requests, forwarding to the real backend.
	* This route keeps session cookies/headers so client and SSR flows both work.
	*
	* Configured from env:
	*  - NEXT_PUBLIC_AUTH_BASE_URL (preferred)
	*  - NEXT_PUBLIC_API_URL (fallback)
	*  - default: http://localhost:3001
	*/

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
	return proxyToAuth(req, { params });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
	return proxyToAuth(req, { params });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
	return proxyToAuth(req, { params });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
	return proxyToAuth(req, { params });
}

async function proxyToAuth(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
	const base = resolveAuthBackend();
	const resolvedParams = await params;
	const path = resolvedParams?.path ?? [];
	const endpoint = buildAuthEndpoint(base, path);
		const search = req.nextUrl.search ? req.nextUrl.search : '';
		const url = endpoint + search;

		// Build proxy request: method, body, headers, cookies
		const headers: Record<string, string> = {};
		req.headers.forEach((val, key) => {
			if (key === 'host') return; // never forward host
			headers[key] = val;
		});

		// Authenticate this hop to the backend — see lib/api/proxy-handler.ts.
		// The Neon Function refuses to trust a forwarded client IP from an
		// unauthenticated caller, so without this every visitor resolved to
		// Vercel's egress IP and shared one rate-limit bucket.
		const proxySecret = process.env.INTERNAL_PROXY_SECRET;
		if (proxySecret) {
			headers['x-oma-proxy-secret'] = proxySecret;
		}
		// Drop client-supplied forwarding headers; only Vercel's own value counts.
		delete headers['x-forwarded-for'];
		delete headers['x-vercel-forwarded-for'];
		delete headers['x-real-ip'];

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

				// Forward status + headers, but strip transfer-encoding metadata:
				// the backend gzips via hono/compress, and undici auto-decompresses
				// the body — forwarding `content-encoding: gzip` makes the browser
				// try to gunzip already-plain bytes (ERR_CONTENT_DECODING_FAILED).
				const proxyHeaders = new Headers(resp.headers);
				for (const h of ["content-encoding", "content-length", "transfer-encoding"]) {
						proxyHeaders.delete(h);
				}
				const proxyRes = new NextResponse(resp.body, {
						status: resp.status,
						headers: proxyHeaders,
				});

				// Set cookies from auth backend
				const setCookieHeader = resp.headers.get('set-cookie');
				if (setCookieHeader) {
						proxyRes.headers.set('set-cookie', setCookieHeader);
				}

				return proxyRes;
		} catch (e: unknown) {
				const errorMsg = e instanceof Error ? e.message : String(e);
				return NextResponse.json(
						{ error: 'Auth backend unavailable', detail: errorMsg },
						{ status: 502 }
				);
		}
}
