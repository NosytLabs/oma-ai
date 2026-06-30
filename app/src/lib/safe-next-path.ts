/**
 * safeNextPath — same-origin, single-leading-slash path validator.
 *
 * Defends against open-redirect phishing by rejecting any value that could
 * resolve to a non-same-origin URL when fed to Next.js's `router.replace()`.
 *
 * Threats defeated:
 *   - `?next=//evil.com`          protocol-relative URL → caught
 *   - `?next=/\evil.com`          backslash trick → caught
 *   - `?next=/%5Cevil.com`        single-encoded backslash → caught
 *   - `?next=/%252F%252Fevil.com` double-encoded // → recursively decoded
 *                                  and caught
 *   - `?next=/%2525Cevil.com`     double-encoded backslash → caught
 *   - `?next=/%c0%af`             overlong UTF-8 slash (IE6/7-era) → caught
 *   - `?next=/%E0%80%AF`          overlong UTF-8 backslash → caught
 *   - `?next=/\u0000evil.com`     control chars → stripped then checked
 *   - `?next=javascript:...`      non-path schemes → caught (no leading /)
 *   - `?next=//user@evil.com`     userinfo trick → caught
 *
 * Always returns either the input (sanitized) or the `fallback` (default
 * `/dashboard`). Never throws.
 */

// `RegExp` constructor to avoid the "control character in regex" lint that
// fires on inline `/[\x00-\x1f]/` literals.
const CONTROL_CHARS = new RegExp("[\\x00-\\x1f\\x7f]", "g");

// Matches a percent-encoded byte (e.g. `%c0`, `%2F`, `%E0`). Used as a
// canary: if `decodeURIComponent` throws AND the input contains one of
// these, the malformed bytes are almost certainly an attack.
const PERCENT_BYTE = /%[0-9a-fA-F]{2}/;

export function safeNextPath(
	raw: string | null | undefined,
	fallback = "/dashboard",
): string {
	if (raw == null || typeof raw !== "string") return fallback;

	// Sanity cap — a legitimate next param never needs 2 KiB. Anything
	// longer is almost certainly an attempt to abuse the parser.
	if (raw.length > 2048) return fallback;

	// Strip ASCII control characters. A path that contains \r\n\0 is not
	// something a normal user types and is rejected up front. We do this
	// before the protocol-relative check so that an attacker can't smuggle
	// a leading control char past `startsWith("/")`.
	const cleaned = raw.replace(CONTROL_CHARS, "");
	if (cleaned.length === 0) return fallback;

	// Reject backslash anywhere. Some browsers normalize `\` to `/` in URL
	// resolution, so `/\evil.com` can resolve to `//evil.com`.
	if (cleaned.includes("\\")) return fallback;

	// Must start with a single leading slash.
	if (!cleaned.startsWith("/")) return fallback;
	if (cleaned.startsWith("//")) return fallback;

	// Fully decode (recursively) so we catch double- and triple-encoded
	// payloads. `URLSearchParams.get()` only decodes once, so a string like
	// `/%252F%252Fevil.com` arrives here as-is. We iteratively
	// `decodeURIComponent` until the value stabilizes, then validate the
	// fully-decoded form. If the fully-decoded value is not a safe
	// same-origin path, the input was trying to smuggle something past us.
	const decodeResult = fullyDecode(cleaned);
	if (decodeResult.threw) {
		// The first decode attempt threw (e.g. overlong UTF-8 like
		// `%c0%af`, or malformed percent-encoding). Modern browsers reject
		// overlong UTF-8 in URL paths the same way `decodeURIComponent`
		// does, so the literal string is safe to pass through. But for
		// defense in depth, if the input contains a percent-encoded byte
		// pattern (`%XX`) the malformed bytes are almost certainly an
		// attack. Reject to be safe.
		if (PERCENT_BYTE.test(cleaned)) return fallback;
		// No percent-encoded bytes — allow the literal string through
		// (e.g. `/dashboard%` is a path with a literal trailing `%`).
	}

	const fullyDecoded = decodeResult.value;

	if (CONTROL_CHARS.test(fullyDecoded)) return fallback;
	if (fullyDecoded.includes("\\")) return fallback;
	if (!fullyDecoded.startsWith("/")) return fallback;
	if (fullyDecoded.startsWith("//")) return fallback;

	return cleaned;
}

/**
 * Iteratively `decodeURIComponent` until the value stops changing, or until
 * we hit the iteration cap (5 layers is more than any legitimate use case
 * could ever need — a triple-encoded path that still resolves to a valid
 * route would be exceptional). Returns the value as of the last successful
 * decode; if the very first decode throws, returns the input and flags
 * `threw: true` so the caller can apply extra defense-in-depth rules.
 */
function fullyDecode(s: string): { value: string; threw: boolean } {
	let prev = s;
	try {
		const first = decodeURIComponent(s);
		if (first === s) return { value: s, threw: false };
		prev = first;
	} catch {
		return { value: s, threw: true };
	}
	for (let i = 1; i < 5; i++) {
		let next: string;
		try {
			next = decodeURIComponent(prev);
		} catch {
			// Malformed on a later iteration — return what we have.
			return { value: prev, threw: false };
		}
		if (next === prev) return { value: prev, threw: false };
		prev = next;
	}
	return { value: prev, threw: false };
}
