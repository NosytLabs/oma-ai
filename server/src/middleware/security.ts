import type { Context, Next } from "hono";
import type { OmaEnv } from "../types.js";

export async function securityHeaders(c: Context<OmaEnv>, next: Next) {
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("X-XSS-Protection", "0");
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https:; frame-src 'none'; object-src 'none'"
  );
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  await next();
}