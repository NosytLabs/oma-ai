/** Headers scoped to one HTTP connection, never forwarded to the next hop. */
const HOP_BY_HOP_HEADERS = [
	"connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
	"proxy-connection", "te", "trailer", "transfer-encoding", "upgrade", "host",
] as const;

interface HeaderFilter {
	get(name: string): string | null;
	delete(name: string): void;
}

/**
 * RFC 9110 section 7.6.1: remove Connection and every field it nominates.
 * Return the excluded names so separately preserved cookies cannot restore
 * a field that the upstream explicitly scoped to its connection.
 */
export function stripHopByHopHeaders(headers: HeaderFilter): Set<string> {
	const excluded = new Set<string>(HOP_BY_HOP_HEADERS);
	for (const option of headers.get("connection")?.split(",") ?? []) {
		const name = option.trim().toLowerCase();
		// Ignore malformed options rather than handing an invalid field name
		// to Headers.delete(), which would turn bad input into a proxy error.
		if (/^[!#$%&'*+.^_`|~0-9a-z-]+$/.test(name)) excluded.add(name);
	}
	for (const name of excluded) headers.delete(name);
	return excluded;
}
