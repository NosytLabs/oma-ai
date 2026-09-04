import { PlaygroundLoaderDots } from "./_components/PlaygroundLoaderLottie";

export default function Loading() {
	return (
		<div
			className="min-h-dvh flex flex-col bg-void"
			role="status"
			aria-live="polite"
			aria-label="Loading chat playground"
		>
			<div className="flex-none border-b border-border p-4">
				<div
					className="h-6 w-32 bg-surface animate-pulse"
					aria-hidden="true"
				/>
			</div>
			<div className="flex-1 flex flex-col items-center justify-center p-8">
				<PlaygroundLoaderDots />
				<div className="text-text-muted font-mono text-xs uppercase tracking-widest animate-pulse">
					<span
						className="inline-block h-2 w-2 bg-accent mr-2 animate-pulse"
						aria-hidden="true"
					/>
					INITIALIZING_PLAYGROUND…
				</div>
			</div>
		</div>
	);
}
