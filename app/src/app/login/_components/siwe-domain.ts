/**
 * The SIWE `domain` uses the current host, including its non-default port,
 * with OMA's apex/www prefix canonicalized to match the server.
 *
 * It used to prefer `process.env.NEXT_PUBLIC_APP_URL`, which Next.js
 * inlines at BUILD time. That let the shipped bundle disagree with the
 * live host: the bundle carried "https://oma-ai.com" while the site is
 * served from www.oma-ai.com. better-auth rejects the mismatch with
 * "SIWE message does not match the expected nonce, domain, address, or
 * chain ID", so wallet sign-in completed the wallet prompt and then
 * silently created no account.
 *
 * Read window.location.host rather than a build-time environment variable.
 */
/** Preserve the port; canonicalize the prefix before the wallet signs. */
export function resolveSiweDomain(): string {
	const host =
		typeof window !== "undefined" && window.location?.host
			? window.location.host
			: "oma-ai.com";
	return host.replace(/^www\./, "");
}
