# T-playground-chat — Unit Test Record

**Date:** 2026-06-14T16:39Z
**Reviewer:** opencode M3
**Scope:** `app/src/app/playground/*` (7 files, 1,123 LOC) + the dead-code concern in `_components/`
**Verdict:** **PARTIAL PASS** — 4 build/lint/test gates green, 3 P1 defects, 3 P2 dead-code files

---

## Verification

| Check | Result | Command |
|-------|--------|---------|
| `lsp_diagnostics` on 4 critical playground files | ✓ clean | `lsp_diagnostics({ file: "app/src/app/playground/page.tsx" })` + 3 _components |
| `app typecheck` | ✓ exit 0 | `cd app && npm run typecheck` (next typegen → 0 errors) |
| `app lint` | ✓ exit 0 | `cd app && npm run lint` (eslint → 0 output) |
| `app test` | ✓ 7 files / 81 tests pass | `cd app && npm test` (1.42s) — **0 playground tests in suite** |
| Tests exist for new code | ❌ no | `find app -name "*playground*.test.*"` → 0 results |
| Dead-code check | ❌ 4 files | `PlaygroundChatArea`, `PlaygroundSettingsPanel`, `ModalitySwitcher`, `PlaygroundLoaderLottie` — none imported anywhere |
| Refactor completeness | ❌ partial | `_components/` subdir exists (modularity step started), but `page.tsx` inlines the same JSX instead of using the extracted components |

---

## P1 Defects (must fix before [x])

| # | File:line | Issue |
|---|-----------|-------|
| **P1-A** | `page.tsx:554-644` ↔ `PlaygroundChatArea.tsx:58-127` | Chat-area JSX duplicated 95% verbatim, extracted component is dead code |
| **P1-B** | `page.tsx:608-626` | Missing 402 / payment / credit → "Deposit Credits" CTA that `PlaygroundChatArea.tsx:95-101` has — the inline version is worse |
| **P1-C** | `page.tsx:647-725` ↔ `PlaygroundSettingsPanel.tsx` | Same pattern: extracted component dead, sidebar JSX inlined |

## P2 Defects (dead code, decide import or delete)

| # | File | LOC | Action |
|---|------|-----|--------|
| P2-A | `ModalitySwitcher.tsx` | 67 | Delete (no current use) or wire as the chat↔image↔video route switcher |
| P2-B | `PlaygroundLoaderLottie.tsx` | 37 | Delete or use as the `loading.tsx` content |
| P2-C | `PlaygroundChatArea.tsx` | 128 | Wire into `page.tsx` (preferred — fixes P1-A + P1-B) or delete |
| P2-D | `PlaygroundSettingsPanel.tsx` | 138 | Wire into `page.tsx` (preferred — fixes P1-C) or delete |

## P3 Nits

- P3-A: 2 lucide-react imports in `page.tsx` (lines 10-19 and 74) — merge
- P3-B: `settingsProps` rebuilt every render in `PlaygroundSettingsPanel.tsx:43-53` — useMemo
- P3-C: 3 separate localStorage `useEffect`s in `page.tsx:139-188` — merge
- P3-D: 3× `console.warn` already on v7 audit P1-1 backlog (lines 178, 271, 353)

## OK

SSE parser, abort handling, deferred-value, debounce, lazy-load, types/imports all clean.

---

## Decision

Verdict: **PARTIAL PASS** — gate-green but with 3 P1 defects and 4 dead-code files (409 LOC). Recommend: file as a v8 cleanup milestone ("M10 — finish playground refactor") or accept technical debt and move on. Not blocking v7.

The v7 audit deliverable (T1.7 `app-pages.md`) found 6 P1s + 9 P2s + 4 P3s across all 38 pages; this review found 3 more P1s + 4 more P2s specific to the playground chat module.

Total v7 surface for playground: **6 P1s + 13 P2s + 8 P3s** spanning the audit T1.7 and this review.
