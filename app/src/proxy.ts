import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Paths that may enter demo/preview mode via `?demo=1`.
 *  Note: `/dashboard/api-keys` is a deep-link bookmark redirect
 *  (see `app/src/app/dashboard/api-keys/page.tsx`); the demo gate lives
 *  on `/dashboard` itself since that's where the API-keys tab actually
 *  renders. Including the dead route here would let stale `?demo=1`
 *  links set the demo cookie against a path that immediately 310s away. */
const DEMO_PATH_PREFIXES = [
	"/dashboard",
	"/settings",
	"/chat",
	"/deposit",
];

function wantsDemo(request: NextRequest): boolean {
	if (request.nextUrl.searchParams.get("demo") !== "1") return false;
	const path = request.nextUrl.pathname;
	return DEMO_PATH_PREFIXES.some(
		(p) => path === p || path.startsWith(`${p}/`),
	);
}

/**
 * Next 16 renamed the Edge middleware convention to `proxy` — the file must
 * be `src/proxy.ts` and export `proxy`. Behaviour is unchanged: security
 * headers (COOP/COEP) + demo-tour cookies.
 *
 * The `matcher` below is carried over verbatim from the old middleware.ts.
 */
export function proxy(request: NextRequest) {
	const response = NextResponse.next();
	// CSP is owned by next.config.ts headers() (generateContentSecurityPolicy).
	response.headers.set("Cross-Origin-Opener-Policy", "same-origin");
	response.headers.set("Cross-Origin-Embedder-Policy", "require-corp");

	const secure = request.nextUrl.protocol === "https:";
	const cookieBase = {
		path: "/",
		secure,
		sameSite: "lax" as const,
	};

	// Demo tour: HttpOnly server guard + public client flag for useAuth /
	// server demoModeGuard (mutations stay blocked).
	// Leaving ?demo=1 routes MUST clear cookies — otherwise free /chat is
	// stuck in "Demo mode is read-only" after a dashboard demo tour.
	if (wantsDemo(request)) {
		response.cookies.set("oma-demo", "1", {
			...cookieBase,
			httpOnly: true,
			maxAge: 60 * 60 * 4,
		});
		response.cookies.set("oma-demo-public", "1", {
			...cookieBase,
			httpOnly: false,
			maxAge: 60 * 60 * 4,
		});
	} else if (
		request.cookies.get("oma-demo")?.value === "1" ||
		request.cookies.get("oma-demo-public")?.value === "1"
	) {
		response.cookies.set("oma-demo", "", {
			...cookieBase,
			httpOnly: true,
			maxAge: 0,
		});
		response.cookies.set("oma-demo-public", "", {
			...cookieBase,
			httpOnly: false,
			maxAge: 0,
		});
	}

	return response;
}

export const config = {
	matcher: ["/((?!_next|_private|\\.[^/]+$).*)"],
};
