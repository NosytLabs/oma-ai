# OMA AI Gateway - Motion Design Reference

## Overview

This document defines the motion design system for OMA AI Gateway, based on LottieFiles Motion Design principles, Web3 design patterns, and modern UI animation standards.

---

## Animation Timing

| Element Type | Duration | Rationale |
|-------------|----------|-----------|
| Microinteractions (buttons, toggles) | **200-300ms** | Responsive, feels snappy |
| Tooltips / badges | **150-200ms** | Quick feedback |
| Card entrance / exit | **250-400ms** | Spatial awareness |
| Modal / dialog | **300-400ms** | Focus shift |
| Page transitions | **400-600ms** | Context switch |
| Loading states | **continuous** | Pulse: 1.5s loop |

**Key Rule**: Entrances should be 30-50% longer than exits. Users care more about what appears than what disappears.

---

## Easing Standards

### Primary Easing Curve
```css
cubic-bezier(0.16, 1, 0.3, 1)
```
**Rationale**: Smooth deceleration with subtle overshoot - ideal for entrances and emphasis animations. This is the OMA signature easing for 80% of animations.

### Easing by Animation Type

| Type | Easing | Use Case |
|------|--------|----------|
| **Entrance** | `cubic-bezier(0.16, 1, 0.3, 1)` | Elements appearing |
| **Exit** | `cubic-bezier(0.7, 0, 1, 1)` | Elements leaving |
| **Hover** | `cubic-bezier(0.2, 0, 0, 1)` | Quick, responsive |
| **Press** | `ease-out` | Button feedback |
| **Bounce/Settle** | `cubic-bezier(0.175, 0.885, 0.32, 1.275)` | Success states |
| **Shake** | `ease-in-out` | Error states |

---

## Entrance Animations

### Standard Card Entrance
1. **Start**: 20px below final position, opacity 0
2. **Path**: Slight arc curve (subtle horizontal offset at midpoint)
3. **Easing**: `cubic-bezier(0.16, 1, 0.3, 1)` (decelerate)
4. **Duration**: 300-400ms
5. **Secondary**: Content fades in 100ms after card lands

### Stagger Patterns

| Pattern | Delay | Total Budget | Use Case |
|---------|-------|-------------|----------|
| Micro cascade | 30-50ms | <200ms | List items, grid cells |
| Standard | 60-100ms | <400ms | Cards, panels, nav items |
| Dramatic | 100-150ms | <600ms | Hero sections, major UI blocks |

**Critical**: Total stagger must stay under 500ms to maintain perceived connection.

### Page Load Sequence
1. Hero element first (chart, headline)
2. Primary content 100-150ms later
3. Secondary elements 60-100ms intervals
4. Ambient elements (decorative) last

---

## Hover States

### Button Hover
```css
transform: scale(1.02);
box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
```

### Card Hover
```css
transform: translateY(-4px) scale(1.01);
box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1);
```

### Icon Hover
```css
transform: scale(1.1);
opacity: 0.9;
transition: all 150ms ease-out;
```

---

## Loading States

### Pulse Animation
```css
@keyframes pulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.05); }
}
/* Duration: 1.5s infinite */
```

### Shimmer Effect
```css
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
/* Linear gradient: 45deg, transparent 40%, white 50%, transparent 60% */
/* Duration: 1.2s infinite */
```

### Skeleton Screen
- Base: `#f0f0f0` background
- Shimmer: linear gradient sweeping left to right
- Duration: 1.2s per sweep
- Content placeholders animate with 50ms stagger

---

## Success / Error States

### Success Animation (Bounce + Color)
```css
/* Primary: Scale pop */
transform: scale(1.15);
transition: transform 200ms cubic-bezier(0.175, 0.885, 0.32, 1.275);

/* Color flash */
background-color: #10b981; /* Emerald 500 */
transition: background-color 150ms ease-out;

/* Settle to normal */
transform: scale(1);
transition: all 300ms cubic-bezier(0.16, 1, 0.3, 1);
```
**Total duration**: 400-500ms

### Error Animation (Shake + Color)
```css
/* Shake: 2-3 oscillations, ±10-15px horizontal */
@keyframes error-shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-10px); }
  40% { transform: translateX(10px); }
  60% { transform: translateX(-8px); }
  80% { transform: translateX(8px); }
}
/* Duration: 300-400ms */
/* Easing: ease-in-out for sharp stops */

/* Color flash */
background-color: #ef4444; /* Red 500 */
/* Transition: 150ms */
```

### Checkmark Draw Animation
1. Circle draws in (scale from 0, 200ms)
2. Checkmark strokes in (stroke-dashoffset, 300ms)
3. Subtle pulse (scale 1.02, 100ms)

---

## Three Motion Layers (OMA Standard)

Every significant animation should have:

1. **Primary**: Main action the user follows
   - Position, scale, opacity changes
   - Hero element

2. **Secondary**: Supporting richness
   - Shadow movement during transforms
   - Icon shifts (2-4px)
   - Background color transitions

3. **Ambient**: Background life
   - Gradient pulses
   - Subtle floating elements
   - Decorative particle effects

---

## Motion Personality: OMA Profile

| Attribute | Value | Rationale |
|-----------|-------|-----------|
| **Archetype** | Premium/Corporate hybrid | Professional yet approachable |
| **Base Duration** | 200-400ms | Balanced responsiveness |
| **Signature Easing** | `cubic-bezier(0.16, 1, 0.3, 1)` | Modern, slightly playful |
| **Overshoot** | 3-5% | Subtle polish, not bouncy |
| **Enter/Exit Ratio** | 1.3x (enter longer) | Focus on appearance |

---

## Quality Checklist

### CRITICAL (Never Break)
- [ ] Never use linear easing for spatial movement
- [ ] Never use opacity-only for important state changes
- [ ] Never exceed 1/3 screen without keyframe change
- [ ] Always include all three motion layers

### HIGH (Follow Consistently)
- [ ] Match duration to element type (see timing table)
- [ ] Use directional easing (ease-out entrance, ease-in exit)
- [ ] Apply anticipation and follow-through
- [ ] Maintain consistent personality across scene
- [ ] Stagger total under 500ms

---

## Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Looks robotic | Linear easing or no arcs | Add `cubic-bezier(0.16, 1, 0.3, 1)` |
| Feels too slow | Duration too long | Reduce to 200-300ms range |
| Looks flat | Missing secondary + ambient | Add shadow animation + background pulse |
| Too distracting | Too many elements moving | Apply stagger, reduce amplitude |
| No personality | Generic easing | Apply OMA signature easing consistently |

---

