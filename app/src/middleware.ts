import { type NextRequest, NextResponse } from "next/server";

/**
 * /middleware.ts — lightweight URL and demo-mode middleware.
 *
 * Protected pages perform their auth check in the client with Better Auth,
 * while every data/API route remains protected by the backend session
 * middleware. Keeping the frontend middleware free of a server-to-server
 * auth request avoids a 2.5s backend timeout on every hard navigation and
 * prevents an unavailable API from turning a useful sign-in screen into a
 * 500 response.
 */

const DEMO_BYPASS_PATHS = ["/dashboard", "/settings", "/deposit"];

const DEMO_COOKIE_NAME = "oma-demo";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Demo mode opt-in: ?demo=1 on a client-gated page sets a read-only
  // cookie. The page still treats demo mode as read-only and the backend
  // continues to reject unauthenticated mutations.
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
  ],
};

export const runtime = "nodejs";
