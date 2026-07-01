import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";

const PROTECTED_PATHS = [
	"/dashboard",
	"/admin",
	"/settings",
	"/deposit",
	"/chat",
];
// C-C1: when this cookie is present, the user has opted into a 24h demo
// session. The middleware lets them through the protected-route gate so
// they can browse the dashboard with mock data. Demo mode is read-only.
const DEMO_COOKIE_NAME = "oma-demo";

const ISSUER = "oma-ai";
const AUDIENCE = "oma-ai-api";

function getSecret(): Uint8Array | null {
	const secret = process.env.JWT_SECRET;
	if (!secret || secret.length < 32) {
		return null;
	}
	return new TextEncoder().encode(secret);
}

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;

	// /playground was consolidated into /chat. Redirect old URLs so
	// existing links and bookmarks keep working.
	if (pathname === "/playground" || pathname.startsWith("/playground/")) {
		const target = pathname.replace(/^\/playground/, "/chat") || "/chat";
		const redirectUrl = new URL(target, request.url);
		request.nextUrl.searchParams.forEach((value, key) => {
			redirectUrl.searchParams.set(key, value);
		});
		return NextResponse.redirect(redirectUrl);
	}

	const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));
	if (!isProtected) return NextResponse.next();

	// C-C1 / C-4: opt-in demo mode. When an unauthenticated user lands on
	// /dashboard?demo=1, set the `oma-demo=1` cookie on the response and let
	// them through the protected-route gate. The wallet-provider reads the
	// cookie on the client and flips `isDemo` to true; the dashboard renders
	// mock data and gates all real backend calls on `!isDemo`. The cookie is
	// also set on the request so the same request can short-circuit below.
	//
	// This must run BEFORE the session check so users without a session can
	// still enter demo mode (that's the whole point).
	const wantsDemo = request.nextUrl.searchParams.get("demo") === "1";
	if (wantsDemo) {
		const res = NextResponse.next();
		res.cookies.set({
			name: DEMO_COOKIE_NAME,
			value: "1",
			maxAge: 60 * 60 * 24, // 24h
			path: "/",
			sameSite: "lax",
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
		});
		return res;
	}

	// C-C1: demo cookie is a read-only bypass for the protected-route gate.
	// The user can browse the dashboard with mock data; they cannot mutate
	// anything because all backend calls are gated on !isDemo in the
	// dashboard pages and on sessionAuth server-side.
	const hasDemo = request.cookies.get(DEMO_COOKIE_NAME)?.value === "1";
	if (hasDemo) return NextResponse.next();

	const session = request.cookies.get(SESSION_COOKIE_NAME)?.value;
	if (!session) {
		// B-C1: route the user to /login?next=<path> instead of /?next=...&auth=required.
		// The /login page already honors the `next` query param and will bounce
		// the user back to their intended destination once they authenticate.
		// This gives the user explicit context ("you're on /settings; sign in to
		// continue") instead of a generic landing-page redirect.
		const redirectUrl = new URL("/login", request.url);
		redirectUrl.searchParams.set("next", pathname);
		return NextResponse.redirect(redirectUrl);
	}

	const secret = getSecret();
	if (!secret) {
		if (process.env.NODE_ENV === "production") {
			console.error(
				"middleware: JWT_SECRET missing or too short; redirecting protected requests to /login",
			);
		}
		return NextResponse.redirect(new URL("/login", request.url));
	}

	try {
		// ponytail: H1 — pin HS256 explicitly + 5s clock skew. Without `algorithms`,
		// jose accepts any algorithm the token claims, which lets a token forged
		// with `alg: "none"` or `alg: "RS256"` slip past verification (CVE-class).
		await jwtVerify(session, secret, {
			issuer: ISSUER,
			audience: AUDIENCE,
			algorithms: ["HS256"],
			clockTolerance: 5,
		});
		return NextResponse.next();
	} catch {
		// Expired / invalid token — send the user to /login?next=<path> as well
		// so they see the same context-preserving redirect as the no-session case.
		const redirectUrl = new URL("/login", request.url);
		redirectUrl.searchParams.set("next", pathname);
		return NextResponse.redirect(redirectUrl);
	}
}

export const config = {
	matcher: [
		"/dashboard/:path*",
		"/admin/:path*",
		"/settings/:path*",
		"/deposit/:path*",
		"/chat/:path*",
		"/playground/:path*",
	],
};
