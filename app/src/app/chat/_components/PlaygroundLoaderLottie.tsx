"use client";

/**
 * PlaygroundLoaderDots — pure-CSS loader (three bouncing dots).
 *
 * Replaces a single-dot opacity-pulse Lottie (~1.4 KB JSON + lottie-react
 * runtime overhead) with three staggered bouncing dots. Zero JavaScript
 * at runtime, GPU-composited animation.
 *
 * Exported as `PlaygroundLoaderLottie` for back-compat with the old name
 * (consumers in chat/loading.tsx keep working). New code should import
 * `PlaygroundLoaderDots` for clarity.
 */
export function PlaygroundLoaderLottie() {
	return <PlaygroundLoaderDots />;
}

export function PlaygroundLoaderDots() {
	return (
		<div
			className="flex items-center justify-center gap-2"
			aria-label="Loading playground"
		>
			<div
				className="h-3 w-3 rounded-full bg-accent animate-bounce"
				aria-hidden="true"
			/>
			<div
				className="h-3 w-3 rounded-full bg-accent animate-bounce"
				style={{ animationDelay: "0.15s" }}
				aria-hidden="true"
			/>
			<div
				className="h-3 w-3 rounded-full bg-accent animate-bounce"
				style={{ animationDelay: "0.3s" }}
				aria-hidden="true"
			/>
		</div>
	);
}
