/**
	* Token estimate for client-side cost previews.
	*
	* Mirrors the server-side heuristic in `server/src/inference/token-utils.ts`
	* — words × 1.33 + punctuation × 0.5. Roughly 10–15% drift vs. tiktoken,
	* vs. ~30% for the naive `length/4` (current upstream-reported usage is
	* preferred when available).
	*/
export function estimateTokens(text: string): number {
	if (!text) return 0;
	const wordCount = (text.match(/\S+/g) ?? []).length;
	const punctCount = (text.match(/[^\p{L}\p{N}\s]/gu) ?? []).length;
	return Math.max(1, Math.ceil(wordCount * 1.33 + punctCount * 0.5));
}
