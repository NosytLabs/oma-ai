import type { Metadata } from "next";

/** Defense-in-depth: /design/* is blocked at the middleware layer (404),
 *  but if that ever regresses, robots noindex keeps it out of search. */
export const metadata: Metadata = {
	robots: { index: false, follow: false },
};

export default function DesignLayout({
	children,
}: { children: React.ReactNode }) {
	return children;
}
