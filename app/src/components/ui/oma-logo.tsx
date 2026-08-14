/**
 * OMA brand mark and wordmark.
 *
 * Geometry is shared by the favicon, static SVG kit, and inline UI mark:
 * open emerald ring, terminal chevron, signal dot. Inline colors use theme
 * tokens so alternate accent themes stay coherent.
 */

import { OMA_WORD_MD, OMA_WORD_SM } from "./oma-word-paths";

const SIZE_MAP = {
	sm: { px: 26, ring: 2.5, chevron: 2.55, led: 1.75 },
	md: { px: 34, ring: 2.85, chevron: 2.9, led: 2.05 },
	lg: { px: 44, ring: 3.15, chevron: 3.2, led: 2.35 },
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
				stroke="var(--color-border-hi, var(--color-border))"
				strokeWidth={1}
			/>
			{/* Soft aperture glow */}
			<circle cx={19} cy={20} r={13} fill="var(--color-accent)" opacity={0.11} />
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
				d="M12.5 13 L24 20 L12.5 27"
				stroke="var(--color-accent)"
				strokeWidth={chevron}
				strokeLinecap="round"
				strokeLinejoin="round"
				fill="none"
			/>
			{/* Signal / token emission dot in the gap */}
			<circle cx={32.4} cy={20} r={led * 1.95} fill="var(--color-accent)" opacity={0.2} />
			<circle cx={32.4} cy={20} r={led * 1.25} fill="var(--color-accent)" />
			<circle cx={32.4} cy={20} r={led * 0.55} fill="var(--color-accent-bright)" />
		</svg>
	);
}

/**
 * Lowercase "oma" wordmark. System UI font at optical weight so letters
 * stay correct at every size (hand-traced paths blur at 14px).
 */
function OmaWordText({
	size,
	className = "",
}: {
	size: LogoSize;
	className?: string;
}) {
	const word = size === "sm" ? OMA_WORD_SM : OMA_WORD_MD;
	const scale = size === "lg" ? 1.12 : 1;
	return (
		<svg
			viewBox={`0 0 ${word.w} ${word.h}`}
			width={word.w * scale}
			height={word.h * scale}
			className={className}
			aria-hidden="true"
			overflow="visible"
		>
			<text
				x={0}
				y={word.baseline}
				fill="currentColor"
				fontSize={word.fontSize}
				fontWeight={600}
				letterSpacing={word.letterSpacing}
				fontFamily="var(--font-body), ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif"
			>
				oma
			</text>
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
 * Nav lockup: mark + geometric lowercase wordmark.
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
			<span
				className="relative inline-flex items-center leading-none transition-colors duration-200 ease-out group-hover:text-accent"
				aria-hidden="true"
			>
				{/* Visual wordmark only — name comes from parent aria-label. */}
				<OmaWordText size={size} />
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
	const heights = { sm: 30, md: 42, lg: 56 } as const;
	const h = heights[size];
	const mark = h * 0.92;
	const s = SIZE_MAP[size];
	const wordSize: LogoSize = size === "sm" ? "sm" : "md";

	return (
		<div
			className={`inline-flex items-center gap-2.5 text-text-bright ${className}`}
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
			<div className="flex flex-col justify-center leading-none">
				<span
					className="relative inline-flex items-center"
					style={{ height: h * 0.52 }}
					aria-hidden="true"
				>
					<OmaWordText size={wordSize} />
				</span>
				{showTagline && (
					<span
						className="mt-1.5 font-mono uppercase tracking-[0.22em] text-accent"
						style={{ fontSize: Math.max(9, h * 0.18), lineHeight: 1 }}
					>
						Open Model Access
					</span>
				)}
			</div>
		</div>
	);
}
