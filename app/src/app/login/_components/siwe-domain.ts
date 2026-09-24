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
export function resolveSiweDomain(): string {
	if (typeof window !== "undefined" && window.location?.host) {
		return window.location.host;
	}
	// SSR / non-browser fallback. The server accepts both apex and www.
	return "oma-ai.com";
}
