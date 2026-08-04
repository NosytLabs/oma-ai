# OMA AI Gateway

**Website:** https://oma-ai.com  
**Version:** 2.1.0  
**Status:** Local dev (pre-launch)  
**Brand:** Open Model Access · void `#07090a` · accent `#46d39a` · see `BRAND.md`

Self-hosted AI inference gateway. Modern UI/UX (motion system, accessibility, multi-model chat), OpenAI-compatible API, crypto payments, and a comprehensive Vitest suite.

> **Recent Changes:**
> - UI/animation is now fully centralized (see `/app/src/lib/animation`)
> - CTAs/buttons standardized with strong accessibility
> - SVGs/logos all ARIA-compliant for screen readers
> - Docs/audits/compliance assets pruned & compressed for clarity
> - Coverage now includes robust Playwright, Vitest, and regression/flow tests

---

## Features

### Payment Methods
- **USDC on Base** — direct deposit/settlement
- **x402 Payments** — per-request AI agent receipts

### Developer Features
- **OpenAI-Compatible** API, streaming/chat, model catalog (22 curated models, not 90+)
- **Key Management** — dashboard/spa (`/dashboard?tab=api-keys`)
- **Rate Limiting** — per-key, per-model

---

## Quick Start
(Fast onboarding: see full details above)
1. Clone repo, copy envs from `.env.example` as needed
2. Start dev with `./scripts/start-dev.sh`
3. See `/app/src/lib/animation` for UI/UX architecture and the Vitest suites under `/app/src` and `/server/src`

---

## Modern UI/UX & Animation
- **All animation/motion** logic and primitives centralized in `/app/src/lib/animation` (`index.ts` re-exports the primitives: `Magnetic`, `SpringCard`, `ElasticCounter`, `TabPill`, springs, variants).
- **Accessible chat UX** — keyboard accessible, full ARIA coverage, screen reader flows tested (see `/app/src/components/chat/`).
- **All CTAs/buttons** use design-system primitives (`Button`, `JuiceButton`, `Badge`): full color/contrast, focus, and sized for accessible tap targets.
- **SVGs/logos** are ARIA-compliant (titles, desc, aria-label/hidden). No decorative SVG escapes contrast/scannability review.
- **Fully responsive** for desktop/mobile, with layout/padding/focus patterns tested.

---

## Testing & QA
- **Unit/integration**: Vitest covers both packages (apps + server routes, middleware, libs, components).
- **CI:** `npm run validate` runs typecheck + lint + tests for both packages. See `/app/src/**/__tests__`, `/server/src/**/__tests__`.
- **Audit scripts:** `scripts/axe-audit.mjs`, `scripts/audit-site-2026-07-31.js`, `scripts/ux-audit-pages.mjs`, and `scripts/validate-launch.sh` provide a11y/UX/launch checks.
- **Coverage philosophy:** 80%+ for business logic/critical flows, full coverage for P0 payment/gateway/PII/security.
- **New tests:** When shipping a new endpoint or UI, include a matching test.

---

## Contributing
- Modern animation, UI/UX, and test patterns live in `/app/src/lib/animation`, `/app/src/components`, and the `__tests__` directories next to the code they cover.
- Add new providers/API/support flows as described in `/app/src/lib/models-data.ts` and `/server/src/routes/…`.
- Run `npm run validate` before opening a PR.
- For questions, open an issue.

---

## Documentation & Compliance
- Only compliance-mandatory audits/reports remain in `/docs/` (old reports archived under `/docs/archive/`).
- **BRAND.md** documents design token philosophy, logos, and accessibility checklist.

See `app/public/llms.txt` and `server/src/routes/openapi.ts` for the public API surface. For full dev, see the scripts in `/scripts`.

---

## Disclaimer
<unchanged>
