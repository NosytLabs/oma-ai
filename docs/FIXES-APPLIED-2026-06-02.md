# OMA AI Gateway — Audit Fixes Applied (2026-06-02)

## Summary

Applied all in-scope fixes from `docs/AUDIT-REPORT-2026-06-02.md` in priority order
(CRITICAL → HIGH → MEDIUM). Every change is verified with typecheck + lint + the
project's test suite before moving to the next priority bucket. No out-of-scope
changes were made.

**Final gates (green across the board):**

| Gate | Before | After |
|---|---|---|
| `app` typecheck | 0 errors | 0 errors |
| `app` lint | 0 errors | 0 errors |
| `app` tests | 36/36 | 36/36 |
| `server` typecheck | 0 errors | 0 errors |
| `server` lint | 0 errors | 0 errors |
| `server` tests | 432/432 (45 files) | 443/443 (47 files; +11 new tests) |

---

## CRITICAL

### CRITICAL-2 — App middleware now verifies the `oma_session` JWT

**File:** `app/src/middleware.ts`

The middleware was previously a no-op pass-through (any request matched `*` and
fell through to the page). All `/dashboard/*` and `/admin/*` routes were
unprotected. Replaced with real `jose.jwtVerify` against `process.env.JWT_SECRET`,
iss=`oma-ai`, aud=`oma-ai-api`. Missing/invalid token → redirect to `/`.

```ts
import { jwtVerify } from "jose";

const ENCODED_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "");
const PROTECTED = ["/dashboard", "/admin", "/settings", "/deposit", "/swap"];
const SESSION_COOKIE = "oma_session";
const ISSUER = "oma-ai";
const AUDIENCE = "oma-ai-api";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (!PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.redirect(new URL("/", req.url));
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    if (process.env.NODE_ENV === "production") {
      console.error("[middleware] JWT_SECRET missing or too short; redirecting to /");
    }
    return NextResponse.redirect(new URL("/", req.url));
  }
  try {
    await jwtVerify(token, ENCODED_SECRET, { issuer: ISSUER, audience: AUDIENCE });
    return NextResponse.next();
  } catch {
    return NextResponse.redirect(new URL("/", req.url));
  }
}
```

Added `jose` (^6.2.3) as a direct `app` dependency — it was only a transitive
before. Run `npm install --legacy-peer-deps` after pulling (pre-existing
wagmi/accounts/porto peer-dep conflict; not introduced by this audit).

The server's `bearerAuth` (`server/src/auth/middleware.ts`) was already correct
and was used as the source of truth for `iss`/`aud`/secret requirements.

### CRITICAL-3 — `server/src/db/client.ts` fails fast in non-test environments

**Files:** `server/src/db/client.ts`, new `server/src/__tests__/db-client.test.ts`

The previous module silently returned a mock-DB Proxy when `DATABASE_URL` was
missing or when `neon()` threw. In production, a typo'd env var or a transient
Neon outage would mask the error and serve fake data. Replaced the silent
fallback with fail-fast:

- If `DATABASE_URL` is missing/invalid OR `neon()` throws, set
  `_dbInitFailed = true` and:
  - in `NODE_ENV === "test"`: `throw` so the calling test surfaces the error;
  - in any other env: `logger.fatal(...)` + `process.exit(1)` so the process
    refuses to start.
- A subsequent call to `getDb()` after a failed init repeats the exit in
  non-test envs (defense-in-depth in case any code path bypasses the check).
- Exposes `resetDbState()` to clear `_db` and `_dbInitFailed` (used by tests).
- Preserves the `db` Proxy + `createMockDrizzle` mock for the existing 45
  server test files that all `vi.mock('../db/client.js')`.

**New tests** (7, in `server/src/__tests__/db-client.test.ts`):
- `process.exit(1) when DATABASE_URL is missing in production`
- `process.exit(1) when DATABASE_URL is missing in development`
- `process.exit(1) when neon() throws in production`
- `throws when DATABASE_URL is missing in test (no exit)`
- `throws when neon() throws in test (no exit)`
- `returns null after a previous init failure in test (no exit)`
- `exports resetDbState function`

Tests use `vi.hoisted` for the `neon`, `config`, and `process.exit` mocks so
that `vi.resetModules()` re-evaluates the module cleanly per scenario.

---

## HIGH

### HIGH-1 — `api-keys.ts` prefix check no longer breaks the hash match

**File:** `server/src/auth/api-keys.ts` (lines 60–62 and 89–91)

The old code stored `keyPrefix` as a plaintext 12-char slice of the raw key,
then on validation SHA-256-hashed the prefix and compared to the stored
plaintext — a 12-char string was never equal to a 64-char hex hash, so the
prefix check **always failed** and `validateApiKey` always returned `null` from
the cache and DB paths.

Fix: drop the broken re-hash. Compare plaintext prefix to plaintext prefix with
`timingSafeEqual` (constant-time, defense-in-depth). The `keyHash` is still
the primary credential; the prefix check is a sanity guard.

```ts
// was:
const rawPrefix = rawKey.slice(0, 12);
const rawPrefixHash = crypto.createHash("sha256").update(rawPrefix).digest("hex");
if (!timingSafeEqual(apiKey.keyPrefix, rawPrefixHash)) return null;
// now:
const rawPrefix = rawKey.slice(0, 12);
if (!timingSafeEqual(apiKey.keyPrefix, rawPrefix)) return null;
```

**New tests** (4, in `server/src/__tests__/api-keys.test.ts`):
- `stores plaintext keyPrefix matching the first 12 chars of the raw key`
- `validates a freshly-created key (prefix check no longer breaks the hash match)`
- `validates a key via the redis cache (cached path)`
- `rejects a key whose prefix does not match the stored prefix`

### HIGH-2 — Stricter `Content-Security-Policy` on server responses

**File:** `server/src/middleware/security.ts` (line 4)

Replaced the bare 5-directive CSP with a full directive list that explicitly
allows `cdn.jsdelivr.net` for scripts, `data:` and `https:` for images, and
includes `form-action`:

```
default-src 'self';
script-src 'self' https://cdn.jsdelivr.net;
style-src 'self' 'unsafe-inline';
img-src 'self' data: https:;
font-src 'self' data:;
connect-src 'self' https:;
object-src 'none';
frame-ancestors 'none';
base-uri 'self';
form-action 'self';
```

Other security headers (`X-Content-Type-Options`, `X-Frame-Options`,
`Referrer-Policy`, `Permissions-Policy`, `Strict-Transport-Security`,
`X-XSS-Protection`) are unchanged.

### HIGH-3 — `CORS_ORIGIN='*'` hard-fails startup in production

**File:** `server/src/index.ts` (added at module init, before route mount)

The previous per-request warning did not prevent the misconfiguration from
shipping. Added a startup check:

```ts
if (config.CORS_ORIGIN === "*" && config.NODE_ENV === "production") {
  logger.fatal("[SECURITY] CORS_ORIGIN='*' is not allowed in production. Refusing to start. Set specific origins (comma-separated).");
  process.exit(1);
}
```

In development, a wildcard origin is still allowed (browsers send `null`/
no-origin for same-origin fetches and the existing per-request fallback
returns `null` for `*`).

### HIGH-4 — `RECEIPT_HMAC_SECRET` placeholder check promoted to all non-test envs

**File:** `server/src/config.ts` (added after the existing production check at line 185)

The existing check only fired in `production|staging|prod|preview`. Added a
non-test gate that catches `development` and any custom env name as well:

```ts
if (config.NODE_ENV !== "test" && INSECURE_DEFAULTS.includes(config.RECEIPT_HMAC_SECRET)) {
  logger.error("RECEIPT_HMAC_SECRET must not be a known insecure default in non-test environments. Set a strong secret.");
  process.exit(1);
}
```

**Operator action required:** set a strong `RECEIPT_HMAC_SECRET` (≥32 chars)
in every `.env` file (dev, staging, preview, production). The default
`dev-receipt-hmac-placeholder` will now refuse to start in any non-test env.

---

## MEDIUM

### MEDIUM-1 — Navbar active links set `aria-current="page"`

**File:** `app/src/components/navbar.tsx`

Added `aria-current={isActive ? "page" : undefined}` to the rendered `<Link>`
in the desktop nav. Screen readers will now announce the current page in the
nav landmark.

### MEDIUM-2 — Footer link list now includes `/admin`

**File:** `app/src/components/footer.tsx`

Added `{ label: 'Admin', href: '/admin' }` to `FOOTER_LINKS`. `/playground`
and `/docs` were already present; `/admin` was the missing entry and the route
exists at `app/src/app/admin/page.tsx`.

### MEDIUM-3 — `viewport.themeColor` updated to brand void

**File:** `app/src/app/layout.tsx` (line 70)

Changed `themeColor: '#00ffc8'` (the bright accent, which produced a harsh
mobile browser chrome) to `themeColor: '#0a0a0f'` (the brand `--color-void`).
The hex must remain a literal — Next.js metadata does not resolve CSS vars.

### MEDIUM-8 — `server/fix_pricing.py` archival

**File:** `server/fix_pricing.py`

**Skipped — file no longer present.** The legacy one-off Python script is
already gone from the repo tree (`scripts/archive/` does not exist yet and the
script itself is not in the working copy). Confirmed via
`Get-ChildItem -Filter "fix_pricing*" -Recurse` returning empty. No action
needed; the original cleanup must have happened in a prior commit.

### MEDIUM-9 — Pin `react` and `react-dom` to `^19.2.6`

**File:** `app/package.json`

`react` was already `^19.2.6`; `react-dom` was `^19.0.0`. Bumped
`react-dom` → `^19.2.6` and ran `npm install --legacy-peer-deps` (the same
pre-existing wagmi/accounts/porto peer-dep conflict requires this flag; not
introduced by this audit). `npm ls react react-dom` now shows both at 19.2.6.

### MEDIUM-12 — Dual-Cookie Scheme section added to `docs/DEVELOPER-GUIDE.md`

**File:** `docs/DEVELOPER-GUIDE.md`

Added a new top-level section between "How API Keys Work" and "Pricing
(Credits)" documenting:

- The difference between `oma_session` (frontend/middleware JWT) and
  `oma_api_key` (cookie carrying the API key for browser → server calls).
- The "why two cookies?" rationale (session proves identity, API key carries
  credential).
- The full lifecycle (SIWE → JWT + key cookie → rotation/revocation).
- Security notes: never use `oma_session` as an API credential; never put
  `oma_api_key` in the `Authorization` header from client code; revocation of
  one does not affect the other.

A consolidated table comparing the two cookies is included at the top of the
section.

---

## Items explicitly skipped (per audit disposition)

These were called out as code-fix candidates in the audit but were intentionally
not touched in this pass because they fall outside the "code-only" scope, were
already correct on re-read, or have a non-trivial blast radius:

- **LOW-6 (navbar/menu `aria-live` region)** — kept on the deferred list per
  the audit's explicit disposition.
- **MEDIUM-4 (light-mode contrast tokens)** — kept on the deferred list; not
  code-only-safe without design sign-off.
- **MEDIUM-7 (full audit re-run)** — out of scope for this fix pass.
- **CRITICAL-1 (CORS, owner coordination)** — out of scope (requires Vercel
  + DNS + origin-team coordination). The HIGH-3 hardening of
  `CORS_ORIGIN='*'` to `process.exit(1)` in production is the local-server
  half of the same defense; the Vercel/proxy side remains a deployment
  concern.
- **MEDIUM-8 (`server/fix_pricing.py`)** — skipped because the file no longer
  exists in the working tree.

---

## Files changed

```
app/package.json                                  MEDIUM-9
app/package-lock.json                             MEDIUM-9 (npm install)
app/src/middleware.ts                             CRITICAL-2
app/src/components/navbar.tsx                     MEDIUM-1
app/src/components/footer.tsx                     MEDIUM-2
app/src/app/layout.tsx                            MEDIUM-3
docs/DEVELOPER-GUIDE.md                           MEDIUM-12
server/src/db/client.ts                           CRITICAL-3
server/src/__tests__/db-client.test.ts (new)      CRITICAL-3 (+7 tests)
server/src/auth/api-keys.ts                       HIGH-1
server/src/__tests__/api-keys.test.ts (new)       HIGH-1 (+4 tests)
server/src/middleware/security.ts                 HIGH-2
server/src/index.ts                               HIGH-3
server/src/config.ts                              HIGH-4
```

## Verification commands

```bash
# app
cd oma/app
npm install --legacy-peer-deps
npm run typecheck
npm run lint
npm test

# server
cd oma/server
npm run typecheck
npm run lint
npm test
```

All four gates pass on the modified tree.
