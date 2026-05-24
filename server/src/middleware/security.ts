import type { Context, Next } from "hono";

export async function securityHeaders(c: Context, next: Next) {
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "strict-origin-when-cross-origin");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("X-XSS-Protection", "0");
  c.header("Cross-Origin-Opener-Policy", "same-origin");
  c.header("Cross-Origin-Embedder-Policy", "credentialless");
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https://api.venice.ai https://api.mainnet-beta.solana.com https://api-partner.houdiniswap.com https://iris-api.circle.com https://li.quest wss://partner-api.houdiniswap.com; frame-src 'none'; object-src 'none'"
  );
  c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  await next();
}