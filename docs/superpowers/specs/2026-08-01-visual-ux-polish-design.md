# SPEC: Slice 1 — Visual/UX Polish (Editorial Hard)

**Date:** 2026-08-01
**Scope:** Marketing pages, UI primitives, copy consistency, docs alignment, Polar tier UI, settings IA.
**Brand locked:** void `#07090a` + emerald `#46d39a` · Instrument Serif / Geist / Geist Mono · motion system in `/app/src/lib/animation`.
**Out of scope (later slices):** pricing engine logic · new payment methods · admin tooling · backend schema · security audit.

---

## Problem statement

OMA has strong bones — locked brand, mature design system, distinctive editorial aesthetic. But user-facing copy contains **AI-slop hallucinations** ("MiniMax 2.7", "Kimi K2.6"), the wording is inconsistent across pages ("credits" vs "balance" vs "USD"), the docs page has a real **alignment bug** from the global `page-shell` class conflicting with its own sidebar, the Polar SDK is wired with three live tiers but no UI renders them, and the settings page buries GDPR/delete-account as the 5th tab.

## Goals

1. **Remove every hallucinated model name** from user-facing copy (real catalog: GLM 4.6–5.1, Qwen 3.5–3.7, Venice Uncensored).
2. **Lock "credits" as the canonical unit** across all pages.
3. **Fix docs page alignment** — remove `page-shell` conflict on lg breakpoint.
4. **Add Polar tier cards** on `/pricing` (Hobby $10/1000c · Builder $50/5000c · Scale $250/25000c).
5. **Consolidate hero CTAs** from 4 → 1 primary + 2 secondaries.
6. **Redesign capabilities** as 3 clear story clusters (Pay with credits · Agents pay per request · Routing & privacy).
7. **Settings IA**: add explicit "Privacy" tab between Profile and Danger; data export; move Danger out of last position.
8. **Remove dashboard stale comment** about Polar subscription.
9. **Emil Kowalski micro-interaction polish** — confirm button `:active` scale, popover transform-origin, blur bridges.
10. **All verification green**: typecheck, lint, vitest, axe a11y, visual smoke.

## Non-goals (explicit)

- Pricing engine logic · Polar SDK upgrade · new payment methods
- Admin tooling (later slice)
- Real Polar product fetch — use env-derived static display; live sync is later slice
- Backend schema changes
- Test expansion — only verify existing pass

## Design direction — Editorial Hard

Push the magazine aesthetic:
- Instrument Serif display + Geist body — already locked
- 3 story clusters in capabilities, not 7 small cards
- Hero: 1 bold primary CTA + 2 secondaries + 1 quiet tertiary ("Live models · 22+")
- Big editorial display headlines with italic tension ("paid per request", "credit by credit")
- Tight type rhythm — section vertical padding `py-16 sm:py-20 lg:py-24` everywhere
- Single emerald accent, generous negative space

## Files affected (~25–30)

### Cleanup / correctness
- `app/src/lib/models-data.ts` — remove `MiniMax 2.7` and `Kimi K2.6` from `DISPLAY_NAME_OVERRIDES` (or replace with real models)
- `app/src/app/_components/home/capabilities-grid.tsx` — fix copy referencing hallucinated models; restructure into 3 story clusters
- `app/src/app/pricing/page.tsx` — fix hallucinated model reference at L489
- All pages — lock "credits" wording (replace "balance", "USD", "funds" where wrong)

### Layout
- `app/src/app/docs/page.tsx` — remove `page-shell` wrapper; keep local layout; ensure mobile menu z-index correct
- `app/src/app/_components/home/hero.tsx` — consolidate CTAs (1 + 2 + 1 quiet); fix badge wording to "credits"
- `app/src/app/settings/page.tsx` — add Privacy tab; reorder tabs
- `app/src/app/settings/_components/PrivacySection.tsx` — NEW: data export, retention info, deletion links

### Pricing
- `app/src/app/pricing/page.tsx` — add Polar tier section; fix footer CTAs (1 + 2); fix "or x402" headline

### Dashboard
- `app/src/app/dashboard/_components/DashboardGrid.tsx` — remove stale Polar comment

### System / shared
- `app/src/app/globals.css` — confirm button `:active scale(0.97)`; add transform-origin helper for popovers

## Implementation phases

### Phase A — Correctness (priority 1, ~30 min)
1. Audit `models-data.ts` `DISPLAY_NAME_OVERRIDES` — confirm both hallucinated entries have no backing model IDs → remove overrides, replace with real catalog names if needed.
2. Find all user-facing references to hallucinated names via grep across `app/src`; replace with real models.
3. Lock "credits" wording globally — grep `app/src` for "balance" / "USD" / "funds" in user-facing copy; replace where wrong.

### Phase B — Layout (priority 1, ~45 min)
4. Fix docs `page-shell` conflict — verify mobile + desktop alignment.
5. Hero CTA consolidation — 1 primary + 2 secondaries + 1 quiet tertiary.
6. Settings IA — add Privacy tab; reorder; new PrivacySection component (data export button + retention info).

### Phase C — Visual polish (priority 2, ~1.5 h)
7. Redesign capabilities section — 3 story clusters:
   - **Pay with credits** (hero) + Polar card + USDC + x402 pay-per-call
   - **Agents pay per request** (hero) + agent demo embed
   - **Routing & privacy** (hero) + provider routing + circuit breaker + zero-retention
8. Add Polar tier cards section on `/pricing` — 3 cards from `server/src/routes/polar.ts` constants.
9. Pricing footer CTAs — consolidate to 1 primary + 2 secondaries.
10. Remove dashboard stale Polar comment.

### Phase D — Emil polish (priority 3, ~30 min)
11. Verify all interactive elements have:
    - `transform: scale(0.97)` on `:active` for buttons
    - `transform-origin` set on popovers
    - subtle `filter: blur(2px)` on crossfades
12. Confirm `prefers-reduced-motion` respected throughout.

### Phase E — Verification (priority 1, ~30 min)
13. `npm run validate` (typecheck + lint + vitest) green.
14. `axe-core` scan via Playwright — zero critical a11y issues.
15. Visual smoke — dev server screenshot, no console errors.

## Success criteria

- [ ] Zero hallucinated model names in user-visible copy
- [ ] "credits" used everywhere (grep confirms)
- [ ] Docs page aligns correctly on mobile + desktop
- [ ] Polar 3 tiers render on `/pricing` with real info
- [ ] Hero: exactly 1 primary + 2 secondary + 1 quiet tertiary CTA
- [ ] Capabilities reads as 3 clear story clusters
- [ ] Settings has explicit Privacy tab + data export
- [ ] All tests + typecheck + lint + axe pass
- [ ] Visual smoke OK

## Risk register

- **R1:** Hallucinated model names may have backing `models.json` IDs I haven't seen — verify before removing overrides.
- **R2:** Removing `page-shell` on docs may need compensating layout tweaks — keep sidebar at fixed width.
- **R3:** Settings reorder may break deep links (`/settings?tab=danger`) — keep aliases in `parseSettingsTab`.
- **R4:** Layout changes may break Playwright e2e selectors — re-run e2e after.

## Constraints

- Preserve brand tokens (no new colors, no new fonts)
- No new dependencies
- No backend changes
- Backward-compatible deep links (`/settings?tab=*`, `/#section-id`)