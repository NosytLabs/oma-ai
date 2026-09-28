# OMA brand assets

The OMA folded-loop mark pairs a rounded O/M symbol with an uppercase OMA wordmark. See the repository's `BRAND.md` for colors, typography and voice.

`app/src/lib/brand-mark.json` is the single geometry source. The inline React component uses it with theme colors; `pnpm --filter app brand:generate` exports the entire static kit with Sharp (no system graphics utility required).

- `oma-mark.svg`: transparent symbol.
- `oma-icon.svg` and `oma-icon-{192,512,1024}.png`: void-backed app icons.
- `oma-icon-maskable-512.png`: padded icon for adaptive app masks.
- `oma-logo.svg`, `oma-wordmark.svg`, `oma-wordmark.png`: horizontal lockup.
- `oma-brand-card.svg` and `.png`: social card.
- `brand-kit/`: larger PNG/JPG exports from the same geometry.
- `providers/`: separate provider marks, unchanged by OMA branding.

Favicons, the Apple touch icon, and `og-image.png` live one directory up. `favicon.ico` contains real 16, 32 and 48 pixel entries. Preserve proportions and clear space; never stretch the symbol or crop its peaks.
