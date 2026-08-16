# OMA brand kit — marketing extras

**Live site vectors and PWA icons** live one level up (`../`) and in `app/public/`
favicons — those are the single source of truth:

| Live path | Use |
| --- | --- |
| `../oma-icon.svg` + `oma-icon-*.png` | App icon / PWA (also `npm run brand:generate`) |
| `../oma-logo.svg` | Horizontal lockup (mark + wordmark + tagline) |
| `../oma-wordmark.svg` / `.png` | Alias of the lockup for external consumers |
| `../oma-brand-card.svg` / `.png` | Press / social SVG card |
| `../../favicon.svg` + `favicon-*.png` | Browser tab |

This folder only holds **marketing rasters** that are not used by the app UI:

| Asset | Use |
| --- | --- |
| `oma-icon-promo.jpg` | Imagine-polished icon stills |
| `oma-lockup-horizontal.jpg` / `.png` | Horizontal lockup for decks / social |
| `oma-brand-card.png` | Higher-res marketing card raster |

Do **not** re-export SVG geometry via image models — refresh rasters by
re-rendering the live SVG masters. After regenerating live SVGs/PNGs,
run `cd app && npm run brand:generate` (needs `rsvg-convert`).
