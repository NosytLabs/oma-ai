# UI/UX Audit (2026-06-13)

## Summary
- Hardcoded bg-black/white: **0**
- Hardcoded text-black/white: **0**
- TODO/FIXME/XXX: **1** (false positive — placeholder text `OMA-XXXX-XXXX-XXXX`, not a real TODO)
- Lorem/Ipsum: **0**
- Native confirm/alert: **0**
- Console.log/debug: **6** (all inside code-example string literals shown to users — SDK snippets, use-case copy, preset prompt payload)
- Img without alt: **0** (no `<img>` tags used; 3 `next/image` instances all have proper `alt` props)

**Verdict: clean.** No hardcoded color escapes, no accessibility regressions in images, no native browser dialogs, no placeholder copy, no real TODO debt. Theme system (Tailwind v4 `@theme` + `[data-theme="light"]`) is the single source of truth for color.

---

## P0 Critical Issues
*None.* No accessibility blockers, no broken primary user flows, no security-impacting UI defects.

---

## P1 High Issues
*None.* Theme tokens are used consistently, focus-visible is honored, touch-target minimums enforced, scroll behavior and reduced-motion handled.

---

## P2 Medium

### 2.1 Duplicate CSS property — `.oma-btn--primary[data-state="loading"]`
**File:** `app/src/app/globals.css:405-411`

```css
.oma-btn--primary[data-state="loading"] {
  background: var(--color-accent-muted);
  color: var(--color-text-inverse);   /* line 407 — declared */
  cursor: progress;
  position: relative;
  color: transparent;                  /* line 410 — silently wins (duplicate) */
}
```

The first `color` declaration is dead code (browser uses cascade-last-wins). Harmless visually because the intended final state is `color: transparent` (text replaced by spinner), but it confuses future readers and trips linters.

**Fix:** delete the first `color: var(--color-text-inverse);` on line 407. Add a one-line comment if intent-recovery is desired.

---

## P3 Low

### 3.1 `console.log` in user-facing code-example strings (6 occurrences)
All matches are intentional — sample code shown to docs readers, not runtime logging:
- `app/src/app/docs/_components/SDKsSection.tsx:48,136`
- `app/src/app/use-cases/ai-agents/page.tsx:33`
- `app/src/app/use-cases/chatbots/page.tsx:40`
- `app/src/app/use-cases/apps/page.tsx:33`
- `app/src/components/playground/PresetPrompts.tsx:36` (JS bug-finding preset that *uses* `console.log` as part of the prompt)

**No action required.** These render as text inside `<CodeBlock>` components. They are pedagogically correct. Flagging only because a naïve regex-based "no console.log" CI rule would create false positives — consider scoping any future lint to runtime files only.

### 3.2 `OMA-XXXX-XXXX-XXXX` placeholder in account modal
**File:** `app/src/components/account-login-modal.tsx:213`

```tsx
placeholder="OMA-XXXX-XXXX-XXXX"
```

Grepped as `XXX` but is genuinely an API-key format hint. No fix.

### 3.3 Possible unused theme tokens in `globals.css`
The `@theme` block (lines 13-124) defines `--color-pink`, `--color-red`, `--color-bg-secondary`, `--color-error-bg`, `--color-accent-soft` in the dark theme and again in `[data-theme="light"]` (lines 126-201). Spot-check across `app/src/components/**` shows usage of `bg-pink`/`text-pink` is absent or rare. **Not verified exhaustively** — recommend a one-pass grep for `bg-pink|text-pink|bg-red|text-red|var\(--color-pink\)|var\(--color-red\)|var\(--color-bg-secondary\)|var\(--color-error-bg\)` before pruning.

---

## Patterns

1. **Single source of color truth.** Every colored surface in `app/src` references `var(--color-*)` tokens. Zero `bg-black` / `text-white` escapes. This is the gold-standard outcome for a Tailwind v4 `@theme` migration — keep the discipline.

2. **Theme switching is real, not cosmetic.** `[data-theme="light"]` redefines the full token set (lines 126-201) and `color-scheme` is flipped in both `:root` (line 10) and the light override (line 127), so native form controls and the address bar follow the active theme.

3. **Accessibility wired in, not bolted on.** `globals.css` enforces 44×44 px touch targets (line 232-233), `:focus-visible` ring with 2 px outline + offset (line 243-247), `prefers-reduced-motion` kill switch (line 701-738), `font-size: 16px` floor on mobile inputs to suppress iOS auto-zoom (line 608), and a `.sr-only` utility (line 740-750).

4. **No `<img>` raw tags.** All raster images go through `next/image`, which means automatic `width`/`height`, lazy loading, and `alt` discipline are enforced by the component contract. Three production uses, three valid alts.

5. **Code-as-content vs code-as-behavior.** `console.log` survives only inside string literals (docs samples, preset prompts). The codebase cleanly separates "what we tell users to write" from "what runs in the browser."

6. **One real CSS hygiene issue.** The duplicate `color:` property in `.oma-btn--primary[data-state="loading"]` (P2.1) is the only lint-grade finding in the 750-line stylesheet. Cheap fix, high signal-to-noise.
