import { NextRequest, NextResponse } from 'next/server';
import { buildAuthEndpoint, resolveAuthBackend } from '@/lib/auth-proxy';
import { applyTrustedProxyHeaders } from '@/lib/api/proxy-headers';
import { proxyResponse } from '@/lib/api/proxy-response';

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

		// Same trust policy as the main proxy — shared so the two cannot drift.
		applyTrustedProxyHeaders({
			set: (name, value) => {
				headers[name] = value;
			},
			delete: (name) => {
				delete headers[name];
			},
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

				return proxyResponse(resp);
		} catch (e: unknown) {
				const errorMsg = e instanceof Error ? e.message : String(e);
				return NextResponse.json(
						{ error: 'Auth backend unavailable', detail: errorMsg },
						{ status: 502 }
				);
		}
}
