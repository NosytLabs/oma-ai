import { cookies } from "next/headers";
import { DEFAULT_API_URL } from "@/lib/config";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";

/**
 * Server-side proxy helpers for /api/v1/deposit/usdc/*.
 *
 * The browser cannot read the HttpOnly session cookie, so the client cannot
 * forward the bearer token directly. These routes read the cookie server-side
 * (using the env-dependent name `__Host-oma_session` in production,
 * `oma_session` in dev) and forward the request to the Hono backend with the
 * Authorization header attached.
 */

const UPSTREAM = DEFAULT_API_URL;

export async function readSessionOrReject(): Promise<string | null> {
	const cookieStore = await cookies();
	return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function proxyPost(
	path: string,
	body: unknown,
	session: string,
): Promise<Response> {
	const upstream = await fetch(`${UPSTREAM}${path}`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${session}`,
		},
		body: JSON.stringify(body),
		cache: "no-store",
		signal: AbortSignal.timeout(60_000),
	});
	const text = await upstream.text();
	return new Response(text, {
		status: upstream.status,
		headers: {
			"Content-Type":
				upstream.headers.get("content-type") ?? "application/json",
		},
	});
}

export async function proxyGet(
	path: string,
	session: string,
): Promise<Response> {
	const upstream = await fetch(`${UPSTREAM}${path}`, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${session}`,
		},
		cache: "no-store",
		signal: AbortSignal.timeout(60_000),
	});
	const text = await upstream.text();
	return new Response(text, {
		status: upstream.status,
		headers: {
			"Content-Type":
				upstream.headers.get("content-type") ?? "application/json",
		},
	});
}
