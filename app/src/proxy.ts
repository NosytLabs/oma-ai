import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  // CSP is owned by next.config.ts headers() (generateContentSecurityPolicy)
  // — it includes 'unsafe-inline' for Next's inline bootstrap scripts. A
  // middleware-set CSP without 'unsafe-inline' overrides that and blanks
  // every page in production.
  // Add Cross-Origin-Opener-Policy
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  // Optionally: Cross-Origin-Embedder-Policy for stricter isolation
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  return response;
}

export const config = {
  matcher: ["/((?!_next|_private|\.[^/]+$).*)"],
};
