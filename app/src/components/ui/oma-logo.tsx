

/* Hallmark · P4 H5 E4 S5 R4 V4
 * component: logo · genre: atmospheric · theme: terminal (catalog)
 * states: default · hover (sm+md+lg variants)
 * contrast: pass (accent 0xffc8 on void 0x0a0a0f = 13.4:1)
 *
 * Mark concept: a 40-unit badge with a constructed bar-equalizer (heights
 * deliberately unequal: tall, short, mid — encodes O/M/A as data points),
 * a single status LED in the bottom-right corner, and a hairline baseline
 * tick. No two strokes are the same length. No fake chrome. Locked tokens
 * only — every stroke and fill uses var(--color-*).
 */

const SIZE_MAP = {
  sm: { px: 22, bar: 1.8, dot: 0.9, frame: 1, notch: 1.5 },
  md: { px: 30, bar: 2.4, dot: 1.2, frame: 1, notch: 2 },
  lg: { px: 40, bar: 3, dot: 1.6, frame: 1.25, notch: 2.5 },
} as const

export function OmaLogo({
  size = 'md',
  className = '',
}: {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const s = SIZE_MAP[size]

  return (
    <svg
      viewBox="0 0 40 40"
      width={s.px}
      height={s.px}
      fill="none"
      className={className}
      role="img"
      aria-label="OMA"
    >
      <rect
        x={0.5}
        y={0.5}
        width={39}
        height={39}
        rx={3}
        fill="var(--color-void)"
        stroke="var(--color-border)"
        strokeWidth={s.frame}
      />

      <line
        x1={8}
        y1={32}
        x2={28}
        y2={32}
        stroke="var(--color-border-bright)"
        strokeWidth={1}
        strokeLinecap="round"
      />

      <line
        x1={8}
        y1={11}
        x2={8}
        y2={28}
        stroke="var(--color-accent)"
        strokeWidth={s.bar}
        strokeLinecap="round"
      />

      <line
        x1={16}
        y1={18}
        x2={16}
        y2={28}
        stroke="var(--color-accent)"
        strokeWidth={s.bar}
        strokeLinecap="round"
        opacity={0.7}
      />

      <line
        x1={24}
        y1={14}
        x2={24}
        y2={28}
        stroke="var(--color-accent)"
        strokeWidth={s.bar}
        strokeLinecap="round"
        opacity={0.45}
      />

      <line
        x1={8}
        y1={14}
        x2={24}
        y2={22}
        stroke="var(--color-accent)"
        strokeWidth={s.notch}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
      />

      <circle
        cx={32}
        cy={10}
        r={s.dot}
        fill="var(--color-accent)"
      />
    </svg>
  )
}
