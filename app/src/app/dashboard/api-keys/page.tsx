import { redirect } from "next/navigation";

/**
 * Merged 2026-07-26: this standalone page duplicated the dashboard's
 * API KEYS tab (713 lines of parallel key-management UI that had already
 * drifted from the tab's behavior). Nothing in the app linked here — the
 * route survives only for bookmarks/deep links.
 */
export default async function ApiKeysRedirect({
	searchParams,
}: {
	searchParams?: Promise<{ demo?: string }>;
}) {
	// Preserve the demo-tour flag: without it the middleware on the
	// redirect target (no query) clears the just-set demo cookies and a
	// `?demo=1` deep link lands on the signed-out gate instead of the tour.
	const demo = (await searchParams)?.demo === "1" ? "?demo=1&" : "?";
	redirect(`/dashboard${demo}tab=api-keys`);
}
