/**
 * OMA brand mark and wordmark.
 *
 * The geometry is deliberately shared by the favicon, static SVG kit, and
 * inline UI mark: an open emerald ring, terminal chevron, and signal dot.
 * Inline colors use the theme tokens so alternate OMA themes remain coherent.
 */

const SIZE_MAP = {
	sm: { px: 22, ring: 2.1, bar: 2.6, led: 1.7 },
	md: { px: 30, ring: 2.35, bar: 2.9, led: 1.95 },
	lg: { px: 40, ring: 2.6, bar: 3.2, led: 2.2 },
} as const;

type LogoSize = keyof typeof SIZE_MAP;

function OmaMark({
	width,
	height,
	ring,
	bar,
	led,
	className,
	ariaHidden = false,
}: {
	width: number;
	height: number;
	ring: number;
	bar: number;
	led: number;
	className?: string;
	ariaHidden?: boolean;
}) {
	return (
		<svg
			viewBox="0 0 40 40"
			width={width}
			height={height}
			fill="none"
			className={className}
			aria-hidden={ariaHidden}
			role={ariaHidden ? undefined : "img"}
			aria-label={ariaHidden ? undefined : "OMA"}
		>
			<rect width={40} height={40} rx={10} fill="var(--color-void)" />
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
			<circle cx={20} cy={20} r={13.5} fill="var(--color-accent)" opacity={0.08} />
			<circle
				cx={20}
				cy={20}
				r={13.25}
				stroke="var(--color-accent)"
				strokeWidth={ring}
				strokeLinecap="round"
				strokeDasharray="63.8 19.4"
				strokeDashoffset={-9.7}
			/>
			<rect
				x={14}
				y={20 - bar / 2}
				width={11.5}
				height={bar}
				rx={bar / 2}
				fill="var(--color-accent)"
				transform="rotate(45 25.5 20)"
			/>
			<rect
				x={14}
				y={20 - bar / 2}
				width={11.5}
				height={bar}
				rx={bar / 2}
				fill="var(--color-accent)"
				transform="rotate(-45 25.5 20)"
			/>
			<circle cx={24.2} cy={20} r={bar / 2} fill="var(--color-accent)" />
			<circle cx={33.25} cy={20} r={led * 2.1} fill="var(--color-accent)" opacity={0.22} />
			<circle cx={33.25} cy={20} r={led * 1.25} fill="var(--color-accent)" />
			<circle cx={33.25} cy={20} r={led * 0.6} fill="var(--color-accent-bright)" />
		</svg>
	);
}

export function OmaLogo({
	size = "md",
	className = "",
}: {
	size?: LogoSize;
	className?: string;
}) {
	const s = SIZE_MAP[size];
	return (
		<OmaMark
			width={s.px}
			height={s.px}
			ring={s.ring}
			bar={s.bar}
			led={s.led}
			className={className}
		/>
	);
}

/** Full OMA lockup used on auth and other brand-forward surfaces. */
export function OmaWordmark({
	size = "md",
	className = "",
}: {
	size?: LogoSize;
	className?: string;
}) {
	const heights = { sm: 26, md: 38, lg: 52 } as const;
	const h = heights[size];
	const mark = h * 0.86;
	const s = SIZE_MAP[size];

	return (
		<div
			className={`inline-flex items-center gap-2.5 ${className}`}
			role="img"
			aria-label="OMA — Open Model Access"
		>
			<OmaMark
				width={mark}
				height={mark}
				ring={s.ring}
				bar={s.bar}
				led={s.led}
				ariaHidden
			/>
			<div className="flex flex-col leading-none">
				<span
					className="font-display font-bold tracking-tight text-text-bright"
					style={{ fontSize: h * 0.62, lineHeight: 1 }}
				>
					oma
				</span>
				<span
					className="mt-1 font-mono uppercase tracking-[0.22em] text-accent"
					style={{ fontSize: h * 0.22, lineHeight: 1 }}
				>
					Open Model Access
				</span>
			</div>
		</div>
	);
}
