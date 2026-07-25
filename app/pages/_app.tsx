import type { AppProps } from "next/app";

/**
 * Minimal pages-router _app — required by Next.js 15 static generation
 * for the /404 + /500 fallback when no other source produces a 404.
 * The app router handles all real routes.
 */
export default function App({ Component, pageProps }: AppProps) {
	return <Component {...pageProps} />;
}
