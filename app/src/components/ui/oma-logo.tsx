/**
 * OMA brand mark and wordmark.
 *
 * Geometry is shared by the favicon, static SVG kit, and inline UI mark:
 * open emerald ring, terminal chevron, signal dot. Inline colors use theme
 * tokens so alternate accent themes stay coherent.
 */

import { OMA_WORD_MD, OMA_WORD_SM } from "./oma-word-paths";

const SIZE_MAP = {
	sm: { px: 24, ring: 2.4, chevron: 2.4, led: 1.7 },
	md: { px: 32, ring: 2.7, chevron: 2.7, led: 2.0 },
	lg: { px: 42, ring: 3.0, chevron: 3.0, led: 2.25 },
} as const;

type LogoSize = keyof typeof SIZE_MAP;

function OmaMark({
	width,
	height,
	ring,
	chevron,
	led,
	className,
	ariaHidden = false,
}: {
	width: number;
	height: number;
	ring: number;
	chevron: number;
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
			<circle cx={19} cy={20} r={12.5} fill="var(--color-accent)" opacity={0.1} />
			{/* Open gateway ring — gap at 3 o'clock */}
			<circle
				cx={19}
				cy={20}
				r={12}
				stroke="var(--color-accent)"
				strokeWidth={ring}
				strokeLinecap="round"
				strokeDasharray="57.5 17.5"
				strokeDashoffset={-8.75}
			/>
			{/* Terminal prompt chevron pointing through the gap */}
			<path
				d="M13 13.5 L23.5 20 L13 26.5"
				stroke="var(--color-accent)"
				strokeWidth={chevron}
				strokeLinecap="round"
				strokeLinejoin="round"
				fill="none"
			/>
			{/* Signal / token emission dot in the gap */}
			<circle cx={32.2} cy={20} r={led * 1.9} fill="var(--color-accent)" opacity={0.22} />
			<circle cx={32.2} cy={20} r={led * 1.2} fill="var(--color-accent)" />
			<circle cx={32.2} cy={20} r={led * 0.55} fill="var(--color-accent-bright)" />
		</svg>
	);
}

function OmaWordPath({
	size,
	className = "",
}: {
	size: LogoSize;
	className?: string;
}) {
	const word = size === "lg" ? OMA_WORD_MD : size === "md" ? OMA_WORD_MD : OMA_WORD_SM;
	const scale = size === "lg" ? 1.25 : size === "md" ? 1 : 1;
	return (
		<svg
			viewBox={`0 0 ${word.w} ${word.h}`}
			width={word.w * scale}
			height={word.h * scale}
			className={className}
			aria-hidden="true"
			fill="currentColor"
		>
			<path d={word.d} />
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
			chevron={s.chevron}
			led={s.led}
			className={className}
		/>
	);
}

/**
 * Nav lockup: mark + vector lowercase wordmark.
 * Uses the same SF Pro geometry as the static brand kit for crisp consistency.
 */
export function OmaNavLockup({
	size = "sm",
	className = "",
}: {
	size?: LogoSize;
	className?: string;
}) {
	const s = SIZE_MAP[size];

	return (
		<span
			className={`inline-flex items-center gap-2 text-text-bright ${className}`}
			aria-label="OMA — Open Model Access"
		>
			<OmaMark
				width={s.px}
				height={s.px}
				ring={s.ring}
				chevron={s.chevron}
				led={s.led}
				ariaHidden
			/>
			<span className="relative inline-flex transition-colors duration-200 ease-out group-hover:text-accent">
				{/* Vector glyph is visual; keep plain text for a11y + tests. */}
				<span className="sr-only">oma</span>
				<OmaWordPath size={size} />
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
	const wordSize: LogoSize = size === "sm" ? "sm" : "md";

	return (
		<div
			className={`inline-flex items-center gap-3 text-text-bright ${className}`}
			role="img"
			aria-label="OMA — Open Model Access"
		>
			<OmaMark
				width={mark}
				height={mark}
				ring={s.ring}
				chevron={s.chevron}
				led={s.led}
				ariaHidden
			/>
			<div className="flex flex-col leading-none">
				<span
					className="relative inline-flex items-center"
					style={{ height: h * 0.58 }}
				>
					<span className="sr-only">oma</span>
					<OmaWordPath
						size={wordSize}
						className={size === "lg" ? "origin-left scale-125" : ""}
					/>
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
