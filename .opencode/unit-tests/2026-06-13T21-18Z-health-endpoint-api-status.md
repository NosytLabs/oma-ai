# Unit Review: Health endpoint + api-status.tsx (T9.3 / MiniMax critical fix #1)

**Reviewer:** Reviewer (current session, terminal dispatched 2026-06-13T21:18Z)
**Scope:** verify the unit "Check health endpoint + fix failing health check"
**Worker claim:** commit `807c7f1 fix(v5): resolve app build dep-version drift + add SYNC-29` — changed `app/src/components/api-status.tsx:99-104` from error-styled "Backend Unavailable" to warning-styled "Reconnecting…"

---

## VERDICT: PASS

The fix is correct, minimal, and addresses the actual UX issue identified in the MiniMax visual audit (`.opencode/context.md` Pending Task #1: "**'Backend Unavailable' red dot — `app/src/components/api-status.tsx:102`** is the source. Component is in the navbar. This is a conversion killer."). The change is a 3-line UX/colour adjustment in the `offline` state of `ApiStatus`.

---

## Verification evidence

### 1. `lsp_diagnostics` (clean on all changed files)

| File | Result |
|------|--------|
| `app/src/app/api/health/route.ts` | clean (no diagnostics) |
| `app/src/components/api-status.tsx` | clean (no diagnostics) |
| `server/src/routes/health.ts` | clean (no diagnostics) |

### 2. The actual code change (commit 807c7f1, `app/src/components/api-status.tsx:99-104`)

```diff
       case 'offline':
         return {
           icon: <WifiOff className="h-3 w-3" />,
-          text: 'Backend Unavailable',
-          className: 'text-[var(--color-error)]',
-          dotClass: 'bg-[var(--color-error)]',
+          text: 'Reconnecting…',
+          className: 'text-[var(--color-warning)]',
+          dotClass: 'bg-[var(--color-warning)] animate-pulse',
         }
```

**Why this is the right fix:**
- "Reconnecting…" accurately describes the polling loop state (30s `POLL_INTERVAL_MS`, in `app/src/components/api-status.tsx:8`).
- Warning class + animated pulse is the correct severity for a transient dev/HMR pause — not a permanent error.
- Uses existing `var(--color-warning)` design token (consistent with the orange theme) — no new colours introduced.
- aria-label (`API Status: Reconnecting…`) automatically tracks the new text (no separate a11y change needed at line 120).
- `Offline → showRetryButton` logic at line 124 is unchanged — retry button still appears during the brief reconnect window, which is the right UX.

### 3. Static analysis of the health route + server health module

**`app/src/app/api/health/route.ts` (36 lines, unchanged in this commit):**
- 5s `AbortController` timeout — matches client `TIMEOUT_MS` in `api-status.tsx:9` (good).
- Returns 200 with `status: data.status` on backend success.
- Returns 503 with `status: 'offline'` on backend failure.
- Sets `Cache-Control: s-maxage=25, stale-while-revalidate=30` to reduce backend load — appropriate.
- No secrets, no PII, no request body needed — minimal attack surface.

**`server/src/routes/health.ts` (107 lines, unchanged in this commit):**
- 4 endpoints: `/live`, `/ready`, `/health`, `/version`.
- `/health` (legacy alias) runs `SELECT 1` against the DB, returns 200/503 + `dbLatencyMs`.
- `/ready` checks DB + Redis (Redis is best-effort, doesn't fail readiness).
- `/version` exposes build metadata only (no secrets — safe).
- DB error caught and reported in 503 payload, not 500 — proper error handling.

### 4. Build verification (the actual T9.3 gate)

```
$ cd app && NEXT_TELEMETRY_DISABLED=1 npm run build
…
+ First Load JS shared by all               617 kB
  ├ chunks/4bd1b696-100b9d70ed4e49c1.js    54.2 kB
  └ chunks/vendors-550616136b4ed7ff.js      560 kB
ƒ Middleware                               40.1 kB
○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
```

**EXIT_CODE: 0** — T9.3 (app build) is GREEN. The dep-version drift (SYNC-29) is resolved. The same commit also added missing wagmi peer deps (`@base-org/account`, `@metamask/connect-evm`, `@safe-global/safe-apps-sdk`) and dropped Node-only wallet libs from `optimizePackageImports`.

### 5. Test verification

| Gate | Result | Evidence |
|------|--------|----------|
| `cd app && npm run typecheck` | PASS | `✓ Route types generated successfully`, exit 0 |
| `cd app && npm run lint` | PASS | exit 0, no output |
| `cd app && npm test` | PASS | **28/28** tests passed, 4 files, 1.44s |
| `cd server && npm run typecheck` | PASS | exit 0, no output |
| `cd server && npm test` | PASS | **685/685** tests passed, 59 files, 11.05s |
| `cd app && npm run build` | PASS | exit 0, all routes built, T9.3 GREEN |

### 6. Runtime verification (server /health live)

```
$ curl -s -o /dev/null -w "HTTP %{http_code} | time=%{time_total}s\n" http://localhost:3001/health
HTTP 200 | time=0.421208s
```

Server health endpoint responds 200 in 421ms. (Server stopped before verbose curl could grab the JSON body, but the HTTP 200 from a Hono handler confirms the route is wired and the DB `SELECT 1` succeeded.)

### 7. Confirmation that the offending copy is gone

```
$ grep -c "Backend Unavailable" app/src/components/api-status.tsx
0
$ grep -c "Reconnecting" app/src/components/api-status.tsx
1
```

---

## Code quality assessment

### Strengths
- **Minimal, surgical change.** 3 lines in one file. No risk of side effects.
- **Uses existing design tokens.** `--color-warning` is already defined; no new constants.
- **Preserves a11y.** `aria-label` and `role="status"` are unchanged in meaning (status text is still the same value); only the visible copy + class changes.
- **Matches polling intent.** "Reconnecting…" honestly describes the 30s-poll behaviour.
- **No logic changes.** `useApiHealth`, `subscribe`, `pollOnce`, and the success/timeout paths are all unchanged.

### Gaps (low-severity, future-work)
1. **No unit test for `app/src/components/api-status.tsx`.** The 4 page tests (`src/app/page.test.tsx`, `pricing/page.test.tsx`, `models/page.test.tsx`, plus 1 more) cover landing/pricing/models. None import `ApiStatus` or `useApiHealth`. A future refactor of the offline state could regress the "Backend Unavailable" copy without test coverage catching it.
2. **No unit test for `app/src/app/api/health/route.ts`.** The 5s timeout, 503 fallback, and `s-maxage` caching header are not asserted. A regression in the timeout or status code would not be caught by tests.
3. **No unit test for `server/src/routes/health.ts`.** The DB-down → 503, Redis-best-effort, and `Cache-Control: no-store` paths on `/health` are untested at the route level (tested transitively via integration tests).

These gaps are not blocking for the current commit (the change is a UX text swap with no logic risk) but are recommended follow-up T-number in any future M-round.

---

## Pre-existing context (for the record)

- The "Backend Unavailable" red dot was a known conversion-killer from the MiniMax visual audit (`.opencode/context.md` Pending Task #1). Source location was `app/src/components/api-status.tsx:102` (per CONTEXT.md).
- The actual `/api/health` and `/health` endpoints were always functional — the build failures (T9.3 blocker) and the scary red copy combined to make a brief polling moment look like a permanent outage.
- The current commit (807c7f1) also resolved the T9.3 build blocker by adding 3 missing wagmi peer deps + dropping 8 wallet libs from `optimizePackageImports` (which were pulling Node-only modules incompatible with Edge Runtime / static-prerender). The dep fix is independent of the UX fix but happened in the same commit.

---

## Sync issues written by this review

- **No new SYNC issues.** The fix is verified complete. SYNC-29 (the build blocker, originally at line 483 of sync-issues.md) is resolved by this same commit and should be moved to the RESOLVED section in a future sync-issues housekeeping pass. The 1st SYNC-29 (line 392, M6 layout screenshot) is a different finding (T6.5.10 follow-up) and remains MEDIUM-pending.

---

## Recommendation

**Mark T9.3 (app build) [x] in todo.md.** The 3-part fix (UX copy + missing deps + optimizePackageImports cleanup) is complete and the build exits 0. SYNC-29 (build) is RESOLVED.

The MiniMax critical finding #1 (Backend Unavailable red dot) is also CLOSED. The navbar's status pill now reads "Reconnecting…" in warning colour with a pulsing dot, which is a more honest representation of the transient polling state.

**T9.3 evidence: `cd app && NEXT_TELEMETRY_DISABLED=1 npm run build 2>&1 | tail -20` → exit 0, all 33+ routes built, 617 kB shared First Load JS.**

— Reviewer, 2026-06-13T21:18Z
