# OMA Design System

**Product:** Open Model Access (oma-ai.com)  
**Aesthetic:** Crypto terminal × editorial — near-black void, single emerald accent, generous space.

## Brand tokens

| Token | Value | Use |
|-------|--------|-----|
| Void | `#07090a` | Page background |
| Panel | `#0d1110` | Cards / elevated surfaces |
| Accent | `#46d39a` | Primary CTAs, mark, focus rings |
| Accent bright | `#6ee7b7` | Hover / LED |
| Text bright | `#f5f7f3` | Headlines |
| Text | `#d8dcd6` | Body |
| Text muted | `#9aa394` | Meta / captions (≥4.5:1 on void) |

**Mark:** Open gateway — rounded badge, open emerald ring (gap = open access), three ascending signal bars, live LED at the gap.  
**Assets:** `app/public/favicon.svg` (source), rasters under `app/public/`, React `OmaLogo`.

## Typography

| Role | Family |
|------|--------|
| Display | Instrument Serif |
| Body | Geist |
| Mono | Geist Mono |

## Components

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
- Primary: Models · Chat · Pricing · Docs (Title Case).
- Tools dropdown: Network · Observability · Changelog.
- Account: Dashboard · Settings · Sign in (footer + mobile).
- Retired: `/swap` → `/deposit` (permanent redirect).
- Agent session demos: OMA-themed terminal block inspired by [brainless](https://github.com/theswerd/brainless) (`AgentSessionDemo`) — marketing/docs only; live chat stays product-owned.


## Voice

| Prefer | Avoid |
|--------|--------|
| Low-friction signup | No KYC / anonymous |
| Wallet-based auth / account number | Underground / dark |
| Cost-effective | Cheap |
| Private inference / zero retention | Untraceable |

**Slogan:** *One gateway. Every model. No lock-in.*

## Auth UX

1. **Wallet (SIWE)** — default on `/login`
2. **Account number** — `/login?method=account` (16 digits)
3. **x402** — agent pay-per-request (docs)

After login: session is HttpOnly `oma_session` + client meta; all browser API calls go through `/api/*` so the cookie becomes `Authorization: Bearer`.

## Local dev

```bash
./scripts/local-db-up.sh
# server/.env → DATABASE_URL=postgresql://oma:***@127.0.0.1:5432/oma
cd server && npm run dev   # :3001
cd app && npm run dev      # :3000
```
