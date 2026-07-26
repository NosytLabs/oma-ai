# Brand & Voice

**Brand:** OMA AI = **Open Model Access**. Domain: `oma-ai.com`.

**Slogan:** *"One gateway. Every model. No lock-in."*
**Dev tagline:** *"OpenAI-compatible inference for builders."*

### Visual Identity

| Token | Value | Usage |
|-------|-------|--------|
| **Void** | `#07090a` | Page background, logo plate |
| **Panel** | `#0d1110` | Cards, elevated surfaces |
| **Accent (Emerald)** | `#46d39a` | Brand primary, CTAs, logo mark |
| **Accent bright** | `#6ee7b7` | Hover / glow |
| **Text bright** | `#f5f7f3` | Headlines |
| **Text** | `#d8dcd6` | Body |
| **Text muted** | `#9aa394` | Meta / captions (≥4.5:1 on void) |

**Mark:** Open gateway — rounded terminal badge, open emerald ring (gap = open access), three ascending signal bars (multi-model throughput), live LED at the gap.

| Asset | Path |
|-------|------|
| UI component | `app/src/components/ui/oma-logo.tsx` |
| Vector favicon (source of truth) | `app/public/favicon.svg` |
| Raster favicons | `app/public/favicon-16x16.png`, `favicon-32x32.png` (regenerate from SVG) |
| App icon 192 / 512 | `app/public/logos/oma-icon-192.png`, `oma-icon-512.png` |
| Lockup SVG | `app/public/logos/oma-logo.svg` |
| Apple touch | `app/public/apple-touch-icon.png` |
| Open Graph 1280×720 | `app/public/og-image.webp` |

Regenerate PWA/tab rasters from SVG (always after mark edits):

```bash
rsvg-convert -w 16 -h 16 app/public/favicon.svg -o app/public/favicon-16x16.png
rsvg-convert -w 32 -h 32 app/public/favicon.svg -o app/public/favicon-32x32.png
rsvg-convert -w 180 -h 180 app/public/favicon.svg -o app/public/apple-touch-icon.png
rsvg-convert -w 192 -h 192 app/public/favicon.svg -o app/public/logos/oma-icon-192.png
rsvg-convert -w 512 -h 512 app/public/favicon.svg -o app/public/logos/oma-icon-512.png
```

### Brand kit (ship checklist)

| File | Use |
|------|-----|
| `favicon.svg` | Browser tab (preferred) |
| `favicon-16x16.png` / `favicon-32x32.png` | Fallback tabs (SVG preferred) |
| `apple-touch-icon.png` | iOS home screen |
| `logos/oma-icon-192.png` / `oma-icon-512.png` | PWA / manifest (flat SVG-derived) |
| `logos/oma-logo.svg` | Marketing lockup (vector) |
| `og-image.webp` | Open Graph 1280×720 (slogan, no hex codes) |
| `oma-logo.tsx` | In-app React mark (CSS tokens / theme accents) |

Do not invent a second mark. Live site may lag until deploy; local `app/public` is source of truth.

**Wordmark:** lowercase `oma` (sans, tracking tight). Tagline mono: `OPEN MODEL ACCESS`.

**Themes:** Dark void is fixed. Users may switch **accent only** via ThemeToggle: emerald (default) · amber · mono · synth. Never ship orange (`#f97316`) as brand — that was a legacy drift.

### Core Messages

- **Primary (homepage / hero):** *"Open Model Access for AI builders."* Route prompts across private, open, and commercial models through one OpenAI-compatible API.
- **Privacy angle:** *"Private AI inference powered by Venice. Zero data retention on prompt content."* Self-hosted deployment option for maximum data control; wallet-based auth (no account required).
- **Payment angle:** *"Crypto-friendly credits. Pay with crypto, build with one API."* USDC on Base, 20+ chains via LI.FI / CCTP, x402 for agent-native billing.

### What OMA IS vs. IS NOT

**Is:** AI inference gateway · private access layer (zero data retention, self-hosted option) · Venice-powered backend with Gonka failover · credit-based billing · multi-provider routing with circuit-breaker failover · crypto-native payments (x402, LI.FI / CCTP, 20+ chains) · wallet-based auth (SIWE) · OpenAI-compatible API.

**Not designed for:** illicit use. OMA is a professional tool for developers who value privacy, control, and crypto-native payments. Position as "low-friction signup", not "no KYC"; "private inference", not "anonymous"; "privacy-focused", not "untraceable".

### Words to USE

| Category | Preferred terms |
|----------|-----------------|
| Auth & signup | Low-friction signup · instant API access · wallet-based auth · SIWE sign-in |
| Privacy | Privacy-first · private inference · zero data retention · self-hosted control |
| Developer experience | Developer-first · OpenAI-compatible · comprehensive API · extensive model support |
| Payments | Crypto-friendly · pay-as-you-go · credit-based billing · cross-chain deposits |
| Technical | Self-hosted · multi-provider routing · circuit breaker · failover ready |
| Value | Cost-effective · competitive pricing · no lock-in · full control |

### Words to AVOID

| Avoid | Why | Use instead |
|-------|-----|-------------|
| No KYC | Regulatory red flag | "Low-friction signup" / "Wallet-based auth" |
| Anonymous | Implies untraceable | "Private" / "Privacy-first" |
| Untraceable | Absolute claim / legal exposure | "No data retention" / "Self-hosted option" |
| Dark / Underground | Illicit association | "Self-hosted" / "Crypto-native" |
| Cheap | Devalues offering | "Cost-effective" / "Competitive pricing" |
| Bypass | Implies circumventing | "Skip" / "Avoid friction" |

---

## Design System

**Aesthetic:** Crypto terminal × editorial — near-black void, single emerald accent, generous space.

### Typography

| Role | Family |
|------|--------|
| Display | Instrument Serif |
| Body | Geist |
| Mono | Geist Mono |

### Buttons (use `Button` or CSS primitives)

| Class / variant | Role |
|-----------------|------|
| `btn-primary` / `primary` | Primary CTA — emerald fill, void text |
| `btn-secondary` / `secondary` | Secondary — bordered surface |
| `btn-ghost` / `ghost` | Tertiary text actions |
| `outline` | Quiet bordered |
| `destructive` | Danger |

Rules:

- Prefer design-system `Button` in app surfaces (dashboard, settings, auth).
- Marketing pages may use `.btn-primary` / `.btn-secondary` for Links.
- Min touch height **44–48px** on primary CTAs.
- Never use orange (`#f97316`) as brand.

### Layout

- Max content width: `max-w-6xl` / `.container-page` (72rem).
- Horizontal padding: `px-4` → `sm:px-6` → `lg:px-8`.
- Section vertical rhythm: `py-12`–`py-20` on marketing; denser on dashboard.

### Navigation

- Sticky header `h-14`, glass when scrolled.
- Primary: Models · Chat · Pricing · Docs · Compare (Title Case).
- Tools dropdown: Network · Observability · Changelog.
- Account: Dashboard · Settings · Sign in (footer + mobile).
- Retired: `/swap` → `/deposit` (permanent redirect).
- Agent session demos: OMA-themed terminal block inspired by [brainless](https://github.com/theswerd/brainless) (`AgentSessionDemo`) — marketing/docs only; live chat stays product-owned.

### Auth UX

1. **Wallet (SIWE)** — default on `/login`
2. **Account number** — `/login?method=account` (16 digits)
3. **x402** — agent pay-per-request (docs)

After login: session is HttpOnly `oma_session` + client meta; all browser API calls go through `/api/*` so the cookie becomes `Authorization: Bearer`.
