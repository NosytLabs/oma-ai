# Motion primitives

Client-side entrance + interaction primitives built on
[framer-motion](https://www.framer.com/motion/). Pair with the
`MotionProvider` in the root layout to enable LazyMotion tree-shaking.

## Two entry points, one source of truth

| Entry                                       | Use for                                                         |
| ------------------------------------------- | --------------------------------------------------------------- |
| `@/lib/animation`                           | Canonical home for `springs`, `variants`, `EASE_SPRING_*` tokens |
| `@/lib/animation/Magnetic`, `MotionProvider`| Framework-free primitives (magnetic buttons, providers)         |
| `@/components/motion/in-view-fade`          | Tiny scroll-reveal wrapper for **server** components             |

> The CSS easing tokens in `app/src/app/globals.css`
> (`--ease-spring`, `--ease-out`, …) must stay aligned with
> `@/lib/animation/springs`. Drift is a subtle "animation feel" bug
> across the app — keep them hand-tuned together.

## Reduced motion

`MotionProvider` sets `reducedMotion="user"`, so every primitive here
opts users with `prefers-reduced-motion: reduce` out of transforms
automatically. CSS easings should never bypass that — always pair a
transition with `MotionConfig reducedMotion="user"`.

## Adding a new primitive

1. Drop the component in `app/src/components/motion/`.
2. Use `m` (LazyMotion-compatible) — never import `motion` directly so
   the bundle stays tree-shaken.
3. Gate any transform on `useReducedMotion()` for static-render fallback.
4. Add a unit test under `app/src/components/motion/__tests__/` mirroring
   the InViewFade test pattern.
