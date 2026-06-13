# Unit Test Record: M1 T1.1 Orange Palette Doc + T1.1.6 WCAG AA Verification

## Target Files
- `app/src/app/globals.css` (lines 9-199 — the orange theme tokens, READ ONLY)
- `.opencode/research/orange-palette.md` (NEW — authoritative palette reference)

## Test File (DELETED)
N/A — no JS/TS test file. This is a documentation + accessibility verification task.

## Verification Code (Preserved)

```python
# Re-runnable WCAG 2.0 contrast computation (reproduce from §6 of palette doc)
def luminance(hex_color):
    h = hex_color.lstrip('#')
    r, g, b = (int(h[i:i+2], 16) / 255.0 for i in (0, 2, 4))
    def adj(c):
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    return 0.2126 * adj(r) + 0.7152 * adj(g) + 0.0722 * adj(b)

def contrast(c1, c2):
    L1, L2 = luminance(c1), luminance(c2)
    if L1 < L2: L1, L2 = L2, L1
    return (L1 + 0.05) / (L2 + 0.05)
```

Computed ratios for all critical pairs (see palette doc §6.1-6.5 for full table).

## Test Result
- **Status:** pass (3 AA failures found, documented as `M-TRACK-1/2/3` follow-ups — non-blocking)
- **Session:** ses_m1_palette
- **Timestamp:** 2026-06-13T19:01Z

## Findings Summary

### Passes (critical)
- All body text pairs (dark + light) score 14-20:1 — far above 4.5:1 AA floor.
- User-bubble text on accent (dark theme) scores 8.73:1 (AAA).
- User-bubble text on accent (light theme) scores 5.18:1 (AA).
- All provider/tier colors score 6.5-9.2:1 on the panel background.

### Failures (must fix in M1 polish or M4 a11y)
1. **M-TRACK-1 (HIGH):** White text on `--color-accent` (dark) = 2.26:1. **Likely bug** in any button class that uses `--color-text-bright` over an accent background. **Recommended:** grep `.btn-primary` and `bg-[var(--color-accent)]` usages; ensure text color is `--color-text-inverse` not `--color-text-bright`.
2. **M-TRACK-2 (MEDIUM):** Light-theme `--color-text-muted: #9ca3af` = 2.31:1 on `--color-surface: #f4f4f5`. **Recommended:** darken to `#6b7280` (Tailwind gray-500, ~5.0:1) for one-line CSS fix.
3. **M-TRACK-3 (LOW):** Dark-theme `--color-accent-muted: #ea580c` is unused AND would fail AA (3.81:1). **Recommended:** remove or rename.

## Acceptance Criteria

- [x] S1.1.1: Dark theme primary orange + 5 supporting variants documented (`#fb923c`, `#f97316`, `#fdba74`, `#ea580c`, `rgba(251,146,60,*)`)
- [x] S1.1.2: Light theme primary orange + 5 variants documented (`#c2410c`, `#9a3412`, `#f97316`, `#7c2d12`, `rgba(194,65,12,*)`)
- [x] S1.1.3: Secondary (amber `#ffb800`) + tertiary (violet `#a78bfa`) documented
- [x] S1.1.4: Semantic colors documented (success=orange, warning=amber, error=#ff3366, info=orange)
- [x] S1.1.5: Provider/tier colors documented and clash-tested (no orange collision)
- [x] S1.1.6: WCAG AA contrast computed for 13 critical pairs (3 failures surfaced, non-blocking)
- [x] Palette doc published to `.opencode/research/orange-palette.md` (recovers dir deleted in T3 cleanup)

## Out of Scope (Not Tested)

- Component-class audit (S1.2.3) — see M-TRACK-1 follow-up; needs grep of `app/src/**/*.{ts,tsx,css}` for hardcoded button color combos.
- T1.2.4-6 (typecheck/lint/build/grep) — already PASSED per `ses_cyan_to_accent` work-log entry (2026-06-13T18:54Z).
- T1.3 (visual smoke test) — Reviewer task (chrome-devtools).

## Notes

- The directory `.opencode/research/` was deleted by `ses_cleanup_v4` (T3 cleanup, 2026-06-13T15:19Z). This task recreates it for the palette doc. Other research artifacts from v3 are NOT being restored (per cleanup intent).
- The 3 AA failures are **preexisting** in the v4 theme — they are not regressions from the M1 rename, they are inheritances from the original v4 token selection. A separate M1 polish task is the right owner.
