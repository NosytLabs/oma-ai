"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function StatusError({
	error: _error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<div className="min-h-[60dvh] flex flex-col items-center justify-center px-4 py-20">
			<div className="w-full max-w-lg text-center flex flex-col items-center gap-6">
				<div className="flex items-center justify-center">
					<div className="flex h-16 w-16 items-center justify-center rounded-full border border-error/30 bg-error/10">
						<AlertTriangle className="h-8 w-8 text-error" aria-hidden="true" />
					</div>
				</div>
				<p className="text-xs text-text-muted uppercase tracking-widest font-mono">
					{">"} system_fault
				</p>
				<h1 className="section-headline text-text-bright">
					Failed to load status
				</h1>
				<p className="text-text-secondary text-sm">
					Could not fetch system status. Try again.
				</p>
				<button
					type="button"
					onClick={reset}
					className="btn-primary"
				>
					<RefreshCw className="h-4 w-4" />
					Retry
				</button>
			</div>
		</div>
	);
}
