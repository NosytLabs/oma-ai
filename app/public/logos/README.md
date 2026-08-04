# OMA brand assets (live site)

Canonical visual identity for **OMA · Open Model Access**.
Full voice and token rules: repo-root `BRAND.md`.

Source kit (SVG geometry + Imagine-polished rasters for press/export):
**`brand-kit/`** — see `brand-kit/README.md`. Prefer editing kit sources, then
copying sized outputs into this directory and `app/public/` favicon paths.

## Mark

Open emerald ring with a terminal chevron and a signal dot at the opening.
Do not redraw it, close the ring, recolor it, or place it on a busy background.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| Void | `#07090a` | Primary dark canvas and icon keyline |
| Panel | `#0d1110` | Icon inset and elevated surfaces |
| Accent | `#46d39a` | Gateway ring, chevron, signal |
| Accent bright | `#6ee7b7` | Signal highlight and hover state |
| Text bright | `#f5f7f3` | Wordmark and headlines |
| Text muted | `#9aa394` | Supporting labels |

## Live files in this folder

| File | Use |
| --- | --- |
| `oma-icon.svg` | Master mark (vector) |
| `oma-icon-192.png` / `512` / `1024` | PWA / press |
| `oma-logo.svg` | Horizontal lockup |
| `oma-wordmark.svg` / `.png` | Wordmark + tagline |
| `oma-brand-card.svg` / `.png` | Social / press card |
| `providers/*.svg` | Model provider tiles (`ModelLogo` fallbacks) |

Favicons live one level up in `app/public/` (`favicon.svg`, `favicon-*.png`, `apple-touch-icon.png`).

Regenerate flat PNG icons from SVG: `npm run brand:generate` in `app/` (needs `rsvg-convert`).

## Safe use

- Keep aspect ratio and clear space of at least one signal-dot diameter.
- Prefer SVG for web UI; PNG for social and app metadata.

- The public Open Graph image remains `/og-image.webp`; the brand card is the downloadable press/social variant.

The inline React logo at `src/components/ui/oma-logo.tsx` intentionally shares this same geometry while inheriting runtime theme tokens.
