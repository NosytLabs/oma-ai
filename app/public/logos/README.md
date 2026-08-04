# OMA brand kit

Canonical visual identity for **OMA · Open Model Access**.

## Mark

The OMA gateway mark is an open emerald ring with a terminal chevron and a signal dot at the opening. The opening represents model access without a locked-in provider; the signal dot represents an active request leaving the gateway.

Use the mark as supplied. Do not redraw it, close the ring, recolor it, add drop shadows, or place it on a busy background.

## Tokens

| Token | Value | Use |
| --- | --- | --- |
| Void | `#07090a` | Primary dark canvas and icon keyline |
| Panel | `#0d1110` | Icon inset and elevated surfaces |
| Accent | `#46d39a` | Gateway ring, chevron, signal |
| Accent bright | `#6ee7b7` | Signal highlight and hover state |
| Text bright | `#f5f7f3` | Wordmark and headlines |
| Text muted | `#9aa394` | Supporting labels |

## Files

- `oma-icon.svg` — editable master icon, 48 × 48
- `oma-icon-192.png` — PWA/app icon
- `oma-icon-512.png` — PWA/app icon and structured-data logo
- `oma-icon-1024.png` — high-resolution export for app stores and press kits

Regenerate the PNG icon exports from the canonical SVG with `npm run brand:generate` from `app/` (requires `rsvg-convert`, or set `RSVG_CONVERT` to its path).
- `oma-logo.svg` — horizontal lockup with transparent background
- `oma-wordmark.svg` — horizontal lockup with full tagline
- `oma-wordmark.png` — raster lockup for tools that do not accept SVG
- `oma-brand-card.svg` — 1200 × 630 social/press composition
- `oma-brand-card.png` — raster social/press composition

## Safe use

- Keep the supplied aspect ratio and clear space of at least one signal-dot diameter around the mark.
- Prefer SVG for web UI and print; use PNG exports for social platforms and app metadata.
- Use `favicon.svg` for modern browser tabs and the PNG favicon exports for legacy clients.
- The public Open Graph image remains `/og-image.webp`; the brand card is the downloadable press/social variant.

The inline React logo at `src/components/ui/oma-logo.tsx` intentionally shares this same geometry while inheriting runtime theme tokens.
