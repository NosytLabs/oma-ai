import mark from "@/lib/brand-mark.json";

const SIZES = {
	sm: { mark: 28, word: "text-[17px]", gap: "gap-2.5" },
	md: { mark: 38, word: "text-2xl", gap: "gap-3" },
	lg: { mark: 52, word: "text-[32px]", gap: "gap-3.5" },
} as const;

type LogoSize = keyof typeof SIZES;

/** Folded O/M loop, shared with every generated brand asset. */
function OmaMark({ size, className = "", decorative = false }: {
	size: number;
	className?: string;
	decorative?: boolean;
}) {
	return (
		<svg
			viewBox={mark.viewBox}
			width={size}
			height={size}
			fill="none"
			className={`shrink-0 text-accent ${className}`}
			aria-hidden={decorative || undefined}
			role={decorative ? undefined : "img"}
			aria-label={decorative ? undefined : "OMA"}
		>
			<path d={mark.path} stroke="currentColor" strokeWidth={mark.strokeWidth} strokeLinejoin="round" />
		</svg>
	);
}

export function OmaLogo({ size = "md", className = "" }: { size?: LogoSize; className?: string }) {
	return <OmaMark size={SIZES[size].mark} className={className} />;
}

export function OmaNavLockup({ size = "sm", className = "" }: { size?: LogoSize; className?: string }) {
	const style = SIZES[size];
	return (
		<span className={`inline-flex items-center ${style.gap} text-text-bright ${className}`} role="img" aria-label="OMA — Open Model Access">
			<OmaMark size={style.mark} decorative />
			<span aria-hidden="true" className={`${style.word} font-sans font-semibold leading-none tracking-[0.04em]`}>OMA</span>
		</span>
	);
}

export function OmaWordmark({ size = "md", className = "", showTagline = true }: {
	size?: LogoSize;
	className?: string;
	showTagline?: boolean;
}) {
	const style = SIZES[size];
	return (
		<div className={`inline-flex items-center ${style.gap} text-text-bright ${className}`} role="img" aria-label="OMA — Open Model Access">
			<OmaMark size={style.mark} decorative />
			<div className="flex flex-col justify-center" aria-hidden="true">
				<span className={`${style.word} font-sans font-semibold leading-none tracking-[0.04em]`}>OMA</span>
				{showTagline && <span className="mt-2 font-mono text-[9px] leading-none uppercase tracking-[0.16em] text-text-muted">Open Model Access</span>}
			</div>
		</div>
	);
}
