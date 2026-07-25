/**
 * pages-router _error.tsx — needed so Next.js 15 uses our own /404 + /500
 * static fallback instead of Sentry's auto-injected chunk that crashes on
 * `<Html> should not be imported outside of pages/_document`.
 * The app router handles all real routes; this only fires for the
 * static 404.html / 500.html fallback exports.
 */
import Link from "next/link";

function ErrorPage() {
	return (
		<div
			style={{
				minHeight: "100dvh",
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				padding: "2rem",
				fontFamily:
					"ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
				color: "#e5e5e5",
				background: "#0a0a0a",
			}}
		>
			<h1
				style={{
					fontSize: "3rem",
					fontWeight: 700,
					margin: 0,
					letterSpacing: "-0.02em",
				}}
			>
				404
			</h1>
			<p
				style={{
					marginTop: "1rem",
					color: "#a3a3a3",
					textAlign: "center",
				}}
			>
				Route not found.{" "}
				<Link href="/" style={{ color: "#10b981", textDecoration: "underline" }}>
					Return home
				</Link>
				.
			</p>
		</div>
	);
}

ErrorPage.getInitialProps = () => ({ statusCode: 404 });

export default ErrorPage;
