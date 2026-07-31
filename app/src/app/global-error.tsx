"use client";

/**
 * Global Error Boundary
 *
 * Catches errors in the root layout itself (which the per-route error.tsx cannot).
 * Per Next.js 15 App Router convention, this MUST be a client component and MUST
 * include <html> and <body> tags because it replaces the root layout.
 *
 * Implementation note: we deliberately do NOT import anything from `@/lib/logger`
 * here. A previous version pulled `log` from the logger and called it inside a
 * `useEffect`, which — under React Refresh's eval-source-map dev bundle — would
 * throw a "Cannot read properties of undefined (reading 'call')" error during
 * hydration, blanking every page. The hook call site is fragile when the
 * callback contains webpack-substituted `process.env.NODE_ENV` checks; the safest
 * fix is to log via `console.error` directly (which is already what the
 * underlying logger wraps) and keep this boundary dependency-free.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/global-error
 */
interface GlobalErrorProps {
	error: Error & { digest?: string };
	reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
	if (typeof console !== "undefined" && error) {
		console.error("[GlobalError]", {
			message: error.message,
			digest: error.digest,
		});
	}

	return (
		<html lang="en">
			<body
				style={{
					minHeight: "100vh",
					margin: 0,
					backgroundColor: "#07090a",
					color: "#d8dcd6",
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
							color: "#9aa394",
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
							color: "#b4bbb0",
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
							border: "1px solid #46d39a",
							background: "#46d39a",
							color: "#07090a",
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
