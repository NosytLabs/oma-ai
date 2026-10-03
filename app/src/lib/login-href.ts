const LOCAL_ORIGIN = "https://oma.invalid";

/** Keep authentication returns on-site and out of the sign-in page itself. */
export function safeLoginNext(raw: string | null | undefined): string {
	if (!raw || !raw.startsWith("/") || raw.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(raw)) return "/dashboard";
	try {
		const url = new URL(raw, LOCAL_ORIGIN);
		const path = url.pathname.replace(/\/+$/, "");
		if (url.origin !== LOCAL_ORIGIN || path === "/login") return "/dashboard";
		// The marketing homepage is not a post-sign-in destination. Sign-in CTAs
		// on the homepage pass next=/ , which used to bounce the visitor
		// straight back to the homepage and read as "sign-in did nothing".
		// Land on the account view instead, matching every other entry point.
		if (path === "") return "/dashboard";
		return `${url.pathname}${url.search}${url.hash}`;
	} catch {
		return "/dashboard";
	}
}

/** Preserve query selections, including a model or account tab, through sign-in. */
export function buildLoginHref(returnTo: string): string {
	let destination = returnTo;
	if (returnTo.startsWith("/login?") || returnTo.startsWith("/login/?")) {
		destination = new URL(returnTo, LOCAL_ORIGIN).searchParams.get("next") ?? "/dashboard";
	}
	return `/login?next=${encodeURIComponent(safeLoginNext(destination))}`;
}
