# Tailwind CSS v4 Design Tokens with Next.js — Research Notes (2026-08-06)

Sources: tailwindcss.com/docs/theme, github.com/tailwindlabs/tailwindcss
discussion #18471 ("Theming best practices in v4"), Reddit r/DesignSystems,
r/webdev on dynamic themes in Next.js.

## Core model

- In v4, **CSS variables are the design tokens** and utilities are the API
  of the system. Define tokens in `@theme { --color-*: ... }`; Tailwind
  generates matching utilities (`bg-surface`, `text-text-muted`, …).
- Use **`@theme inline`** when a token *references another variable* (e.g.
  `--color-accent-fg: var(--color-void)` or `color-mix(...)`), so the emitted
  utility keeps the reference live at runtime instead of freezing the
  computed value. ✅ `app/globals.css` already uses `@theme inline`.
- Runtime theme switching (dark/light/accent) is done by re-declaring the
  same `--color-*` variables in a `[data-theme="x"]` (or `.dark`) selector —
  utilities just work because they resolve through the var.

## Repo-specific notes for OMA (audited against globals.css)

- ✅ Tokens are defined once in `@theme inline` and overridden per-theme
  (`data-theme`?) in a later block — utilities resolve at runtime.
- ✅ Radii and shadows are registered via `--radius-*` and `--shadow-*` so
  `shadow-md` / `rounded-lg` resolve to the token scale (no ad‑hoc values).
- ✅ No raw hex colors in components: audit found only theme‑picker presets
  (settings), chart palettes (recharts DASHBOARD SVG), and `global-error.tsx`
  (deliberately inline-styled so it survives stylesheet load failure).
- ⚠️ Rule to keep: engage new components must reference tokens only;
  never hardcode `#46d39a` etc. in JSX.

## Fractal team suggestions for scale

- Keep a narrow spacing scale; prefer container queries for dashboard
  widgets instead of a forest of `sm:`/`md:` breakpoints.
- For multi-theme products, prefer `@theme inline` + runtime var overrides
  over generating N static themes.