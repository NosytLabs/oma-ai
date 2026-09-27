# OMA-AI dashboard + admin audit (2026-09-27, read-only)

## 1. /admin — client-only gate, real authorization is server-side
app/src/app/admin/layout.tsx:12-18 returns children verbatim — no session read, no role check. No middleware.ts; Next 16 renamed it to app/src/proxy.ts, which does no auth at all (only COOP/COEP headers and demo cookies). All gating lives in the client component (app/src/app/admin/page.tsx:106,153,172).
Role check is narrower than server: useAuth.ts:131 isAdmin: role==="admin" only. Server auth/middleware.ts:395-409 + routes/auth.ts:54-58 accept role OR admin-wallet allowlist. Wallet-gated operators are refused by the UI while fully authorized at the API. Fail-closed, but drifted.
Every DATA source is still properly server-gated:
 - /v1/ops/snapshot — sessionOrBearerAuth + requireAdmin() (server/src/routes/ops.ts:99)
 - /v1/admin/users — admin.ts:313-317
 - all 4 mutations — admin.ts:43-47,119-123,188-192,244-248
Gap: useAuth.ts:131 should mirror the server predicate (role OR wallet allowlist) so wallet admins can use the UI. Severity P2 (UX/auth drift, not a privilege escalation).
Status: OPEN

## 2. /dashboard — client-only, and leaks HTML
app/src/app/dashboard/layout.tsx:2 sets force-dynamic but performs no session check; page.tsx:252-255 gates in JS.
Demo path correctly neutralized client-side (canLoadDashboard) and server-side (server/src/middleware/demo-mode-guard.ts:53-63, reads only HttpOnly oma-demo cookie).
Backend data access is session-scoped (listApiKeys(userId,false), server/src/routes/auth.ts:268-270). No cross-user leak.
Severity: cosmetic to P3 (leaks layout skeleton to unauth users via SSR HTML, no data).
Status: OPEN (P3)

## 3. API keys mint/revoke
Ownership + CSRF both solid:
 - Origin/Referer guard registered (server/src/index.ts:407-416) for /v1/keys*, /v1/history, /sessions*.
 - originGuard rejects missing Origin on unsafe methods (middleware/origin-guard.ts:66-77).
 - Ownership enforced in SQL on read+revoke (server/src/auth/api-keys.ts:337-340): and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)). No IDOR.
Rate limits inconsistent:
 | POST /v1/keys | 10/min, failClosed:false (auth.ts:285)
 | POST /v1/keys/install | 30/min, fail-closed (:388)
 | POST /v1/keys/logout | 20/min (:421)
 | DELETE /v1/keys/:id | none (auth.ts:322)
 | GET /v1/keys | none (:268)
Also: the mint limiter is failClosed:false so a Redis outage removes key-mint throttling entirely. This is a deliberate fail-out-of-Redis-then-any-limit philosophy documented at index.ts:390-394 — flagged here because key mint is the most abuse-relevant endpoint.
Status: OPEN (P2)

## 4. Unauthenticated data exposure
Confirmed leak: GET /metrics is world-reachable and unauthenticated.
 - server/src/routes/metrics.ts:90 — no auth middleware
 - mounted as "public operational route" (server/src/index.ts:283-287)
 - the Next catch-all strips /api, so GET /api/metrics hits it from any browser
 - output is per-route counters keyed by method+path (metrics.ts:92-96). No PII, but full route inventory + traffic volume to an attacker.
Severity: P2 (information disclosure) + no rate-limit on that route either.
Status: OPEN

Other unauth routes reviewed: /api/health (static, no upstream), /api/v1/models (rate-limited), /api/v1/privacy (rate-limited), /api/rpc/[chain] (method+chain pinned+rate limit ok), /api/support (rate limit missing on app side — comment says "at the edge" but edge does not apply it → unauth outbound-relay mail-bombing vector. Severity P2). /v1/site-settings public by design for deposit rail status (no secrets).
Status: /api/support rate limit = OPEN (P2)

## CSRF gap (subset of backend B-8)
Admin mutations POST /v1/admin/* (admin.ts:43,119,188,244) + DELETE /account (routes/auth.ts:196) are NOT in the origin-guard loop at index.ts:408-414. Admin credit-adjust or suspend rides a same-site sibling cookie. SameSite=Lax is not a sufficient long-term control (origin-guard.ts:9-12 docstring says so).
Status: OPEN — one-line fix, do with B-8.

## Minor
 - UsersSection query lacks enabled: isAdmin (page.tsx:436-450) unlike the other two queries (page.tsx:120,128). Harmless today but inconsistent.
