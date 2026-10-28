# Brand & Voice Guidelines

**OMA AI** means **Open Model Access**. This reference owns visual identity
and product language. [Platform documentation](docs/PLATFORM.md) owns behavior
and operator configuration; [deployment documentation](docs/DEPLOYMENT.md)
owns production topology and release instructions.

- Canonical host: `www.oma-ai.com`.
- Slogan: “One gateway. Every model. No lock-in.”
- Developer tagline: “OpenAI-compatible inference for builders.”
- Positioning: a privacy-first inference gateway for developers, with a curated
  catalog, multi-provider routing and self-hosted deployment options.

## Design sources

Use the implementation sources below instead of copying token values into docs.

| Source | Owns |
| --- | --- |
| [`app/src/app/globals.css`](app/src/app/globals.css) | Live color tokens, type scale, spacing, buttons, focus and reduced-motion styles |
| [`app/src/lib/themes.ts`](app/src/lib/themes.ts) | Supported theme IDs and default theme |
| [`app/src/app/layout.tsx`](app/src/app/layout.tsx) | Loaded fonts and page metadata |
| [`app/src/lib/brand-mark.json`](app/src/lib/brand-mark.json) | Shared logo geometry |
| [`app/src/components/ui/oma-logo.tsx`](app/src/components/ui/oma-logo.tsx) | Inline React mark and lockups |
| [`app/scripts/brand-generate.mjs`](app/scripts/brand-generate.mjs) | Deterministic exported SVG, PNG, ICO and optional marketing assets |

The canvas stays dark. Themes change the accent: `emerald` is the default;
`amber`, `mono` and `synth` are supported alternatives. Inline marks inherit
the current accent; exported brand assets use emerald on a void plate or a
transparent background as appropriate. Do not introduce orange as a brand accent.

UI text colors come from the live CSS tokens. The fixed colors used in exported
graphics are maintained by the generator; they are not a second UI theme.
When changing shared brand colors, review CSS, `app/src/lib/brand.ts` and the
generator together, including manifest colors and contrast.

## Logo and public assets

The mark is a folded O/M loop with two rounded peaks and a continuous lower
loop, paired with an uppercase `OMA` wordmark. Preserve its proportions and
clear space; never stretch it or crop its peaks. Browser/app icons use a solid
void plate. The maskable icon has a separate padded safe-zone export.

These paths are relative to `app/public/` and are public URL contracts.

| Asset | Paths and purpose |
| --- | --- |
| Browser icons | `favicon.svg`, `favicon-16x16.png`, `favicon-32x32.png`, `favicon.ico`; the ICO contains 16, 32 and 48 pixel entries |
| Apple icon | `apple-touch-icon.png` at 180×180 |
| PWA icons | `logos/oma-icon-{192,512,1024}.png`, `logos/oma-icon-maskable-512.png`; all are used by the manifest |
| Vector mark/badge | `logos/oma-mark.svg` (transparent), `logos/oma-icon.svg` (void badge) |
| Lockups | `logos/oma-logo.svg`, `logos/oma-wordmark.svg`, `logos/oma-wordmark.png`; the wordmark SVG is a stable alias of the logo SVG |
| Brand cards | `logos/oma-brand-card.svg`, `logos/oma-brand-card.png` |
| Open Graph card | `og-image.png` at 1280×720, carrying the current slogan |
| Provider/payment marks | `logos/providers/`, `payment-methods/`; maintained separately from the OMA generator |
| Notices | `licenses/third-party-notices.txt`, `.well-known/security.txt`; retain their published paths |

Run `pnpm --filter app brand:generate` after changing shared geometry. It
regenerates deployed assets using Sharp; do not hand-edit copies of the mark.
Run `pnpm --filter app brand:generate --brand-kit` only when promotional files
are needed. It additionally exports `oma-icon-promo.jpg`,
`oma-lockup-horizontal.png`, `oma-lockup-horizontal.jpg` and
`oma-brand-card.png` to the ignored `artifacts/brand-kit/` directory outside
the deployed public tree.

Provider mappings live in `app/src/components/ui/model-logo.tsx`. Preserve
computed filenames and configured local fallbacks when auditing assets.
Unmapped providers use colored initials. Ethereum intentionally uses initials;
the Venice SVG remains required by model-page structured data.
Most primary tiles originate from
[homarr-labs/dashboard-icons](https://github.com/homarr-labs/dashboard-icons);
Mercury, Coinbase and Gonka are custom. Validate new tiles at 20–36 pixels,
check their viewBox, and keep local logo tests aligned with mappings. Preserve
provider colors, including the white OpenAI tile used on the dark canvas.

## Typography, controls and accessibility

- Use Instrument Serif for editorial display headings and Geist for body text
  and account/workspace headings (`h1-utility`). Space Grotesk supports metric
  and specification treatments. Code and metadata use the CSS monospace stack.
- Use shared CSS color, spacing and typography tokens. Primary actions use the
  current `accent`; destructive actions use `error`.
- Choose `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-outline` or
  `.btn-destructive` by purpose. Add `.btn-mono` for the sharp, uppercase brand
  treatment; its destructive combination is `.btn-mono.btn-danger`.
- Keep primary touch targets 44–48 pixels high. Preserve visible keyboard focus,
  meaningful control labels and disabled states; honor reduced-motion preferences.
- Maintain at least 4.5:1 contrast for normal text against its actual surface.
  Check each supported accent theme when changing colors or controls.
- Use `.container-page` / `max-w-6xl` for the main content width and shared
  responsive padding. Marketing sections can breathe; workspaces stay denser.

## Product language

Write plainly for developers: emphasize privacy, control, reliable routing and
low-friction utility. Prefer “OpenAI-compatible API,” “wallet sign-in,”
“passwordless email,” “self-hosted,” “competitive pricing” and “USDC on Base.”
Avoid “anonymous,” “untraceable,” “No KYC,” “dark/underground,” “cheap” and
claims about bypassing safeguards.

- Say: “OMA does not persist prompt or completion content. Provider policies
  depend on the selected model.” Do not extend OMA's storage promise into a
  claim about upstream retention or training.
- Describe funding as USDC on Base, card checkout when available, or x402
  verify/settle funding. API requests use developer credits; eligible OMA-AI
  models may have a separate free daily browser-chat allowance.
- Describe supported email and SIWE wallet sign-in without inventing future
  account formats or promising unavailable authentication methods.
- Derive live availability and model counts from live catalog data. A fallback
  catalog is not evidence of live capacity.
- Label simulated request/response animations as illustrations. Do not imply a
  live request or a free API call. Keep terminal demos on marketing/docs surfaces.
- Settings previews preserve `demo=1` across navigation and keep account actions
  and preferences read-only.
