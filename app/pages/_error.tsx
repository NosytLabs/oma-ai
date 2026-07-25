/**
 * Minimal pages-router _error — required so Next.js 15's static
 * `/404` + `/500` export doesn't pull in a framework chunk that tries
 * to use `<Html>` outside `pages/_document`. The app router handles
 * all real errors via `app/error.tsx` and `app/not-found.tsx`.
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
				fontFamily: "ui-monospace, monospace",
				color: "#e0e0e0",
				background: "#07090a",
			}}
		>
			<h1 style={{ fontSize: "3rem", fontWeight: 700, margin: 0 }}>
				Something went wrong
			</h1>
			<p style={{ marginTop: "1rem", color: "#9ca3af" }}>
				<Link href="/" style={{ color: "#46d39a", textDecoration: "underline" }}>
					Return home
				</Link>
			</p>
		</div>
	);
}

ErrorPage.getInitialProps = () => ({ statusCode: 500 });

export default ErrorPage;
