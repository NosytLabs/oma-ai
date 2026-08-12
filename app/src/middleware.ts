import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Paths that may enter demo/preview mode via `?demo=1`. */
const DEMO_PATH_PREFIXES = [
	"/dashboard",
	"/settings",
	"/chat",
	"/deposit",
	"/api-keys",
];

function wantsDemo(request: NextRequest): boolean {
	if (request.nextUrl.searchParams.get("demo") !== "1") return false;
	const path = request.nextUrl.pathname;
	return DEMO_PATH_PREFIXES.some(
		(p) => path === p || path.startsWith(`${p}/`),
	);
}

/**
 * Edge middleware — Next requires this file to be named `middleware.ts`
 * (src/middleware.ts). Security headers + demo-tour cookies.
 */
export function middleware(request: NextRequest) {
	const response = NextResponse.next();
	// CSP is owned by next.config.ts headers() (generateContentSecurityPolicy).
	response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
	response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");

	// Demo tour: HttpOnly server guard + public client flag for useAuth /
	// server demoModeGuard (mutations stay blocked).
	if (wantsDemo(request)) {
		const secure = request.nextUrl.protocol === "https:";
		response.cookies.set("oma-demo", "1", {
			httpOnly: true,
			sameSite: "lax",
			path: "/",
			secure,
			maxAge: 60 * 60 * 4,
		});
		response.cookies.set("oma-demo-public", "1", {
			httpOnly: false,
			sameSite: "lax",
			path: "/",
			secure,
			maxAge: 60 * 60 * 4,
		});
	}

	return response;
}

export const config = {
	matcher: ["/((?!_next|_private|\\.[^/]+$).*)"],
};
