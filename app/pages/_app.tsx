/**
 * Minimal pages-router _app — required by Next.js 15 for the static
 * `/404` + `/500` HTML export chain.
 * The app router handles all real routes.
 */
import type { AppProps } from "next/app";

export default function App({ Component, pageProps }: AppProps) {
	return <Component {...pageProps} />;
}
