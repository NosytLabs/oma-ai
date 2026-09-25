/**
 * Shared helpers for the model detail pages (`/models/[slug]`).
 *
 * `liveDisplayName` and `livePricePer1M` were previously copy-pasted
 * (byte-identical) in both `[slug]/page.tsx` and
 * `[slug]/_components/LiveModelDetail.tsx`. Keep them here so a fix lands
 * in both surfaces at once. These are distinct from `model-utils.ts`'s
 * `liveDisplayName` (which canonicalises a raw upstream display_name for the
 * chat dropdown — different signature and intent; do not merge them).
 */

/** Strip the provider prefix and title-case an upstream model id. */
export function liveDisplayName(id: string): string {
	return id
		.replace(/^(openai|minimax|together|deepinfra|venice)\//i, "")
		.split(/[-_]/)
		.map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ""))
		.filter(Boolean)
		.join(" ");
}

/** Convert an upstream per-token price string to per-1M-tokens. */
export function livePricePer1M(
	perToken: string | null | undefined,
): number | undefined {
	if (!perToken) return undefined;
	const n = parseFloat(perToken);
	return Number.isFinite(n) ? n * 1_000_000 : undefined;
}
