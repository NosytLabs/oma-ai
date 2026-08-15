import { redirect } from "next/navigation";

/**
	* Merged 2026-07-26: this standalone page duplicated the dashboard's
	* API KEYS tab (713 lines of parallel key-management UI that had already
	* drifted from the tab's behavior). Nothing in the app linked here — the
	* route survives only for bookmarks/deep links.
	*/
export default function ApiKeysRedirect() {
	redirect("/dashboard?tab=api-keys");
}
