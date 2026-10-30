/** Use the wallet request's exact authority, including www and local ports. */
export function resolveSiweDomain(): string {
	const host =
		typeof window !== "undefined" && window.location?.host
			? window.location.host
			: "www.oma-ai.com";
	return host;
}
