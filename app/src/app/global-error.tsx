"use client";

import { useEffect } from "react";

/**
 * Global Error Boundary
 *
 * Catches errors in the root layout itself (which the per-route error.tsx cannot).
 * Per Next.js 15 App Router convention, this MUST be a client component and MUST
 * include <html> and <body> tags because it replaces the root layout.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/global-error
 */
interface GlobalErrorProps {
	error: Error & { digest?: string };
	reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
	useEffect(() => {
		if (process.env.NODE_ENV === "production") {
			console.error("[GlobalError]", {
				message: error.message,
				stack: error.stack,
				digest: error.digest,
			});
		}
	}, [error]);

	return (
		<html lang="en">
			<body
				style={{
					minHeight: "100vh",
					margin: 0,
					backgroundColor: "var(--color-void, #0a0a0f)",
					color: "var(--color-text, #e5e7eb)",
					fontFamily: "system-ui, -apple-system, sans-serif",
				}}
			>
				<div
					role="alert"
					aria-live="assertive"
					style={{
						minHeight: "100vh",
						display: "flex",
						flexDirection: "column",
						alignItems: "center",
						justifyContent: "center",
						padding: "2rem 1rem",
						textAlign: "center",
					}}
				>
					<p
						style={{
							fontSize: "0.75rem",
							letterSpacing: "0.1em",
							textTransform: "uppercase",
							color: "var(--color-text-muted, #9ca3af)",
							fontFamily: "monospace",
							marginBottom: "0.5rem",
						}}
					>
						{">"} fatal_fault
					</p>
					<h1
						style={{
							fontSize: "1.5rem",
							fontWeight: 700,
							margin: "0 0 0.75rem",
						}}
					>
						Application Error
					</h1>
					<p
						style={{
							color: "var(--color-text-secondary, #d1d5db)",
							maxWidth: "32rem",
							lineHeight: 1.6,
							margin: "0 0 1.5rem",
						}}
					>
						The application could not be loaded. Please try again — if the
						problem persists, contact support.
					</p>
					<button
						type="button"
						onClick={reset}
						style={{
							padding: "0.625rem 1.25rem",
							borderRadius: "0.5rem",
							border: "1px solid var(--color-accent, #f97316)",
							background: "var(--color-accent, #f97316)",
							color: "var(--color-void, #0a0a0f)",
							fontWeight: 600,
							cursor: "pointer",
						}}
					>
						Reload Application
					</button>
				</div>
			</body>
		</html>
	);
}
