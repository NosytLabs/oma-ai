import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Hardened Content-Security-Policy + Cross-Origin-Opener-Policy
const CSP = [
  "default-src 'self';",
  "script-src 'self' 'unsafe-eval' https:;",
  "style-src 'self' 'unsafe-inline' https:;",
  "img-src 'self' data: blob: https:;",
  "connect-src 'self' https: ws:;",
  "font-src 'self' https:;",
  "object-src 'none';",
  "base-uri 'self';",
  "form-action 'self';"
].join(' ');

export function middleware(request: NextRequest) {
  const response = NextResponse.next();
  // Add CSP header unless already set
  response.headers.set('Content-Security-Policy', CSP);
  // Add Cross-Origin-Opener-Policy
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  // Optionally: Cross-Origin-Embedder-Policy for stricter isolation
  response.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  return response;
}

export const config = {
  matcher: ["/((?!_next|_private|\.[^/]+$).*)"],
};
