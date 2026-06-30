"use client";

/**
 * NotFoundLottie — pure-CSS 404 indicator.
 *
 * Replaces a 0-animated-property Lottie (~1.3 KB JSON + lottie-react runtime
 * overhead) with two pulsing rings around a monospace "404". Zero JavaScript
 * at runtime, GPU-composited animation.
 */

export function NotFoundLottie({ className }: { className?: string }) {
	return (
		<div className={className}>
			<div className="relative h-full w-full flex items-center justify-center">
				<div className="absolute inset-0 border-[4px] border-accent/30 rounded-full animate-pulse" />
				<div
					className="absolute inset-8 border-[2px] border-accent/20 rounded-full animate-pulse"
					style={{ animationDelay: "0.5s" }}
				/>
				<div className="relative text-text-muted text-7xl font-mono">404</div>
			</div>
		</div>
	);
}
