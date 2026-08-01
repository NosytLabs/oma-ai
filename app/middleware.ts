import { type NextRequest, NextResponse } from "next/server";
import { getSessionViaBackend } from "@/lib/auth";

/**
 * /middleware.ts — Better Auth session gate.
 *
 * Behavior:
 *   - Better Auth manages the HttpOnly session cookie. The browser sends
 *     it on every same-origin request automatically.
 *   - We forward the request's Cookie header to Better Auth's
 *     `auth.api.getSession()` for a server-side validation.
 *   - For protected paths (dashboard, admin, settings, deposit), we
 *     redirect to /login?next=<path> when there is no valid session.
 *   - Better Auth's `next()` plugin refreshes cookies on server actions
 *     and route handlers, so the cookie is kept fresh for 7 days.
 *
 * The previous implementation used `jose` + an HS256 JWT issued by the
 * server. That path is removed — Better Auth's signed session cookie is
 * the only source of truth.
 */

const PROTECTED_PATHS = [
  "/dashboard",
  "/admin",
  "/settings",
  "/deposit",
];

const DEMO_BYPASS_PATHS = ["/dashboard", "/settings", "/deposit"];

const DEMO_COOKIE_NAME = "oma-demo";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Legacy redirects — keep them so existing links still resolve.
  if (pathname === "/playground" || pathname.startsWith("/playground/")) {
    const target = pathname.replace(/^\/playground/, "/chat") || "/chat";
    const redirectUrl = new URL(target, request.url);
    request.nextUrl.searchParams.forEach((value, key) => {
      redirectUrl.searchParams.set(key, value);
    });
    return NextResponse.redirect(redirectUrl);
  }
  if (pathname === "/image-generation" || pathname.startsWith("/image-generation/")) {
    const url = new URL("/chat", request.url);
    url.searchParams.set("mode", "image");
    return NextResponse.redirect(url, 308);
  }
  if (pathname === "/video-generation" || pathname.startsWith("/video-generation/")) {
    const url = new URL("/chat", request.url);
    url.searchParams.set("mode", "video");
    return NextResponse.redirect(url, 308);
  }
  if (pathname === "/credits") {
    return NextResponse.redirect(new URL("/dashboard/credits", request.url));
  }
  if (pathname === "/account") {
    return NextResponse.redirect(new URL("/settings", request.url));
  }
  if (pathname === "/swap" || pathname.startsWith("/swap/")) {
    return NextResponse.redirect(new URL("/deposit", request.url));
  }
  if (pathname.startsWith("/design")) {
    return new NextResponse(null, { status: 404 });
  }

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  if (!isProtected) return NextResponse.next();

  // Demo mode opt-in: ?demo=1 on a protected page sets a read-only cookie.
  const wantsDemo = request.nextUrl.searchParams.get("demo") === "1";
  const demoAllowed = DEMO_BYPASS_PATHS.some((p) => pathname.startsWith(p));
  if (wantsDemo && demoAllowed) {
    const res = NextResponse.next();
    const cookieOpts = {
      value: "1",
      maxAge: 60 * 60 * 24,
      path: "/",
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
    };
    res.cookies.set({ name: DEMO_COOKIE_NAME, httpOnly: true, ...cookieOpts });
    res.cookies.set({ name: `${DEMO_COOKIE_NAME}-public`, httpOnly: false, ...cookieOpts });
    return res;
  }

  const hasDemo = request.cookies.get(DEMO_COOKIE_NAME)?.value === "1";
  if (hasDemo && demoAllowed) return NextResponse.next();

  // Better Auth session check. We forward to the Hono backend's
  // /api/auth/get-session (POST) via HTTP — the local Better Auth instance
  // is configured without a DB and would return null from its in-memory
  // adapter. This keeps DB-state in one place.
  let session: { user?: { id?: string } } | null = null;
  try {
    session = await getSessionViaBackend(request);
  } catch (err) {
    console.warn("[middleware] session check failed", err);
  }

  if (!session?.user?.id) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/admin",
    "/admin/:path*",
    "/settings",
    "/settings/:path*",
    "/deposit",
    "/deposit/:path*",
    "/playground",
    "/playground/:path*",
    "/image-generation",
    "/image-generation/:path*",
    "/video-generation",
    "/video-generation/:path*",
    "/account",
    "/credits",
    "/swap",
    "/swap/:path*",
    "/design/:path*",
  ],
};

export const runtime = "nodejs";
