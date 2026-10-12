/**
 * The SIWE `domain` must be the host the browser is actually on.
 *
 * It used to prefer `process.env.NEXT_PUBLIC_APP_URL`, which Next.js
 * inlines at BUILD time. That let the shipped bundle disagree with the
 * live host: the bundle carried "https://oma-ai.com" while the site is
 * served from www.oma-ai.com. better-auth rejects the mismatch with
 * "SIWE message does not match the expected nonce, domain, address, or
 * chain ID", so wallet sign-in completed the wallet prompt and then
 * silently created no account.
 *
 * `window.location.host` is the only value guaranteed to match what the
 * user is looking at, so that is what we sign.
 */
/** EIP-4361 host form. Strip the `www.` prefix so apex and www are
 *  equivalent for SIWE signature comparison — the wallet signs whatever
 *  host the browser is on (apex or www) and the server configures the
 *  apex. better-auth's verifier does NOT normalize, so without this both
 *  oma-ai.com and www.oma-ai.com end up rejecting each other. */
export function resolveSiweDomain(): string {
	const host =
		typeof window !== "undefined" && window.location?.host
			? window.location.host
			: "oma-ai.com";
	return host.replace(/^www\./, "");
}
