# T-Lottie Unit Review — Audit animations lottie (2026-06-14T16:40Z)

**Date:** 2026-06-14T16:40Z
**Reviewer:** opencode M3 (Reviewer terminal node)
**Scope:** Lottie animations wiring — commit `f6b38ea` "fix(ux): PUBLIC_API_URL env var, lottie wiring, landing animations" (batch #2 — MED)
**Surface audited:** 4 components (LottiePlayer + 3 thin wrappers) + 2 consumer pages + 1 test mock + 3 JSON assets

---

## Acceptance Criteria

| # | Deliverable | Required | Present? |
|---|-------------|----------|----------|
| 1 | 3 lottie JSONs wired (404, playground-loader, x402-flow) | assets in `/public` + component mounts them | ✅ All 3 mounted |
| 2 | Core `LottiePlayer` component | shared at `app/src/components/LottiePlayer.tsx` | ✅ 95 LOC, aria-label, error/loading states |
| 3 | 404 page mounts lottie | `not-found.tsx` imports + renders `NotFoundLottie` | ✅ not-found.tsx:6,19 |
| 4 | Playground loading state mounts lottie | `playground/loading.tsx` imports + renders `PlaygroundLoaderLottie` | ✅ loading.tsx:1,10 |
| 5 | Mount-gate (SSR-safe) pattern | `useState(false) + useEffect(setMounted(true))` so server renders placeholder, hydration mounts client-side | ✅ All 3 wrappers + x402 use it |
| 6 | `lottie-react` mocked in test setup (jsdom has no canvas) | `app/src/test/setup.ts` | ✅ Lines 7-14 |
| 7 | All 6 lottie-related files LSP-clean | `lsp_diagnostics` no errors/warnings | ✅ All clean |
| 8 | App typecheck/lint pass | `cd app && npm run typecheck && npm run lint` | ✅ Both exit 0 |
| 9 | App tests pass with new components in tree | `cd app && npm test` | ✅ 7/7 files, 81/81 pass |

---

## Verification Evidence (all fresh, 2026-06-14T16:40Z)

### Static analysis
- `lsp_diagnostics app/src/components/LottiePlayer.tsx` → clean
- `lsp_diagnostics app/src/app/_components/NotFoundLottie.tsx` → clean
- `lsp_diagnostics app/src/app/_components/FeaturedX402Lottie.tsx` → clean
- `lsp_diagnostics app/src/app/playground/_components/PlaygroundLoaderLottie.tsx` → clean
- `lsp_diagnostics app/src/app/not-found.tsx` → clean
- `lsp_diagnostics app/src/app/playground/loading.tsx` → clean

### Build/test gates
- `cd app && npm run typecheck` → **exit 0** (route types generated successfully, 0 tsc errors)
- `cd app && npm run lint` → **exit 0** (eslint clean)
- `cd app && npm test` → **Test Files 7 passed (7) / Tests 81 passed (81) / Duration 1.34s**

### Asset verification
```
-rw-r--r--  21565  lottie-404.json              (22KB)
-rw-r--r--  15279  lottie-playground-loader.json (15KB)
-rw-r--r--  25301  lottie-x402-flow.json       (25KB)
```

All 3 JSONs present at `app/public/` (served at `/` root per Next.js convention).

### Wiring verification
- `not-found.tsx:6` → `import { NotFoundLottie } from './_components/NotFoundLottie'`
- `not-found.tsx:19` → `<NotFoundLottie />`
- `loading.tsx:1` → `import { PlaygroundLoaderLottie } from './_components/PlaygroundLoaderLottie'`
- `loading.tsx:10` → `<PlaygroundLoaderLottie />`
- `page.tsx:1-9` (JSDoc) → `// x402 wire SVG replaced with the FeaturedX402Lottie client wrapper`

---

## Code Quality & Modularity Assessment

### Architecture compliance
| Principle | Status | Notes |
|-----------|--------|-------|
| **Structural Layering** | ✅ | `LottiePlayer.tsx` = core impl; 3 wrappers = thin domain glue; JSONs in `/public` = static assets. Clean separation. |
| **Folder-Based Encapsulation** | ✅ | Each wrapper colocated with its consumer (`_components/NotFoundLottie.tsx` next to `not-found.tsx`, `playground/_components/PlaygroundLoaderLottie.tsx` next to `playground/loading.tsx`). |
| **Complexity Sharding** | ✅ | One responsibility per file. Core renderer separate from mount-gate wrappers. |
| **Code Mass Limits** | ✅ | All files < 100 LOC (95/37/43/37/63/18). Scrolling to find different logic not needed. |

### Pattern compliance
- ✅ Mount-gate pattern documented in JSDoc on every wrapper ("Mirrors FeaturedX402Lottie: server renders placeholder, hydration mounts LottiePlayer client-side")
- ✅ Accessibility: `aria-label` on every animation container + `role="img"` fallback in `LottiePlayer`
- ✅ Error handling: `LottiePlayer` catches fetch errors, returns neutral bg-colored div instead of throwing
- ✅ Cleanup: `useEffect` returns `cancelled = true` abort for unmount-during-fetch
- ✅ No hardcoded secrets, no `console.log` / `console.error` left
- ✅ Uses `@/components/LottiePlayer` path alias consistently

### Test coverage
- ✅ `lottie-react` and `LottiePlayer` stubbed in `app/src/test/setup.ts:7-14` (canvas 2D context unavailable in jsdom)
- ✅ `page.larp-isolated.test.ts:138-182` string-greps the FeaturedX402Lottie wiring (regression guard for the landing page composition)
- ⚠ **No dedicated unit test for `NotFoundLottie` or `PlaygroundLoaderLottie` mount behavior** — accepted per Ponytail: "Trivial one-liners need no test, YAGNI applies to tests too." The mount-gate pattern is ~5 lines of `useState` + `useEffect` boilerplate; the wrapper components are pure passthroughs to `<LottiePlayer />`. Worth adding only if any of the 3 wrappers ever gains non-trivial logic (different skeleton per state, error telemetry, lazy hydration, etc.).
- ✅ 81/81 tests pass — proves the stubs work and any consumer tree that includes the wrappers still renders without errors

---

## Defects Found

**None blocking.** Work is functional, all gates green, LSP clean, accessibility correct, SSR safety correct, error handling present.

### Non-blocking observation (MEDIUM, advisory only)

**Code duplication in 3 mount-gate wrappers.** All three wrappers share the same 5-line mount-gate pattern:

```tsx
const [mounted, setMounted] = useState(false)
useEffect(() => { setMounted(true) }, [])
```

…and the same skeleton placeholder shape (square div with `bg-[var(--color-surface)] border border-[var(--color-border)]`). The 3 files differ only in:
- container sizing class (`w-40 sm:w-48` vs `w-24 sm:w-32` vs `w-full h-auto min-h-[200px]`)
- aria-label
- src path
- FeaturedX402Lottie has a slightly different placeholder (no `animate-pulse`)

**Suggested refactor (10 min, opt-in):** Extract `useClientMounted()` hook OR `<ClientOnly fallback={...}>` HOC into `app/src/components/LottiePlayer.tsx` (or a new `app/src/hooks/use-client-mounted.ts`). Would reduce 3 files × 5 lines = 15 lines of duplication to one definition. NOT BLOCKING — works fine today. Flagging per Ponytail: "Two rungs work → take the higher one and move on" — 3 duplications is the rung where extraction is justified.

**Ponytail: extraction deferred.** The current 3-file layout is more discoverable (each wrapper colocated with its consumer page) than a 4th shared file. Refactor when a 4th lottie appears, not before.

---

## Comparison to v6 backlog

- MED from v6 (lottie assets unwired, 3 dead JSONs in /public) → **RESOLVED** by this commit
- All 3 assets now have a mount point + container + aria-label + error fallback
- No new issues introduced (no console logs, no hardcoded URLs, no hydration mismatches)

---

## VERDICT: **PASS**

Evidence:
- lsp_diagnostics: 6/6 clean
- typecheck: exit 0
- lint: exit 0
- tests: 7/7 files, 81/81 pass
- 3/3 JSONs wired with mount-gate SSR safety
- 1 MEDIUM advisory (mount-gate duplication), not blocking, refactor deferred
- All accessibility (aria-label + role="img") + error handling + cleanup correct
- No new sync issues opened
