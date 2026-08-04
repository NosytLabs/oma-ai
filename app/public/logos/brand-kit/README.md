# OMA brand kit (canonical)

**Vector geometry** lives in the SVGs (`oma-icon.svg`, `favicon.svg`, `oma-logo.svg`,
`oma-brand-card.svg`) — used by the site UI where crisp scaling matters.

**Raster marketing / favicon assets** are produced with Imagine (image edit from the
canonical icon PNG), not freeform regeneration:

| Asset | Use |
|-------|-----|
| `oma-icon.svg` + `oma-icon-*.png` | App icon / PWA |
| `favicon.svg` + `favicon-*.png` | Browser tab |
| `oma-icon-promo.jpg` | Imagine-polished icon (source for PNG sizes) |
| `oma-lockup-horizontal.jpg` / `.png` | Horizontal lockup |
| `oma-brand-card.svg` / `.png` | Marketing / OG-style card |

Do **not** re-export SVG geometry via image models. Prefer `image_edit` from the
existing icon PNG when refreshing rasters.
