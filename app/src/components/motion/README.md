# Motion — kinetics-inspired components

`app/src/components/motion/` is a small, copy-paste-friendly motion
library tuned to emil-kowalski craft rules:

- **Ease-out over ease-in.** Things decelerate into place, never
  lurch away from it.
- **scale(0.97) on press, never scale(0).** A press that visibly
  shrinks signals success; a press that vanishes feels broken.
- **Sub-300ms for taps, sub-500ms for transitions.** Anything longer
  reads as laggy.
- **GPU-only properties.** Transform + opacity + filter. No
  `width`/`height`/`top`/`left` animation — those trigger paint.
- **prefers-reduced-motion.** `MotionProvider` already wraps the
  app with `<MotionConfig reducedMotion="user">`, so every spring
  here is a no-op for users who opt out.

## Spring tokens (from kinetics.colorion.co)

| name | stiffness | damping | mass | used by |
|---|---|---|---|---|
| `card` | 320 | 24 | 1.0 | `SpringCard` (height, panel reveals) |
| `counter` | 280 | 18 | 1.0 | `ElasticCounter` (digit bumps) |
| `tab` | 380 | 30 | 0.9 | `TabPill` (indicator glide) |
| `toast` | 260 | 16 | 1.0 | (reserved for toast upgrades) |
| `magnet` | 400 | 28 | 0.6 | `MagneticButton` (fast follow) |

Spring physics is interruptible — if the user clicks again mid-spring,
the new motion integrates from current velocity, never snaps.

## CSS easings (for non-framer surfaces)

```
--ease-spring:    cubic-bezier(0.34, 1.56, 0.64, 1)
--ease-spring-tight: cubic-bezier(0.34, 1.4, 0.64, 1)
--ease-spring-soft:  cubic-bezier(0.18, 1.25, 0.4, 1)
--ease-out:       cubic-bezier(0.16, 1, 0.3, 1)
```

The `spring*` curves overshoot slightly past 1.0 then settle — fine
for small visual elements, can feel cheap on large surfaces (use
`ease-out` for those).

## Components

- `MagneticButton` — wraps any button, applies a 35%-strength
  cursor-pull inside a dead zone. Pair with `whileTap={{ scale: 0.97 }}`.
- `SpringCard` — height collapse via `grid-template-rows: 0fr/1fr`
  trick. No JS measurement. AnimatePresence for content fade.
- `ElasticCounter` — number that bumps + overshoots on every click.
  Restarts cleanly under rapid clicks.
- `TabPill` — animated active-tab indicator. Uses `offsetLeft`/
  `offsetWidth` measurement so it works without `layoutId` if needed.

## When NOT to use

- **Long content reveals** — use a CSS `cubic-bezier(.16,1,.3,1)`
  ease-out over 250ms instead. Springs overshoot long content.
- **Status indicator dots** — pure CSS pulse animation.
- **Looping ambient motion** — use CSS keyframes (background-gradient
  pan, etc.), not springs.

## Live reference

`/design/motion` (internal page, not linked from marketing) renders
every component for visual sign-off.
