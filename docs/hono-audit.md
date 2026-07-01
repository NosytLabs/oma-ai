# Hono.js + Drizzle ORM Audit — OMA-AI Server

**Auditor:** `MiniMax-M3` (cloud reasoning) · **Date:** 2026-07-01
**Scope:** `/Users/tyson/Desktop/Code/OMA-AI/server/src` · **Read-only audit, no code changes**

---

## 1. Summary of Current Architecture

OMA-AI ships a single Hono v4 application (`/server/src/index.ts`, 251 lines) fronting a Neon Postgres database via the **`drizzle-orm/neon-http`** driver (`/server/src/db/client.ts:2`). The runtime is Node.js (`@hono/node-server`), session auth is cookie-based JWT, and rate-limiting is Redis-backed with two documented fail-modes (fail-closed for auth/inference, fail-open for session limits — `middleware/rate-limit.ts:1-17`).

**Strengths observed**

- Correlation-ID middleware (`index.ts:107-112`) runs first and is consumed by `onError` and `lib/api-errors.ts` for log correlation.
- Zod is used in ~44 routes for request validation. A shared `validationError()` formatter (`lib/validation.ts`) keeps the error envelope consistent across most routes.
- CORS validation is origin-by-origin with a `*`-rejection safeguard in production (`index.ts:78-81`).
- Security headers cover CSP, HSTS, XCTO, frame-ancestors (`middleware/security.ts`).
- `Promise.all` is correctly used in `routes/admin/users.ts:97` to parallelize four independent user-detail queries.
- `credit_batches` has well-designed partial composite indexes (`db/schema.ts:211-218`).
- Schema migrations moved to GH Actions for Neon scale-to-zero (`index.ts:54-77`).

---

## 2. Middleware Ordering Issues — `server/src/index.ts`

Current order (lines 105–191):

```text
1. app.use('*', correlationId)           // L107
2. app.use('*', compress())              // L115
3. app.use('*', securityHeaders)         // L117
4. (corsOptions object)                  // L119-144
5. app.use('*', cors(corsOptions))       // L146
6. app.route('/', health/ping/metrics/openapi/providersMeta/usage)  // L154-159
7. app.route('/', authRoutes, chatRoutes, ... 23 more routers)       // L161-187
8. app.notFound(...)                     // L189
9. app.onError(...)                      // L191
```

### 2.1 — `onError` and `notFound` registered **after** all routes

`notFound` (L189) and `onError` (L191) are registered as the **last two statements** in the setup. Hono applies them globally regardless of registration order, but the convention from the Hono docs is to register handlers near the top of the file, immediately after `cors`/`security`, so it is visually obvious which handler catches what. Moving them above the `app.route(...)` block improves readability and prevents accidental shadowing if a future module-level `app.onError` call is added during init.

### 2.2 — `securityHeaders` set **after** the `cors()` preflight chain

`cors()` is added on L146 but `securityHeaders` is on L117 — security headers will be appended to CORS preflight responses. This is functionally fine but the conventional order is `securityHeaders` first, then `cors`, so that even if a future middleware replaces response headers, security headers remain on the response. **Low priority.**

### 2.3 — No global request-body validation middleware

Every route calls `safeParse(await c.req.json())` individually (44 hits grepped). There is no `app.use('/v1/*', jsonBody({ limit: '64kb' }))` and no zValidator middleware from `@hono/zod-validator`. Consequences:

- A route that forgets `safeParse` returns the raw 500 from JSON parse errors.
- `Content-Type` and `Content-Length` are not enforced globally; a malformed JSON body in any route leaks through to handlers.
- The DRY cost: 44 copies of `if (!parsed.success) return c.json(validationError(parsed.error), 400)`.

**Suggested fix:** introduce a `jsonBodyWithLimit` middleware mounted via `app.use('/v1/*', ...)` and a `zValidator('json', schema)` factory on each router. This consolidates validation, sets `Content-Type: application/json` automatically, and returns consistent 400 envelopes.

### 2.4 — Missing global request-timeout middleware

`middleware/timeout.ts` exists but is **not** mounted in `index.ts`. Without it, a hung LLM provider upstream will hold a Hono worker indefinitely (resource exhaustion). Verify whether it should be global or only on inference routes.

### 2.5 — CORS callback has `try/catch` that swallows a `URL` parse error

`index.ts:129-135`: `try { new URL(allowed) } catch { /* ignore */ }`. The `ignore` means a malformed allow-listed origin silently falls through, then the loop returns `null` for that origin. Low risk because each entry is independently tested, but the comment missing the actual rationale is documentation debt.

---

## 3. Database Issues — Race Conditions, Indexes, Transactions

### 3.1 — CRITICAL — `.for('update')` used 16× with `drizzle-orm/neon-http` driver

The DB client uses `@neondatabase/serverless` via the **HTTP** transport (`db/client.ts:1-2`):

```ts
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
```

The Neon HTTP driver invokes a single HTTPS call to Neon's SQL gateway per query. It **does not support session-scoped row locks** — `SELECT ... FOR UPDATE` is silently dropped (no exception, no lock), because the gateway serves each request from a fresh pooler session.

Grep shows `.for('update')` / `.for("update")` in **16 locations** — most in **financial flows**:

| File | Line | Operation |
|---|---|---|
| `credits/deduction.ts` | 28, 68 | Lock active credit batches, lock `creditBalances` row before debit |
| `credits/preflight.ts` | 17 | Lock credit-batch rows for balance check |
| `credits/deposit.ts` | 79, 139, 189, 237, 269 | Lock deposit row before status transition |
| `credits/refunds.ts` | 57 | Lock `creditBalances` before refund |
| `routes/withdraw.ts` | 212 | Lock withdrawal row |
| `routes/deposit/houdini.ts` | 166 | Lock deposit row |
| `routes/admin/refunds.ts` | 129, 242 | Lock deposits + credit batches for grant/deny |

These locks are the **only line of defense** against double-spend and double-credit. Without them, two concurrent inference requests can both read `balanceCents = 100`, both decide they can spend 80, and both update to `20` (last-write-wins). For a paid AI inference API, this is a **revenue-integrity bug**.

**Recommended remediation options (in order of preference):**

1. **Switch the driver to `drizzle-orm/node-postgres` or `drizzle-orm/neon-serverless` (WebSocket)** for routes that use `.for('update')`. Both support real Postgres transactions and `SELECT ... FOR UPDATE`. The WebSocket variant (`@neondatabase/serverless`'s `Pool` export) is the smallest-change path.
2. **Replace locks with optimistic concurrency control** — add a `version` column to `credit_batches` and `credit_balances`, and do `WHERE id = $1 AND version = $2` on updates; on `0 rows affected`, retry.
3. **Move financial mutations to a Postgres `FUNCTION` / `RPC`** that executes the entire balance arithmetic in a single round-trip with `SELECT ... FOR UPDATE` server-side, then call that function from neon-http via `db.execute(sql\`SELECT deduct_credits(...)\`)`.

### 3.2 — Mock DB in tests does **not** validate transaction or lock semantics

`db/client.ts:47-76` proxies every property access to either the real DB or a `createMockDrizzle()` mock whose `transaction` handler is:

```ts
transaction: async (fn) => { const mockTx = createMockDrizzle(); return fn(mockTx); }
```

The mock runs the callback against a plain JS object with `.from().where().limit()` returning `[]`. The mock transaction **does not simulate** rollback semantics, doesn't enforce `for('update')` reads, and doesn't simulate concurrency. The 22+ test files that use this mock will pass even if the production transaction is broken (including the `for('update')` issue above).

**Suggested fix:** add a `vi.fn()` wrapper around `db.transaction` in tests that asserts (a) the callback is invoked exactly once, (b) any thrown error triggers a `ROLLBACK` stub, (c) `.for('update')` queries are called **inside** the transaction callback.

### 3.3 — Transactions are used pervasively (22 call sites) — good

`db.transaction(async (tx) => ...)` is used in credit deduction, deposits (USDC / Houdini / CCTP / LiFi / payment-link), refunds (both customer and admin grant/deny), withdrawals, account deletion, and deposit completion. This is the right shape. The problem is solely the lock semantics on the neon-http driver (see 3.1).

### 3.4 — Potential N+1: sequential await in admin analytics

`routes/analytics-admin.ts:37-104` runs **five** independent queries **sequentially**:

```ts
const analyticsAgg = await db.execute(sql`...`);          // 1
const byProvider    = await db.select(...).groupBy(...);   // 2
const byModel       = await db.select(...).limit(20);      // 3
const dailyUsage    = await db.select(...).groupBy(...);   // 4
const providerStatus= await db.select().from(providerHealth); // 5
const totalUsers    = await db.select({count}).from(users);// 6
```

None of these depend on each other. Wrap them in `Promise.all` to drop wall-clock latency roughly 6×. The same anti-pattern likely exists in `routes/admin/overview.ts` and `routes/metrics.ts` — worth a grep for `await db\.(select|execute)` followed by another `await db\.`.

### 3.5 — Missing index for `daily_usage` analytics

`analytics-admin.ts:87-98` does `db.select(...).groupBy(sql\`date(${usageRecords.createdAt})\`)` ordered by the same. Existing indexes on `usage_records`:

- `idx_usage_created` (single-column `created_at`) — usable for `WHERE created_at >= ?`
- `idx_usage_records_analytics` (`created_at, model, provider, cost_cents`) — covers the filter but **not** the `GROUP BY date(created_at)` ordering

For large `usage_records` tables the planner may pick `idx_usage_created` and require a sort. Add:

```ts
index("idx_usage_records_daily").on(sql`date_trunc('day', ${usageRecords.createdAt})`)
```

…or use TimescaleDB-style rollups if `usage_records` grows past ~10M rows (this is the path Hono/Drizzle best-practices recommends for analytical queries).

### 3.6 — `usage_records.requestId` index serves both `WHERE requestId = ?` and `UNIQUE`

Good — schema line 178 declares `uniqueIndex("uq_usage_request_id").on(t.requestId)`. The `idx_usage_request` on line 177 is then **redundant** and should be dropped.

### 3.7 — `users.address` declared `.unique()` but also has `idx_users_address`

`db/schema.ts:41` uses `.unique()` which creates a unique index, and line 58 also declares `index("idx_users_address").on(t.address)`. The duplicate non-unique index is dead weight on writes. Drop the explicit `index()` declaration.

### 3.8 — `creditBalances` lookup-by-PK is fast but `.for('update')` is a no-op

`deduction.ts:65-68` and `refunds.ts:54-57` lock `credit_balances` by primary key before update. The PK index makes the lookup fast, but the **lock** is silently dropped by neon-http (see 3.1).

---

## 4. Validation Gaps

### 4.1 — Inconsistent error envelopes

Grep shows two distinct error shapes:

- `validationError()` from `lib/validation.ts` returns `{ error: { message: "Validation error: ...", type: "invalid_request_error" } }` (correct envelope).
- `routes/admin/refunds.ts:114` does `safeParse(await c.req.json().catch(() => ({})))` — if JSON parse throws, the empty `{}` is parsed and validation fails with `code: Required`, which is then returned as 400 (works by accident, masks a programming error).
- `routes/admin/invoices.ts:26` does `await c.req.json().catch(() => null)` — if JSON parsing fails, the handler proceeds with `body === null` and may crash later with a confusing null-pointer-style 500.

### 4.2 — Auth route `/auth/session` validates JSON but no envelope

`routes/auth.ts:174`: `nonceSchema.safeParse(await c.req.json())` works, but every route uses `await c.req.json()` directly without a `Content-Type: application/json` check. A client sending `text/plain` to a JSON endpoint will get a confusing 500 from JSON parse, not a 415 Unsupported Media Type.

### 4.3 — `lib/validation.ts` is too thin (5 lines)

Only `validationError()` is provided. No `parsePagination()`, no shared enums for `deposit_type` / `deposit_status` / `provider`, no helper to compose schemas. Each route file repeats `z.object({...})` for the same domain concepts.

**Suggested addition** to `lib/validation.ts`:

```ts
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
});
export const depositTypeSchema = z.enum(["usdc_direct","usdc_solana", ...]);
```

---

## 5. Error-Handling Gaps

### 5.1 — CRITICAL — `onError` leaks `err.message` to API clients at 4xx

`index.ts:197-202`:

```ts
const errWithStatus = err as Error & { status?: ContentfulStatusCode };
const status = errWithStatus.status ?? 500;
if (status >= 500) {
  return c.json({ error: { message: "Internal server error", type: "server_error" } }, 500);
}
return c.json({ error: { message: err.message, type: "client_error" } }, status);
```

When a thrown error has a `.status < 500` (e.g., `throw Object.assign(new Error("User 0xabcd... not found in tenant 7"), { status: 404 })`), the **raw `err.message`** is returned to the public API. This is information disclosure — error messages frequently contain internal IDs, tenant names, partial wallet addresses, or stack-trace fragments.

**Suggested fix:** restrict the `err.message` passthrough to a hardcoded allowlist of known error classes (HTTPException, ZodError, and custom errors that explicitly opt in via a `safe: true` flag). Everything else returns a generic 400 with `correlationId` for debugging.

### 5.2 — Two redundant error helpers — `lib/api-errors.ts:errorResponse()` vs `index.ts:onError`

The codebase has two error-response builders:

- `lib/api-errors.ts:errorResponse(c, err)` — used by some route handlers (grep for `errorResponse`).
- `index.ts:app.onError` — the global Hono error handler.

`errorResponse()` is **never reached** for the routes that throw inside their handlers, because Hono's `onError` intercepts first. Only routes that explicitly `try { ... } catch (err) { return errorResponse(c, err) }` call it.

The inconsistency: when a route has its own try/catch and uses `errorResponse`, the correlationId is included in the response payload; when `onError` handles it, the correlationId is only logged. Result: clients see different error envelopes depending on which route failed. Standardise on one path and remove `errorResponse()` or convert it to `throwErrorResponse()` that throws an `HTTPException`.

### 5.3 — `routes/auth.ts:246-259` catches errors with manual status mapping but bypasses `onError`

```ts
try { ... } catch (err) {
  if (err instanceof Error && "httpStatus" in err) {
    const walletErr = err as ...;
    return c.json(...);
  }
  return c.json({ error: ... }, 500);
}
```

This is a custom-error convention (`httpStatus`, `code`) instead of Hono's standard `HTTPException`. It works, but:

- New developers won't discover the pattern without grep.
- The convention should be enforced via a `class ApiError extends HTTPException` factory in `lib/api-errors.ts`.

### 5.4 — `try {} catch { return c.json({error}, 500) }` boilerplate is repeated everywhere

Grep for `return c.json.*Internal server error.*500` — most routes write their own `try/catch` and return a generic 500. That logic should live in `app.onError`. Routes should just `throw new HTTPException(...)` or call `c.json(...)` for happy paths.

### 5.5 — Rate-limit failures log but don't surface a 429 envelope uniformly

Grep for `'too_many_requests'` / `429` — multiple middleware paths exist (`rate-limit/lua-scripts.js`, `sliding-window.js`, `token-bucket.js`). Verify they all return the same shape: `{ error: { message, type: "rate_limit_error", code, retryAfter } }` and the `Retry-After` header. Inconsistencies here are common audit findings.

---

## 6. Anti-Patterns Recap (file-by-file)

| File | Issue | Severity |
|---|---|---|
| `server/src/index.ts:191-203` | `onError` leaks `err.message` for status < 500 | **CRITICAL** |
| `server/src/index.ts:189,191` | `notFound`/`onError` registered after routes | medium (style) |
| `server/src/index.ts:107-146` | No global JSON validation, no body-size cap, no timeout middleware mounted | high |
| `server/src/db/client.ts:1-2` | `drizzle-orm/neon-http` driver incompatible with `for('update')` | **CRITICAL** |
| `server/src/db/client.ts:47-76` | Test mock doesn't simulate rollback or lock semantics | high |
| `server/src/credits/deduction.ts:18-101` | Uses `for('update')` on neon-http (race) | **CRITICAL** |
| `server/src/credits/deposit.ts:78,129,188,236,268` | Same race in 5 deposit flows | **CRITICAL** |
| `server/src/credits/refunds.ts:12-71` | Race in refund grant | **CRITICAL** |
| `server/src/credits/preflight.ts:8` | Race in preflight balance check | **CRITICAL** |
| `server/src/routes/withdraw.ts:207` | Race on withdrawal state transition | **CRITICAL** |
| `server/src/routes/admin/refunds.ts:125,238` | Race in admin grant/deny | **CRITICAL** |
| `server/src/routes/analytics-admin.ts:37-104` | 6 sequential queries that could be `Promise.all` | medium |
| `server/src/routes/admin/invoices.ts:26` | `c.req.json().catch(() => null)` masks parse error | medium |
| `server/src/lib/validation.ts` (entire file, 5 lines) | No shared schemas / pagination helpers | low |
| `server/src/lib/api-errors.ts` (entire file) | Custom error format inconsistent with `onError` | medium |
| `server/src/db/schema.ts:58-62` | Duplicate `idx_users_address` is shadowed by `.unique()` index | low |
| `server/src/db/schema.ts:177` | `idx_usage_request` redundant with `uq_usage_request_id` | low |

---

## 7. Recommended Changes — File-by-File

### 7.1 — `server/src/index.ts`

1. Move `app.notFound(...)` and `app.onError(...)` to **immediately after `cors(corsOptions)`** (currently L146). Conventional placement.
2. In `onError`, replace the raw-message passthrough:
   ```ts
   return c.json({
     error: {
       message: err instanceof HTTPException ? err.message : "Bad request",
       type: "client_error",
       correlationId,
     },
   }, status);
   ```
   …and only pass through `err.message` for `HTTPException` and a curated `safe: true` allowlist.
3. Mount `middleware/timeout.ts` globally with a 60s budget, or restrict to inference routes.
4. Add `app.use('/v1/*', jsonBodyWithLimit('256kb'))` to enforce body size and content-type.

### 7.2 — `server/src/db/client.ts`

1. Switch the driver export to provide **two handles**:
   - `db` — neon-http for read-heavy analytics routes.
   - `dbTx` — neon-serverless WebSocket pool for routes that use `for('update')`. Export both from `db/client.ts` and import the appropriate one in credit/refund/withdrawal modules.
2. Replace the mock-proxy in `createMockDrizzle()` with one that tracks `transaction(fn)` invocations and asserts at least one `for('update')` call when the test is flagged.

### 7.3 — `server/src/lib/validation.ts`

Add shared schemas (`paginationSchema`, `depositTypeSchema`, `providerSchema`, `txHashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/)`) so route handlers stop redefining the same constraints.

### 7.4 — `server/src/lib/api-errors.ts`

Convert `errorResponse(c, err)` into a factory:

```ts
export class ApiError extends HTTPException {
  constructor(status: ContentfulStatusCode, code: string, message: string) {
    super(status, { message, cause: { code } });
  }
}
```

…and have all routes `throw new ApiError(404, "user_not_found", "User not found")`. Then `onError` becomes the single point of truth.

### 7.5 — Credit / deposit / refund / withdraw flows

For all 16 `.for('update')` sites, choose one of the three remediation paths in §3.1. The smallest-diff option is option (1): swap driver per module to `drizzle-orm/neon-serverless`.

### 7.6 — `server/src/routes/analytics-admin.ts`

Wrap the six independent queries in `Promise.all`. Also consider materialising a `daily_usage_rollup` table populated by a cron job, and have the analytics endpoint select from the rollup instead of computing on the fly.

### 7.7 — `server/src/db/schema.ts`

Drop `index("idx_usage_request")` (L177, redundant with `uq_usage_request_id`) and `index("idx_users_address")` (L58, redundant with the `.unique()` constraint on `users.address`). Add `index("idx_usage_records_daily")` for the `GROUP BY date(created_at)` analytics query, or migrate to a daily-rollup table.

### 7.8 — `server/src/middleware/rate-limit/*`

Audit all five rate-limit backends (`lua-scripts`, `memory-store`, `sliding-window`, `token-bucket`, `utils`) for consistent 429 response shape and `Retry-After` header. Add a unit test that asserts identical envelopes across all five.

---

## 8. Top 3 Critical Issues

1. **`for('update')` is silently no-op on `drizzle-orm/neon-http`** — used in 16 places, including every financial flow (credit deduction, deposits, refunds, withdrawals). Two concurrent requests can both pass the balance check and double-spend. *Revenue-integrity bug.* Fix by switching to `drizzle-orm/neon-serverless` (WebSocket pool) for those modules, or by adding an optimistic-concurrency `version` column.

2. **`app.onError` returns `err.message` to clients when `status < 500`** — `server/src/index.ts:202`. Error messages from internal libraries leak internal IDs, tenant names, and partial secrets. Always return a generic message; only let `HTTPException` pass through its own (validated) message.

3. **No global JSON validation, body-size limit, or per-route content-type guard** — every route calls `safeParse(await c.req.json())` independently and many catchers are missing. A request with a 10 MB body, a non-JSON content type, or an unvalidated body hits a handler and either crashes with 500 or silently proceeds with `null`. Add `jsonBodyWithLimit` middleware mounted globally, and a `zValidator('json', schema)` factory shared by all routers.
