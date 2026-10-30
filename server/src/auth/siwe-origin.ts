/** EIP-4361 origin binding shared by login and wallet attachment. */
export function isSiweOriginValid(
	message: { scheme?: string | null; uri?: string | null },
	expectedOrigin: string,
): boolean {
	try {
		const expected = new URL(expectedOrigin);
		// URL() repairs whitespace and backslashes; signed URI fields must
		// already be absolute HTTP(S) URIs rather than rely on those repairs.
		if (!message.uri || /[\\\s]/u.test(message.uri) || !/^https?:\/\//i.test(message.uri)) return false;
		const uri = new URL(message.uri);
		// EIP-4361 defines HTTPS as the default when the header omits scheme.
		const scheme = (message.scheme ?? "https").toLowerCase();
		return ["http:", "https:"].includes(expected.protocol) &&
			!expected.username && !expected.password && !uri.username && !uri.password &&
			`${scheme}:` === expected.protocol && uri.origin === expected.origin;
	} catch {
		return false;
	}
}
