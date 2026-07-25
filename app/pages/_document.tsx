import { Html, Head, Main, NextScript } from "next/document";

/**
 * Minimal pages-router _document — required by Next.js 15 static
 * generation for the /404 + /500 fallback. The app router handles all
 * real routes.
 */
export default function Document() {
	return (
		<Html lang="en">
			<Head />
			<body>
				<Main />
				<NextScript />
			</body>
		</Html>
	);
}
