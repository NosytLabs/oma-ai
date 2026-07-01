"use client";

import { AlertTriangle, Bug, Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

interface ErrorPageProps {
	error: Error & { digest?: string };
	reset: () => void;
}

/**
 * Error — global error boundary fallback.
 * Clean card, single primary retry CTA, optional stack-trace disclosure.
 * Acknowledges system_fault in mono prefix to match the brand voice.
 */

export default function ErrorPage({ error, reset }: ErrorPageProps) {
	useEffect(() => {
		console.error("[GlobalError]", error);
	}, [error]);

	const isKnownError = error.digest !== undefined;
	const errorMessage = error.message || "An unexpected system fault occurred";

	return (
		<div className="min-h-[70dvh] flex flex-col items-center justify-center px-4 py-20">
			<div className="w-full max-w-lg text-center flex flex-col items-center gap-6">
				<div className="flex items-center justify-center">
					<div className="relative">
						<div className="flex h-20 w-20 items-center justify-center rounded-full border border-error/30 bg-error/10">
							<AlertTriangle
								className="h-10 w-10 text-error"
								strokeWidth={1.5}
								aria-hidden="true"
							/>
						</div>
						<span className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-error text-xs font-bold text-text-inverse">
							!
						</span>
					</div>
				</div>

				<div className="flex flex-col gap-3">
					<p className="text-xs text-text-muted uppercase tracking-[0.18em] font-mono">
						{">"} system_interrupt
					</p>
					<h1 className="section-headline text-text-bright">
						Something broke.
					</h1>
					<p className="text-text-secondary leading-relaxed text-sm max-w-md mx-auto">
						{errorMessage}
					</p>
					{isKnownError && (
						<p className="text-xs text-text-muted font-mono">
							Error ID: {error.digest?.slice(0, 8)}
						</p>
					)}
				</div>

				<div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-2">
					<Button onClick={reset} leftIcon={<RefreshCw className="h-4 w-4" />}>
						Retry request
					</Button>
					<Button asChild variant="secondary" leftIcon={<Home className="h-4 w-4" />}>
						<Link href="/">Return home</Link>
					</Button>
					<Button asChild variant="ghost" leftIcon={<Bug className="h-4 w-4" />}>
						<a
							href={`mailto:support@oma-ai.com?subject=${encodeURIComponent(
								`OMA Gateway bug report${error.digest ? ` (${error.digest.slice(0, 8)})` : ""}`,
							)}&body=${encodeURIComponent(
								`Error: ${errorMessage}${error.digest ? `\nDigest: ${error.digest}` : ""}\n\nSteps to reproduce:\n1. \n\nExpected:\n\nActual:\n`,
							)}`}
						>
							Report bug
						</a>
					</Button>
				</div>

				{error.stack && (
					<details
						open
						className="mt-4 text-left w-full"
						style={{ maxHeight: 320, overflow: "auto" }}
					>
						<summary className="text-xs text-text-muted cursor-pointer hover:text-text flex items-center gap-2">
							<Bug className="h-3 w-3" aria-hidden="true" />
							Stack trace
						</summary>
						<pre className="mt-3 p-4 surface-code rounded text-xs text-text-muted overflow-x-auto whitespace-pre-wrap">
							{error.stack}
						</pre>
					</details>
				)}
			</div>
		</div>
	);
}