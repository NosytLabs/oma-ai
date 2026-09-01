/**
 * BUG-D (audit 2026-09-01-userflow.md): when the upstream is at capacity
 * the fallback peer sometimes returns degenerate output (e.g. the same
 * token repeated hundreds of times — "responseek, responseek, …" for
 * "Reply with the single word: ok"). Detect this so the UI can flag it
 * instead of rendering a 300-token wall of garbage as a normal reply.
 *
 * Heuristic: if the response is > 80 chars and the unique-token ratio
 * is < 15%, treat it as degenerate. The threshold is intentionally
 * loose — a real answer with a recurring word (e.g. "the") still has
 * high unique-token ratios; only pathological repetition trips it.
 */
export function isDegenerateResponse(content: string): boolean {
	const trimmed = content.trim();
	if (trimmed.length < 80) return false;
	const tokens = trimmed.split(/\s+/).filter(Boolean);
	if (tokens.length < 20) return false;
	const unique = new Set(tokens);
	return unique.size / tokens.length < 0.15;
}
