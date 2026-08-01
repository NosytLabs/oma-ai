# PLAN: Slice 1 — Visual/UX Polish (Editorial Hard)

**Spec:** `docs/superpowers/specs/2026-08-01-visual-ux-polish-design.md`
**Branch:** `main` (local)
**Owner:** builder agent
**Verify:** `npm run validate` + axe + visual smoke

---

## Phase A — Correctness (~30 min) · sequential first

| # | Task | Files | Verify |
|---|---|---|---|
| A1 | Remove `MiniMax 2.7` & `Kimi K2.6` from `DISPLAY_NAME_OVERRIDES` (or replace with real catalog models) | `app/src/lib/models-data.ts:322-325` | `grep -nE "MiniMax 2\.7\|Kimi K2\.6" app/src` → 0 user-facing hits |
| A2 | Find all user-facing references to hallucinated model names and replace with real catalog names (GLM 4.7, Qwen 3.7 Max, Venice Uncensored 1.2) | `app/src/app/_components/home/capabilities-grid.tsx:45`, `app/src/app/pricing/page.tsx:489` | grep zero hits |
| A3 | Lock "credits" wording globally — replace "balance", "USD", "funds" where they refer to user's account balance | grep `app/src` for `\\b(USD\|funds\|account balance)\\b` and replace only user-facing wrong uses | grep shows no "funds"/"USD balance" in user copy |

## Phase B — Layout (~45 min) · parallel with C

| # | Task | Files | Verify |
|---|---|---|---|
| B1 | Remove `page-shell` from docs — keep sidebar fixed local layout | `app/src/app/docs/page.tsx:139` | mobile + desktop alignment correct |
| B2 | Consolidate hero CTAs: 1 primary + 2 secondary + 1 quiet tertiary | `app/src/app/_components/home/hero.tsx:100-169` | visual confirmation |
| B3 | Settings IA — add Privacy tab between Profile and Danger; new `PrivacySection` with data export | `app/src/app/settings/page.tsx:60`, new `app/src/app/settings/_components/PrivacySection.tsx` | deep-link `/settings?tab=privacy` works; existing `?tab=danger` alias preserved |
| B4 | Fix hero badge wording "Card or USDC" → "Buy credits · card · USDC" | `app/src/app/_components/home/hero.tsx:74` | grep confirms |

## Phase C — Visual polish (~1.5 h) · parallel with B

| # | Task | Files | Verify |
|---|---|---|---|
| C1 | Redesign capabilities as **3 story clusters**: Pay with credits · Agents pay per request · Routing & privacy | `app/src/app/_components/home/capabilities-grid.tsx` | reads as 3 stories, no 7-cell grid |
| C2 | Add **Polar tier cards** section to pricing (Hobby $10/1000c · Builder $50/5000c · Scale $250/25000c) | `app/src/app/pricing/page.tsx` (insert new section) | 3 cards render with real env-derived names + prices + credits |
| C3 | Pricing footer CTAs — 1 primary + 2 secondary (was 4 stacked) | `app/src/app/pricing/page.tsx:670-728` | visual confirmation |
| C4 | Remove stale Polar comment in dashboard | `app/src/app/dashboard/_components/DashboardGrid.tsx:444` | grep no "Polar subscription card removed" |
| C5 | Fix pricing headline "Card, USDC, or x402" → drop "or x402" from the metric, mention x402 in description | `app/src/app/pricing/page.tsx:330` | visual confirmation |

## Phase D — Emil polish (~30 min)

| # | Task | Files | Verify |
|---|---|---|---|
| D1 | Confirm button `:active scale(0.97)` on all interactive buttons | globals.css, components/button.tsx | hover/click manual |
| D2 | Verify popover transform-origin matches trigger (not center) | popover/tooltip primitives | manual |
| D3 | Add subtle `filter: blur(2px)` on hero crossfade | hero.tsx transitions | manual |
| D4 | Confirm `prefers-reduced-motion` globally respected | globals.css catch-all | verify in dev tools |

## Phase E — Verification (sequential gate) · ~30 min

| # | Task | Commands |
|---|---|---|
| E1 | Typecheck | `cd app && npm run typecheck && cd ../server && npm run typecheck` |
| E2 | Lint | `cd app && npm run lint && cd ../server && npm run lint` |
| E3 | Unit tests | `cd app && npm test && cd ../server && npm test` |
| E4 | Axe a11y (Playwright already has axe-core) | `cd app && npx playwright test` |
| E5 | Visual smoke | start dev server, screenshot home + pricing + docs + settings + dashboard |
| E6 | Commit + checkpoint report | git commit, summary |

## Success gates

- [ ] A1–A3: zero hallucinated models, zero "balance/funds" wrong usage
- [ ] B1–B4: layout correct, IA updated, wording consistent
- [ ] C1–C5: capabilities 3 stories, Polar tiers render, footer clean
- [ ] D1–D4: interactions polished
- [ ] E1–E6: all green, screenshot review passes

## Subagent dispatch plan

1. **Wave 1**: 1 general subagent → Phase A (cleanup, blocking)
2. **Wave 2**: 2 general subagents in parallel → Phase B (layout) + Phase C (visual)
3. **Wave 3**: 1 general subagent → Phase D (Emil polish)
4. **Wave 4**: orchestrator (me) → Phase E verification

Each subagent receives: spec path, phase scope, file paths, verify commands. Returns: list of changes, test results, screenshot path.