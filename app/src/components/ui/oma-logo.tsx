/**
 * OMA mark — "Open Gateway Aperture" (brand refresh 2026-07-26)
 *
 * Matches app/public/favicon.svg and logos/oma-icon.svg:
 *   - rounded terminal badge
 *   - open emerald ring, gap at 3 o'clock (open access)
 *   - terminal prompt chevron pointing through the gap
 *   - signal dot sitting in the gap (live token out)
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
				strokeWidth={s.ring}
				strokeLinecap="round"
				strokeDasharray="63.8 19.4"
				strokeDashoffset={-9.7}
			/>
			<rect
				x={14}
				y={20 - s.bar / 2}
				width={11.5}
				height={s.bar}
				rx={s.bar / 2}
				fill="var(--color-accent)"
				transform="rotate(45 25.5 20)"
			/>
			<rect
				x={14}
				y={20 - s.bar / 2}
				width={11.5}
				height={s.bar}
				rx={s.bar / 2}
				fill="var(--color-accent)"
				transform="rotate(-45 25.5 20)"
			/>
			<circle cx={24.2} cy={20} r={s.bar / 2} fill="var(--color-accent)" />
			<circle cx={33.25} cy={20} r={s.led * 2.1} fill="var(--color-accent)" opacity={0.22} />
			<circle cx={33.25} cy={20} r={s.led * 1.25} fill="var(--color-accent)" />
			<circle cx={33.25} cy={20} r={s.led * 0.6} fill="var(--color-accent-bright)" />
		</svg>
	);
}

/**
 * OmaWordmark — full horizontal lockup with the mark + the lowercase
 * "oma" wordmark + "Open Model Access" tagline. Used on landing/auth
 * surfaces where brand context matters more than chrome footprint.
 */
export function OmaWordmark({
	size = "md",
	className = "",
}: {
	size?: "sm" | "md" | "lg";
	className?: string;
}) {
	const heights = { sm: 26, md: 38, lg: 52 } as const;
	const h = heights[size];
	const mark = h * 0.86;

	return (
		<div
			className={`inline-flex items-center gap-2.5 ${className}`}
			role="img"
			aria-label="OMA — Open Model Access"
		>
			<svg
				viewBox="0 0 40 40"
				width={mark}
				height={mark}
				fill="none"
				aria-hidden="true"
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
					strokeWidth={2.4}
					strokeLinecap="round"
					strokeDasharray="63.8 19.4"
					strokeDashoffset={-9.7}
				/>
				<rect
					x={14}
					y={18.6}
					width={11.5}
					height={2.8}
					rx={1.4}
					fill="var(--color-accent)"
					transform="rotate(45 25.5 20)"
				/>
				<rect
					x={14}
					y={18.6}
					width={11.5}
					height={2.8}
					rx={1.4}
					fill="var(--color-accent)"
					transform="rotate(-45 25.5 20)"
				/>
				<circle cx={24.2} cy={20} r={1.4} fill="var(--color-accent)" />
				<circle cx={33.25} cy={20} r={3.6} fill="var(--color-accent)" opacity={0.22} />
				<circle cx={33.25} cy={20} r={2.1} fill="var(--color-accent)" />
				<circle cx={33.25} cy={20} r={1.0} fill="var(--color-accent-bright)" />
			</svg>
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
