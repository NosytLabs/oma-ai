/** Backend base URL for the Better Auth proxy (same resolution logic as the
	*  route): NEXT_PUBLIC_AUTH_BASE_URL, falling back to NEXT_PUBLIC_API_URL,
	*  then the local default. Trailing slash stripped. */
export function resolveAuthBackend(): string {
	return (
		process.env.NEXT_PUBLIC_AUTH_BASE_URL ||
		process.env.NEXT_PUBLIC_API_URL ||
		"http://localhost:3001"
	).replace(/\/$/, "");
}

/**
	* Build the upstream URL for a /api/auth/<path> proxy request.
	* The backend serves auth under `/api/auth`, so the prefix must be included —
	* omitting it 404s every client auth call (get-session, sign-in, …).
	* Next.js has already decoded each catch-all segment. Encode it again so
	* URL syntax cannot turn an auth request into a different backend route.
	*/
export function buildAuthEndpoint(base: string, path: string[]): string {
	if (path.some(segment => !segment || segment === "." || segment === ".." || /[/\\]/.test(segment))) {
		throw new Error("Invalid auth path");
	}
	return `${base}/api/auth/${path.map(encodeURIComponent).join("/")}`;
}
