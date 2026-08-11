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
 */
export function buildAuthEndpoint(base: string, path: string[]): string {
	return `${base}/api/auth/${path.join("/")}`;
}