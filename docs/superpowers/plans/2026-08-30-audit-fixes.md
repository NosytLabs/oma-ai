# OMA AI — Audit & Fixes Implementation Plan

**Date:** 2026-08-30
**Status:** Ready for execution
**Scope:** UI/UX polish, bug fixes, dead code cleanup, missing assets

---

## Summary

After a thorough audit of the entire codebase (frontend routes, components, charts, models, admin, pricing, x402, docs, favicon/OG/sitemap, tests), the project is **mature and well-built**. The issues found are minor — no architectural problems, no broken core flows. This plan covers the real bugs and polish items.

---

## Phase 1: Real Bugs (Must Fix)

### 1.1 Missing `manifest.webmanifest`
- **File:** `app/public/manifest.webmanifest` (does not exist)
- **Referenced:** `app/src/app/layout.tsx:110` — `manifest: "/manifest.webmanifest"`
- **Impact:** Browser 404 on every page load for PWA manifest
- **Fix:** Create `app/public/manifest.webmanifest` with OMA branding, dark theme color, icons
- **Also:** Reference existing favicon files in the manifest

### 1.2 Footer Copyright Year
- **File:** `app/src/components/footer.tsx`
- **Check:** Verify copyright says 2026 (current year). If hardcoded to 2025, update.

---

## Phase 2: UI/UX Polish

### 2.1 Dashboard Layout Spacing
- **File:** `app/src/app/dashboard/page.tsx`
- **Check:** Tab content padding consistency, card spacing, responsive breakpoints
- **Verify:** API Keys tab, Usage tab, Providers tab render cleanly at mobile/tablet/desktop

### 2.2 Settings Layout Spacing
- **File:** `app/src/app/settings/page.tsx`
- **Check:** Mobile horizontal scroll tabs, keyboard navigation, deep-link support all work
- **Verify:** Danger zone section has proper separation/warning styling

### 2.3 Chat UI/UX
- **File:** `app/src/app/chat/page.tsx`, chat components
- **Check:** ThinkingOrb loading state renders, message input spacing, model selector alignment
- **Verify:** Mobile responsive layout, keyboard shortcuts work

### 2.4 Models Page
- **File:** `app/src/app/models/page.tsx`
- **Check:** Search, tier filters, provider filters, modality filters all functional
- **Verify:** Model cards align properly, context range and price range sliders work

### 2.5 Pricing Page
- **File:** `app/src/app/pricing/page.tsx`
- **Check:** Credit pack cards (Hobby/Builder/Scale) render Polar checkout correctly
- **Verify:** FAQ accordion opens/closes, tier filter works, model cost table displays

---

## Phase 3: Charts & Data Display

### 3.1 Usage Charts
- **Files:** `app/src/components/dashboard/UsageChart.tsx`, `AreaChart.tsx`, `DonutChart.tsx`
- **Check:** Dual Y-axis (requests + cost) renders correctly
- **Verify:** Donut chart center total displays, gradient IDs don't collide
- **Check:** ProviderBreakdown filters out "surplus" provider correctly

### 3.2 Dashboard Stats
- **Check:** Recent requests table renders with proper pagination
- **Check:** Credit balance card shows correct data
- **Check:** Expiring credits warning triggers at correct threshold

---

## Phase 4: Dead Code & Cleanup

### 4.1 Models Data Cleanup
- **File:** `app/src/lib/models-data.ts`
- **Current state:** 22 models (18 Venice + 4 OMA-AI). DRIFT GUARD. Modality types include image/video/tts/embedding/asr/music/upscale/inpaint — these are **forward-compatible defensive code**, not dead code.
- **Decision:** Leave modality types as-is. They guard against future model additions breaking the type system.
- **Optional:** Remove `MODALITY_LABELS` entries for unused modalities if desired, but low value.

### 4.2 Unused Component Check
- **Result:** All components in the codebase are imported and used. No orphaned files found.
- **No cleanup needed.**

### 4.3 Docs/MDS Cleanup
- **Check:** Verify no broken internal links in docs pages
- **Check:** Verify llms.txt is served correctly

---

## Phase 5: Admin Features

### 5.1 Admin Page Audit
- **File:** `app/src/app/admin/page.tsx`
- **Check:** Ops snapshot renders, user management search works
- **Verify:** Site settings (kill switches) toggle correctly
- **Verify:** Rate-limit overrides save properly
- **Check:** Provider health display shows correct data

---

## Phase 6: Missing Features (Nice-to-Have)

### 6.1 PWA Manifest (from Phase 1)
- After creating manifest.webmanifest, the site becomes PWA-installable

### 6.2 Model Detail Pages
- **File:** `app/src/app/models/[slug]/page.tsx`
- **Check:** generateStaticParams generates correct slugs
- **Verify:** Pricing info, provider info, context window all display

---

## Execution Order

1. Create `manifest.webmanifest` (Phase 1.1)
2. Fix footer copyright if needed (Phase 1.2)
3. Run build to verify no errors
4. Visual spot-check of dashboard/settings/chat layouts
5. Charts rendering verification

---

## Out of Scope (No Changes Needed)

- **Architecture:** Well-structured monorepo, clean separation
- **Core flows:** Auth, chat, billing, x402 all properly implemented
- **Favicon/OG:** All assets present and properly referenced
- **Sitemap/robots:** Correctly configured
- **Models:** All 22 models properly curated with pricing
- **Security:** Rate limiting, auth middleware, demo mode guards all in place
- **Tests:** Comprehensive vitest coverage across routes, inference, x402, auth
