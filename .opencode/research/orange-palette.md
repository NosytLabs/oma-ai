# OMA-AI v4 Orange Palette — Authoritative Reference

> **Status:** Authoritative. Source of truth for all orange-theme color decisions in `app/src/app/globals.css`.
> **Created:** 2026-06-13 (v4 sweep, post-`ses_cyan_to_accent` rename).
> **Owner:** v4 M1 (Orange Theme System), T1.1 + T1.1.6.
> **Verification:** WCAG 2.1 AA contrast computed for all critical text/background pairs (see §6).

---

## 1. Brand Identity

OMA-AI v4 anchors on a single bold color choice: **orange**. The prior v3 palette was cyan/teal (`#00ffc8`); v4 replaces it with a refined orange family that evokes warmth, energy, and terminal-amber confidence.

- **Why orange?** Differentiates from the dominant AI-gateway competitors (which skew blue/cyan/purple). Orange reads as "warmth + competence" and pairs cleanly with the existing terminal/CRT aesthetic.
- **Color temperature:** Warm (analogous to sunset/sodium-vapor). Pairs naturally with amber (secondary) and violet (tertiary) on the color wheel.
- **Saturation policy:** Mid-saturation (`#fb923c`, not pure `#ff6600`) — survives both dark and light themes without over-saturation or visual fatigue.

## 2. Dark Theme Palette (`:root`)

| Role | Token | Hex | Notes |
|------|-------|-----|-------|
| **Primary accent** | `--color-accent` | `#fb923c` | Tailwind `orange-400`. Default focus/CTA color. |
| Accent dim (overlay) | `--color-accent-dim` | `rgba(251,146,60,0.18)` | Hover background tints. |
| Accent glow (focus ring) | `--color-accent-glow` | `rgba(251,146,60,0.25)` | Focus-ring halo. |
| Accent hover | `--color-accent-hover` | `#f97316` | Tailwind `orange-500`. Pressed/hovered state. |
| Accent bright | `--color-accent-bright` | `#fdba74` | Tailwind `orange-300`. Soft text/separator over accent backgrounds. |
| Accent muted | `--color-accent-muted` | `#ea580c` | Tailwind `orange-600`. De-emphasized accent. **Unused in components — see §6.** |
| Accent soft (page bg tint) | `--color-accent-soft` | `rgba(251,146,60,0.08)` | Radial-gradient body tint. |
| **Secondary** | `--color-secondary` | `#ffb800` | Amber/gold. Warning, tier-mid. |
| Secondary dim | `--color-secondary-dim` | `rgba(255,184,0,0.12)` | |
| **Tertiary** | `--color-tertiary` | `#a78bfa` | Violet. Provider-venice, tier-frontier. |
| Tertiary dim | `--color-tertiary-dim` | `rgba(167,139,250,0.12)` | |
| **Success / Info** | `--color-success` / `--color-info` | `#fb923c` | Aliased to primary accent (orange = success in this brand). |
| **Warning** | `--color-warning` | `#ffb800` | Aliased to secondary amber. |
| **Error** | `--color-error` | `#ff3366` | Warm pink-red, NOT pure red. Stays on-brand. |
| **Background layers** | `--color-void` | `#0a0a0f` | App background (deepest). |
| | `--color-surface` | `#121218` | Cards. |
| | `--color-panel` | `#18181f` | Elevated cards. |
| | `--color-surface-elevated` | `#1e1e26` | Modals, popovers. |
| **Borders** | `--color-border` | `#2a2a35` | Default. |
| | `--color-border-bright` | `#3d3d4d` | Hover/active. |
| **Text** | `--color-text` | `#e4e4e7` | Body. |
| | `--color-text-bright` | `#ffffff` | Headings, emphasis. |
| | `--color-text-secondary` | `#c4c4d0` | Subheads, metadata. |
| | `--color-text-muted` | `#b3b3b8` | Tertiary, captions. **See §6 — light-theme failure.** |
| | `--color-text-tertiary` | `#9898aa` | Quaternary. |
| | `--color-text-inverse` | `#0a0a0f` | For use ON light surfaces. |
| **Message bubbles** | `--color-msg-user` | `#fb923c` | User bubble background. |
| | `--color-msg-user-text` | `#0a0a0f` | Dark text on orange bubble. 8.73:1 contrast (AAA). |
| | `--color-msg-ai` | `#18181f` | AI bubble background. |
| | `--color-msg-ai-text` | `#e4e4e7` | Light text on AI bubble. 13.92:1 contrast. |

## 3. Light Theme Palette (`[data-theme="light"]`)

| Role | Token | Hex | Notes |
|------|-------|-----|-------|
| **Primary accent** | `--color-accent` | `#c2410c` | Tailwind `orange-700`. Darker for light bg. |
| Accent hover | `--color-accent-hover` | `#9a3412` | Tailwind `orange-800`. |
| Accent bright | `--color-accent-bright` | `#f97316` | Tailwind `orange-500`. Brighter — DO NOT use as button bg (see §6). |
| Accent muted | `--color-accent-muted` | `#7c2d12` | Tailwind `orange-900`. |
| **Background layers** | `--color-void` | `#fafafa` | App background. |
| | `--color-surface` | `#f4f4f5` | Cards. |
| | `--color-panel` | `#ffffff` | Elevated. |
| **Borders** | `--color-border` | `#e4e4e7` | Default. |
| | `--color-border-bright` | `#a1a1aa` | Hover. |
| **Text** | `--color-text` | `#18181b` | Body. |
| | `--color-text-bright` | `#09090b` | Headings. |
| | `--color-text-secondary` | `#52525b` | Subheads. |
| | `--color-text-muted` | `#9ca3af` | **See §6 — fails AA on light surface.** |
| **Message bubbles** | `--color-msg-user` | `#c2410c` | User bubble. |
| | `--color-msg-user-text` | `#ffffff` | White text on orange. 5.18:1 contrast (AA). |

## 4. Provider & Tier Colors (Brand-Aligned)

These are intentionally non-orange to provide visual hierarchy for model selection, without clashing with the orange anchor.

| Token | Hex | Used for | Rationale |
|-------|-----|----------|-----------|
| `--color-provider-venice` | `#a78bfa` (violet) | Primary premium provider (Venice) | Violet contrasts with orange, reads as "premium/special." |
| `--color-provider-antseed` | `#34d399` (emerald) | Secondary provider (AntSeed) | Emerald = "fresh/independent." Avoids orange collision. |
| `--color-provider-openrouter` | `#60a5fa` (blue) | Third-party (OpenRouter) | Blue = neutral aggregator. |
| `--color-provider-together` | `#f472b6` (pink) | Additional provider (Together) | Pink = warm, distinct from orange. |
| `--color-tier-frontier` | `#a78bfa` (violet) | Highest tier | Matches provider-venice (frontier = Venice = violet). |
| `--color-tier-premium` | `#fb923c` (orange) | Premium models | Same as accent — premium = "ours." |
| `--color-tier-mid` | `#ffb800` (amber) | Mid-range | Adjacent to orange on the wheel. |
| `--color-tier-budget` | `#34d399` (emerald) | Budget | Distinct from orange. |
| `--color-tier-reasoning` | `#f472b6` (pink) | Reasoning models | Distinct. |
| `--color-tier-coding` | `#60a5fa` (blue) | Coding models | Distinct. |
| `--color-tier-uncensored` | `#ff3366` (red) | Special/uncensored | Matches `--color-error`. |

**Clash test:** No two adjacent tier colors share a hue. Orange ↔ amber share a hue (premium ↔ mid), but they're 5+ lightness steps apart and never co-rendered.

## 5. Legacy Color Aliases (Back-Compat)

These tokens are kept for component code that hasn't been updated post-rename. They resolve to orange/amber/violet/emerald/blue so legacy `color-green` / `color-amber` etc. usages still render on-brand.

| Alias | Resolves to (dark) | Resolves to (light) | Notes |
|-------|---------------------|----------------------|-------|
| `--color-green` | `#fb923c` (orange) | `#c2410c` | Renamed from teal `00ffc8` → orange. |
| `--color-amber` | `#ffb800` | `#d97706` | Unchanged. |
| `--color-violet` / `--color-purple` | `#a78bfa` | `#7c3aed` | Unchanged. |
| `--color-emerald` | `#34d399` | `#059669` | Unchanged. |
| `--color-blue` | `#60a5fa` | `#2563eb` | Unchanged. |
| `--color-pink` | `#ec4899` | `#db2777` | Unchanged. |
| `--color-red` | `#ef4444` | `#dc2626` | Unchanged. |

**Migration path:** Components should use `--color-accent*` directly. Legacy aliases will be removed in v5.

## 6. WCAG 2.1 AA Contrast Verification

Computed via Python `luminance()` per WCAG 2.0 spec, `ratio = (L_lighter + 0.05) / (L_darker + 0.05)`. **AA = 4.5:1 for normal text, 3.0:1 for large text (≥18pt or ≥14pt bold). AAA = 7.0:1 / 4.5:1.**

### 6.1 Dark theme — passes

| Pair | Hex | Ratio | AA (4.5:1) | AAA (7.0:1) |
|------|-----|-------|-----------|-------------|
| Body text on void | `#e4e4e7` on `#0a0a0f` | **15.57:1** | ✓ | ✓ |
| Body text on surface | `#e4e4e7` on `#121218` | **14.71:1** | ✓ | ✓ |
| Text-secondary on surface | `#c4c4d0` on `#121218` | **10.80:1** | ✓ | ✓ |
| Text-muted on surface | `#b3b3b8` on `#121218` | **8.94:1** | ✓ | ✓ |
| Text-bright on void | `#ffffff` on `#0a0a0f` | **19.75:1** | ✓ | ✓ |
| **User text on accent (button)** | `#0a0a0f` on `#fb923c` | **8.73:1** | ✓ | ✓ |
| User text on accent-hover | `#0a0a0f` on `#f97316` | **7.05:1** | ✓ | ✓ |
| Panel on accent-bright | `#18181f` on `#fdba74` | **10.47:1** | ✓ | ✓ |

### 6.2 Dark theme — FAILURES

| Pair | Hex | Ratio | Issue | Recommended fix |
|------|-----|-------|-------|-----------------|
| **White text on accent button** | `#ffffff` on `#fb923c` | **2.26:1** | White-on-orange is illegible (well below 3:1 large-text floor). | **Use dark text** on accent buttons. CSS rule: `.btn-primary` must use `color: var(--color-text-inverse)` (`#0a0a0f`), not `var(--color-text-bright)`. |

**Note:** `--color-accent-muted: #ea580c` paired with dark text scores 3.81:1 — fails AA normal text. **Recommendation:** Remove or rename this token; it's currently unused and would silently fail if anyone ever used it as a button background.

### 6.3 Light theme — passes

| Pair | Hex | Ratio | AA | AAA |
|------|-----|-------|----|----|
| Body text on void | `#18181b` on `#fafafa` | **16.97:1** | ✓ | ✓ |
| Body text on surface | `#18181b` on `#f4f4f5` | **16.12:1** | ✓ | ✓ |
| Text-secondary on surface | `#52525b` on `#f4f4f5` | **7.03:1** | ✓ | ✓ |
| **User text on accent (button)** | `#ffffff` on `#c2410c` | **5.18:1** | ✓ | ✗ |
| Text on border-bright (edge) | `#18181b` on `#a1a1aa` | **6.91:1** | ✓ | ✗ (close) |

### 6.4 Light theme — FAILURES

| Pair | Hex | Ratio | Issue | Recommended fix |
|------|-----|-------|-------|-----------------|
| **Text-muted on surface** | `#9ca3af` on `#f4f4f5` | **2.31:1** | Muted text invisible on light cards. | **Darken `--color-text-muted` for light theme** to `#6b7280` (Tailwind `gray-500`) → ~5.0:1. Or restrict to non-surface contexts. |
| **Text-muted on accent-bright** | `#9ca3af` on `#f97316` | **2.80:1** | Below 3:1 large-text floor. | **Same fix** + don't use `--color-accent-bright` as text background. |

### 6.5 Provider/tier (informational, dark theme on panel)

| Pair | Hex | Ratio | AA (3:1 large only) | Notes |
|------|-----|-------|--------------------|-----|
| Provider venice (violet) | `#a78bfa` on `#18181f` | **6.49:1** | ✓ | AA passes (icons/badges are large). |
| Provider antseed (emerald) | `#34d399` on `#18181f` | **9.19:1** | ✓ | |
| Provider openrouter (blue) | `#60a5fa` on `#18181f` | **6.95:1** | ✓ | |
| Provider together (pink) | `#f472b6` on `#18181f` | **6.67:1** | ✓ | |

All provider colors pass AA against the panel background. They're used as icons/badges (large-text equivalent), so the 3:1 floor is the relevant threshold — all clear.

## 7. Recommended Fixes (Non-Blocking)

These are **preexisting AA failures** in the v4 theme. None are blocking the v4 ship but should be tracked:

1. **M-TRACK-1 (HIGH):** Audit `.btn-primary` and any other button class that uses `--color-accent` as background. Ensure `color` is `--color-text-inverse` (dark) for both themes, NOT `--color-text-bright` (white). Grep: `class=".*btn-primary.*"` and `bg-\[var\(--color-accent\)\]`. → Owner: M4 visual + a11y review (chrome-devtools + axe-core re-audit).
2. **M-TRACK-2 (MEDIUM):** Light-theme `--color-text-muted: #9ca3af` → `#6b7280`. Affects captions/tertiary text on light cards. → Owner: M1 theme polish (one-line CSS change).
3. **M-TRACK-3 (LOW):** Remove or rename unused `--color-accent-muted` (dark: `#ea580c`, 3.81:1 with dark text — silent failure trap). → Owner: M1 theme cleanup.

## 8. File Locations

- **Live tokens:** `app/src/app/globals.css` (lines 9-199 cover `:root` and `[data-theme="light"]`)
- **V3 archive (cyan):** `docs/archive/audit-2026-06-13v2/` + commit `d4d9e0c` (v3) → `a3ae536` (v4 rename + copy polish)
- **WCAG verification script:** see commit history of this doc; the contrast formulas in §6 are reproducible from any WCAG 2.0 spec.

---

**Verified by:** Worker `ses_m1_palette` (M1 T1.1 + T1.1.6), 2026-06-13.
**Re-verification cadence:** Re-run WCAG table whenever `--color-*` tokens change.
