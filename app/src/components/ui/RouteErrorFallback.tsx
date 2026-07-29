"use client";

import { AlertTriangle, Bug, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { log } from "@/lib/logger";

interface RouteErrorFallbackProps {
	error: Error & { digest?: string };
	reset: () => void;
	title?: string;
	routeName?: string;
}

export function RouteErrorFallback({
	error,
	reset,
	title = "Something went wrong",
	routeName = "page",
}: RouteErrorFallbackProps) {
	useEffect(() => {
		log.error(`[RouteError:${routeName}]`, error);
	}, [error, routeName]);

	const errorMessage = error.message || "An unexpected error occurred";

	return (
		<div className="min-h-[60dvh] flex flex-col items-center justify-center px-4">
			<div className="text-center max-w-lg">
				<div className="mb-6 flex items-center justify-center">
					<div className="flex h-16 w-16 items-center justify-center rounded-full border border-error/30 bg-error/10">
						<AlertTriangle className="h-8 w-8 text-error" />
					</div>
				</div>

				<p className="text-xs text-text-muted uppercase tracking-widest mb-2 font-mono">
					{">"} {routeName}_error
				</p>
				<h1 className="text-xl font-mono font-bold mb-3 text-text-bright">
					{title}
				</h1>
				<p className="text-text-secondary leading-relaxed text-sm mb-6">
					{errorMessage}
				</p>

				<div className="flex flex-col sm:flex-row items-center justify-center gap-3">
					<button type="button" onClick={reset} className="btn-primary">
						<RefreshCw className="h-4 w-4" />
						Retry
					</button>
					<Link href="/" className="btn-secondary">
						<Home className="h-4 w-4" />
						Home
					</Link>
					<a
						href={`mailto:support@nosytlabs.com?subject=${encodeURIComponent(`OMA bug report${error.digest ? ` (${error.digest.slice(0, 8)})` : ""}`)}&body=${encodeURIComponent(`Error: ${errorMessage}${error.digest ? `\nDigest: ${error.digest}` : ""}\n\nSteps to reproduce:\n1. \n\nExpected:\n\nActual:\n`)}`}
						className="btn-secondary"
					>
						<Bug className="h-4 w-4" />
						Report
					</a>
				</div>

				{error.digest && (
					<p className="mt-4 text-xs text-text-muted font-mono">
						Error ID: {error.digest.slice(0, 8)}
					</p>
				)}
			</div>
		</div>
	);
}
