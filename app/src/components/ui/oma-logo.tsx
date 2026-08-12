/**
 * OMA brand mark and wordmark.
 *
 * Geometry is shared by the favicon, static SVG kit, and inline UI mark:
 * open emerald ring, terminal chevron, signal dot. Inline colors use theme
 * tokens so alternate accent themes stay coherent.
 */

const SIZE_MAP = {
	sm: { px: 24, ring: 2.15, bar: 2.55, led: 1.65 },
	md: { px: 32, ring: 2.4, bar: 2.9, led: 1.9 },
	lg: { px: 42, ring: 2.65, bar: 3.2, led: 2.15 },
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
			{/* Terminal plate */}
			<rect width={40} height={40} rx={11} fill="var(--color-void)" />
			<rect
				x={1.25}
				y={1.25}
				width={37.5}
				height={37.5}
				rx={9.75}
				fill="var(--color-panel)"
				stroke="var(--color-border-hi)"
				strokeWidth={1}
			/>
			{/* Soft aperture glow */}
			<circle cx={20} cy={20} r={13.2} fill="var(--color-accent)" opacity={0.09} />
			{/* Open gateway ring — gap at 3 o'clock */}
			<circle
				cx={20}
				cy={20}
				r={12.9}
				stroke="var(--color-accent)"
				strokeWidth={ring}
				strokeLinecap="round"
				strokeDasharray="62.2 18.9"
				strokeDashoffset={-9.45}
			/>
			{/* Terminal prompt chevron pointing through the gap */}
			<rect
				x={13.6}
				y={20 - bar / 2}
				width={11.2}
				height={bar}
				rx={bar / 2}
				fill="var(--color-accent)"
				transform="rotate(45 25.2 20)"
			/>
			<rect
				x={13.6}
				y={20 - bar / 2}
				width={11.2}
				height={bar}
				rx={bar / 2}
				fill="var(--color-accent)"
				transform="rotate(-45 25.2 20)"
			/>
			<circle cx={24} cy={20} r={bar / 2} fill="var(--color-accent)" />
			{/* Signal / token emission dot in the gap */}
			<circle cx={33.1} cy={20} r={led * 2} fill="var(--color-accent)" opacity={0.2} />
			<circle cx={33.1} cy={20} r={led * 1.2} fill="var(--color-accent)" />
			<circle cx={33.1} cy={20} r={led * 0.55} fill="var(--color-accent-bright)" />
		</svg>
	);
}

/** Compact mark only (nav icon, badges). */
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

/**
 * Nav lockup: mark + refined lowercase wordmark.
 * Uses body sans (not the page mono stack) so the brand reads as a product
 * mark rather than terminal chrome.
 */
export function OmaNavLockup({
	size = "sm",
	className = "",
}: {
	size?: LogoSize;
	className?: string;
}) {
	const s = SIZE_MAP[size];
	const textSize = size === "sm" ? "text-[15px]" : size === "md" ? "text-[17px]" : "text-[20px]";

	return (
		<span
			className={`inline-flex items-center gap-2 ${className}`}
			aria-label="OMA — Open Model Access"
		>
			<OmaMark
				width={s.px}
				height={s.px}
				ring={s.ring}
				bar={s.bar}
				led={s.led}
				ariaHidden
			/>
			<span
				className={`font-sans font-semibold tracking-[-0.045em] text-text-bright leading-none ${textSize}`}
			>
				oma
			</span>
		</span>
	);
}

/** Full OMA lockup used on auth and other brand-forward surfaces. */
export function OmaWordmark({
	size = "md",
	className = "",
	showTagline = true,
}: {
	size?: LogoSize;
	className?: string;
	/** Hide the OPEN MODEL ACCESS line (e.g. tight headers). */
	showTagline?: boolean;
}) {
	const heights = { sm: 28, md: 40, lg: 54 } as const;
	const h = heights[size];
	const mark = h * 0.9;
	const s = SIZE_MAP[size];

	return (
		<div
			className={`inline-flex items-center gap-3 ${className}`}
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
					className="font-sans font-semibold tracking-[-0.05em] text-text-bright"
					style={{ fontSize: h * 0.58, lineHeight: 1 }}
				>
					oma
				</span>
				{showTagline && (
					<span
						className="mt-1.5 font-mono uppercase tracking-[0.2em] text-accent"
						style={{ fontSize: Math.max(9, h * 0.2), lineHeight: 1 }}
					>
						Open Model Access
					</span>
				)}
			</div>
		</div>
	);
}
