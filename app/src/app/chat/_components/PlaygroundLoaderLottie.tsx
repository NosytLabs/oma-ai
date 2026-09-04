"use client";

/**
	* PlaygroundLoaderDots — pure-CSS loader (three bouncing dots).
	* Used by /chat's `loading.tsx` while the client-only ChatPlaygroundShell
	* is dynamic-imported.
	*/
export function PlaygroundLoaderDots() {
	return (
		<div
			className="flex items-center justify-center gap-1.5"
			role="status"
			aria-label="Loading chat"
		>
			<span
				className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce"
				style={{ animationDelay: "0ms" }}
				aria-hidden="true"
			/>
			<span
				className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce"
				style={{ animationDelay: "150ms" }}
				aria-hidden="true"
			/>
			<span
				className="h-1.5 w-1.5 rounded-full bg-accent animate-bounce"
				style={{ animationDelay: "300ms" }}
				aria-hidden="true"
			/>
		</div>
	);
}
