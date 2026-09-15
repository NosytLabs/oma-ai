# Brand & Voice Guidelines

Welcome to the brand guidelines for **OMA AI** (**Open Model Access**). This document outlines our visual identity, brand voice, design tokens, and user experience standards.

- **Primary Domain:** `oma-ai.com`
- **Slogan:** *"One gateway. Every model. No lock-in."*
- **Developer Tagline:** *"OpenAI-compatible inference for builders."*

---

## Visual Identity

### Color Tokens

| Token | Hex Value | Primary Application |
| :--- | :--- | :--- |
| **Void** | `#07090a` | Global page background, logo plate base |
| **Panel** | `#0d1110` | Interactive cards, modals, and elevated surface panels |
| **Accent (Emerald)** | `#46d39a` | Brand primary color, critical CTAs, logo mark |
| **Accent Bright** | `#6ee7b7` | Active hover states, focus rings, subtle glows |
| **Text Bright** | `#f5f7f3` | High-priority headlines and page titles |
| **Text** | `#d8dcd6` | Standard body copy and secondary labels |
| **Text Muted** | `#9aa394` | Meta-labels, disabled states, captions (verified $\ge$ 4.5:1 contrast on void) |

### The Logo Mark

The OMA AI Logo represents an **open gateway aperture**:
- A broken emerald ring opened at the 3 o'clock position (signifying *open access*).
- A terminal-style prompt chevron (`>`) pointing outward through the opening.
- A live signal dot floating inside the gap (symbolizing *token emission*).

Our browser favicon features a transparent background with a hairline void keyline to ensure visibility on both light and dark browser tabs. Badges sit on a solid void terminal plate.

### Logo & Asset Registry

| Asset | Project Path | Description |
| :--- | :--- | :--- |
| **UI Component** | `app/src/components/ui/oma-logo.tsx` | Pure vector React component for inline rendering |
| **Vector Favicon** | `app/public/favicon.svg` | Transparent, multi-tab safe browser favicon |
| **Master Icon Badge** | `app/public/logos/oma-icon.svg` | Master void badge SVG (the source for raster conversions) |
| **Raster Favicons** | `app/public/favicon-16x16.png`, `favicon-32x32.png` | Standard browser tab fallback graphics |
| **App Icons** | `app/public/logos/oma-icon-192.png`, `oma-icon-512.png` | Manifest assets generated directly from `oma-icon.svg` |
| **Lockup Logo** | `app/public/logos/oma-logo.svg` | Formal horizontal logo lockup with wordmark |
| **Wordmark Alias** | `app/public/logos/oma-wordmark.svg` | Same lockup as `oma-logo.svg` (stable URL for external consumers) |
| **Apple Touch Icon** | `app/public/apple-touch-icon.png` | iOS home-screen icon featuring a solid void background |
| **Open Graph Card** | `app/public/og-image.webp` | 1280×720 branding image (includes slogan, no raw hex codes) |
| **Marketing kit** | `app/public/logos/brand-kit/` | Promo/lockup rasters only — not a second copy of live vectors |

> **Raster Editing Note:** Derive raster outputs from the existing icon SVG/PNG sources. Do not freeform-regenerate SVG structures. Render and deploy sized PNG outputs directly to their correct public directories.

### Brand Kit Checklist

Before a production deployment, ensure the following core assets are correctly verified:
- [ ] `favicon.svg` is used for modern browser tabs (primary target).
- [ ] `favicon-16x16.png` and `favicon-32x32.png` are correctly compiled as legacy fallbacks.
- [ ] `apple-touch-icon.png` is optimized for high-density mobile displays.
- [ ] `logos/oma-icon-192.png` and `logos/oma-icon-512.png` are declared in the PWA manifest.
- [ ] `logos/oma-logo.svg` is used for official marketing collaterals.
- [ ] `og-image.webp` contains our accurate slogan (no technical color codes).
- [ ] `oma-logo.tsx` correctly handles current CSS theme tokens.

---

## Typography & Nomenclature

- **Wordmark Style:** Lowercase `oma` using sans-serif typography with tight letter-tracking.
- **Tagline Text:** Monospace typography rendering `OPEN MODEL ACCESS`.
- **Accent Themes:** The dark "void" background is fixed globally. Users can switch their primary **Accent Color** via the `ThemeToggle`:
  - `emerald` (Default brand color)
  - `amber`
  - `mono`
  - `synth`
  - *Warning:* Never introduce orange (`#f97316`) as an active brand accent (legacy design drift).

---

## Core Messaging

### 1. Value Proposition (Homepage / Hero)
> *"Open Model Access for AI builders."*
>
> Route prompts across private, open-source, and commercial models seamlessly using a single, unified, OpenAI-compatible API interface.

### 2. Privacy & Sovereign Execution
> *"Private AI inference powered by Venice. Zero data retention on prompt content."*
>
> Deploy as a self-hosted instance for ultimate control. Leverage secure magic-link or cryptographic SIWE authentications, alongside free daily guest chats on OMA-AI models.

### 3. Decentralized Payments
> *"Crypto-friendly credits. Pay with crypto, build with one API."*
>
> Instantly fund developer credits using USDC on Base or utilize low-overhead `x402` verify/settle funding for autonomous agents.

---

## Brand Voice & Terminology

Our positioning is centered around **sovereignty, privacy, and low-friction utility**. We emphasize clean developer tooling without falling into shady or legally ambiguous wording.

### What OMA IS vs. IS NOT

| OMA is... | OMA is NOT... |
| :--- | :--- |
| A high-performance, private AI inference gateway | An anonymous or untraceable tool for illicit activities |
| A secure gateway with zero prompt data retention | A tool designed to bypass regulatory protocols |
| An active integration hub supporting **20 curated models** (18 Venice + 2 OMA-AI) | An unbounded, noisy, unvetted AI model marketplace |
| A crypto-native builder utility supporting USDC and `x402` | An underground dark-web platform |

### Preferred Terms (USE)

| Category | Recommended Wording | Reason |
| :--- | :--- | :--- |
| **Authentication** | Low-friction signup · Cryptographic SIWE sign-in · Wallet-based auth | Professional, secure, and developer-aligned. |
| **Privacy** | Privacy-first · Private inference · Zero data retention · Self-hosted control | Focuses on professional-grade data ownership and security. |
| **Developer UX** | Developer-first · OpenAI-compatible API · Extensively documented API | Highlights seamless developer integration and compatibility. |
| **Payments** | Crypto-friendly credits · USDC on Base deposits · Pay-as-you-go billing | Clear, accurate description of blockchain-based credits. |
| **Infrastructure**| Self-hosted deployment · Multi-provider routing · Circuit-breaker failover | Emphasizes system resilience and architectural control. |

### Words to Avoid

| Avoid | Why | Use instead |
| :--- | :--- | :--- |
| **No KYC** | Heavy regulatory compliance flag | *"Low-friction signup"* or *"Wallet-based auth"* |
| **Anonymous** | Implies absolute untraceability and evasion | *"Private"* or *"Privacy-first"* |
| **Untraceable** | Factually inaccurate and introduces legal liability | *"No data retention"* or *"Self-hosted option"* |
| **Dark / Underground** | Associates the product with illicit black markets | *"Self-hosted"* or *"Crypto-native"* |
| **Cheap** | Cheapens and devalues the technology stack | *"Cost-effective"* or *"Competitive pricing"* |
| **Bypass** | Implies security circumvention or unauthorized access | *"Skip"* or *"Avoid unnecessary friction"* |

---

## Design System & Components

### Typography Hierarchy

| Role | Typography Font Family | Character / Tone |
| :--- | :--- | :--- |
| **Display & Headers**| *Instrument Serif* | Editorial, striking, highly polished |
| **Body Text** | *Geist Sans* | Clean, highly legible, modern |
| **Monospace / Code** | *Geist Mono* | Structured, technical, precise |

### Interactive Buttons

A single CSS-only button system is the source of truth (no React
component — see `app/src/app/globals.css` "Buttons"). Compose by stacking
the base `.btn-mono` slab with a modifier class:

| Modifier | Application Role | Visual Style |
| :--- | :--- | :--- |
| `.btn-primary` | Primary action CTAs | Emerald background, void text |
| `.btn-secondary` | Secondary page actions | Bordered surface container |
| `.btn-ghost` | Tertiary text links | Text-only action, subtle hover background |
| `.btn-outline` | Quiet interactive borders | Bordered outline with no container fill |
| `.btn-destructive` | Irreversible actions | Warning red colors |
| `.btn-mono` + `.btn-primary` | Brand mono slab CTA (the "Get API key" shape) | Sharp-corner mono uppercase + emerald |

- **Layout Constraint:** Standard touch surfaces on primary CTAs must maintain a height of **44–48px**.
- **The Color Rule:** Never use orange (`#f97316`) for active system branding.

### Layout Dimensions

- **Max Grid Width:** Constrained to `max-w-6xl` or `.container-page` (72rem / 1152px).
- **Horizontal Paddings:** Structured responsive scaling: `px-4` $\rightarrow$ `sm:px-6` $\rightarrow$ `lg:px-8`.
- **Vertical Spacing:** Generous marketing row height (`py-12` to `py-20`); denser workspace sizing for administrative interfaces.

### Navigation Hierarchy

- **Global Navigation:** Stick header fixed at `h-14` featuring standard backdrop-blur glass filters upon scroll.
- **Primary Pages:** Models · Chat · Pricing · Docs.
- **Tools Dropdown** (secondary, off the primary path): Buy credits · API Reference · Agents & IDEs · Get started · FAQ.
- **Account Panel** (signed-in): Dashboard · Settings · Buy credits · Sign out.
- **Account Panel** (signed-out): single "Get API key" CTA → `/login`.
- **Mobile Menu:** Hamburger at `<lg` opens a full-screen menu grouping Primary + Tools + Account.
- **Theme Dropdown:** emerald (default) · amber · mono · synth.
- **Admin:** `/admin` route is operator-gated (server check on `user.role === 'admin'`). Not surfaced anywhere in `primaryLinks`, `toolsLinks`, or footer columns. Admins only land there by typing the URL.
- **Legacy Redirects:** All `/swap` actions permanently route to `/deposit`.
- **Agent Session Demos:** Interactive terminal structures inspired by the `AgentSessionDemo` layout should only be used inside marketing or documentation surfaces. Live chat flows must remain native.

---

## Client Authentication Lifecycle

1. **Primary Interface:** Web3-ready Sign-In with Ethereum (SIWE) is rendered as the primary login trigger on `/login`.
2. **Alternative Methods:** Users can fall back to standard email magic-links. *(Future iterations reserve a 16-digit account-number protocol)*.
3. **Agent Integration:** Programmable agents fund via x402 verify/settle (EIP-3009 USDC on Base), then spend with an API key against the credited balance.

**Session Storage:** Upon successful validation, the system establishes a highly secure `HttpOnly` cookie labeled `oma_session` containing the required client metadata. All subsequent frontend API requests are proxied via standard `/api/*` structures, passing the validated session to the Hono backend under standard `Authorization: Bearer <token>` schemas.
