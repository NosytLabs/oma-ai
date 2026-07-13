/**
 * OMA mark — "Open Gateway"
 *
 * Matches generated brand art:
 *   - rounded terminal badge
 *   - open emerald ring (gap at ~1 o'clock)
 *   - three ascending signal bars
 *   - status LED at the ring gap
 *
 * Uses CSS brand tokens so the mark tracks ThemeToggle accents.
 */

const SIZE_MAP = {
	sm: { px: 22, ring: 2.1, bar: 2.6, led: 1.7 },
	md: { px: 30, ring: 2.35, bar: 2.9, led: 1.95 },
	lg: { px: 40, ring: 2.6, bar: 3.2, led: 2.2 },
} as const;

export function OmaLogo({
	size = "md",
	className = "",
}: {
	size?: "sm" | "md" | "lg";
	className?: string;
}) {
	const s = SIZE_MAP[size];

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
			{/* Badge */}
			<rect
				width={40}
				height={40}
				rx={10}
				fill="var(--color-void)"
			/>
			<rect
				x={1.5}
				y={1.5}
				width={37}
				height={37}
				rx={9}
				fill="var(--color-panel)"
				stroke="var(--color-border-hi)"
				strokeWidth={1}
			/>

			{/* Soft glow */}
			<circle
				cx={20}
				cy={20}
				r={13.5}
				fill="var(--color-accent)"
				opacity={0.08}
			/>

			{/* Open ring — gap at ~1 o'clock */}
			<circle
				cx={20}
				cy={20}
				r={11.2}
				stroke="var(--color-accent)"
				strokeWidth={s.ring}
				strokeLinecap="round"
				strokeDasharray="58 12.5"
				strokeDashoffset={-5}
			/>

			{/* Signal bars */}
			<rect
				x={13.6}
				y={22.2}
				width={s.bar}
				height={6}
				rx={s.bar / 2}
				fill="var(--color-accent)"
				opacity={0.7}
			/>
			<rect
				x={18.6}
				y={18.2}
				width={s.bar}
				height={10}
				rx={s.bar / 2}
				fill="var(--color-accent)"
				opacity={0.88}
			/>
			<rect
				x={23.6}
				y={14.2}
				width={s.bar}
				height={14}
				rx={s.bar / 2}
				fill="var(--color-accent)"
			/>

			{/* Status LED at ring gap */}
			<circle
				cx={30.2}
				cy={10.8}
				r={s.led * 1.7}
				fill="var(--color-accent)"
				opacity={0.22}
			/>
			<circle
				cx={30.2}
				cy={10.8}
				r={s.led}
				fill="var(--color-accent-bright)"
			/>
		</svg>
	);
}
