// 501 stubs for OpenAPI spec entries that have no working implementation.
//
// Audit 2026-06-15: OpenAPI spec declares 21 paths. The spec/code audit found
// path/method mismatches that were resolved by updating the spec to match the
// real handlers (see routes/openapi.ts for the path/method fixes).
//
// Two spec entries still have no handler at the spec path:
//   - /v1/api-keys (GET, POST) — the real handler is /keys (in routes/auth.ts).
//     Kept as a 501 here so the spec entry is not a 404; clients should use /keys.
//   - /v1/x402/proxy (POST) — kept as a 501 placeholder; no handler exists
//     for the proxy/chat/completions sub-path as of Solana/Houdini cleanup.
//     This top-level path is documented as 501 in the spec.
//
// ponytail: do NOT add a real implementation here. Full handlers are a separate
// task. The 501 body is the OpenAPI-standard error shape so clients can parse it.
import { Hono } from "hono";
import type { Context } from "hono";
import type { OmaEnv } from "../types.js";

export const missingRoutes = new Hono<OmaEnv>();

const stub = (reason: string) => (c: Context<OmaEnv>) =>
  c.json({ error: { message: reason, type: "not_implemented" } }, 501);

missingRoutes.get("/v1/api-keys", stub("Use /keys (mounted in routes/auth.ts) - /v1/api-keys is reserved for a future v2 API"));
missingRoutes.post("/v1/api-keys", stub("Use /keys (mounted in routes/auth.ts) - /v1/api-keys is reserved for a future v2 API"));
missingRoutes.post("/v1/x402/proxy", stub("Use /v1/x402/proxy/chat/completions for the x402 chat proxy; /v1/x402/proxy is a future direct-proxy placeholder"));
