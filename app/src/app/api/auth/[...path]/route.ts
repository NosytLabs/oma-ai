import { NextRequest, NextResponse } from 'next/server';
import { buildAuthEndpoint, resolveAuthBackend } from '@/lib/auth-proxy';
import { applyTrustedProxyHeaders } from '@/lib/api/proxy-headers';
import { proxyResponse } from '@/lib/api/proxy-response';
import { BodyTooLargeError, readTextWithinLimit } from '@/lib/read-body';

const AUTH_MAX_BODY_BYTES = 64 * 1024;
const AUTH_TIMEOUT_MS = 30_000;

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
	let endpoint: string;
	try {
		endpoint = buildAuthEndpoint(base, path);
	} catch {
		return NextResponse.json({ error: 'Invalid auth path' }, { status: 400 });
	}
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
			get: (name) => headers[name] ?? null,
			keys: () => Object.keys(headers),
			set: (name, value) => {
				headers[name] = value;
			},
			delete: (name) => {
				delete headers[name];
			},
		});

		const signal = AbortSignal.any([req.signal, AbortSignal.timeout(AUTH_TIMEOUT_MS)]);
		try {
				signal.throwIfAborted();
				let body;
				if (!['GET', 'HEAD'].includes(req.method)) {
					try {
						body = await readTextWithinLimit(req, AUTH_MAX_BODY_BYTES, signal);
					} catch (err) {
						if (err instanceof BodyTooLargeError) {
							return NextResponse.json({ error: 'Auth request too large' }, { status: 413 });
						}
						if (signal.aborted) throw err;
						return NextResponse.json({ error: 'Invalid auth request' }, { status: 400 });
					}
					// The decoded/re-encoded body owns its length, not the incoming header.
					delete headers['content-length'];
				}
				const resp = await fetch(url, {
						method: req.method,
						headers,
						body,
						redirect: 'manual',
						signal,
				});

				return proxyResponse(resp);
		} catch {
				if (req.signal.aborted) {
					return NextResponse.json({ error: 'Auth request canceled' }, { status: 499 });
				}
				if (signal.aborted) {
					return NextResponse.json({ error: 'Auth request timed out' }, { status: 504 });
				}
				return NextResponse.json(
						{ error: 'Auth backend unavailable' },
						{ status: 502 }
				);
		}
}
