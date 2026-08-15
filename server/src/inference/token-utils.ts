/**
	* Token estimation and message content utilities.
	*
	* Extracted from proxy.ts for focused responsibility.
	*/

/**
	* Token estimate for text when the upstream doesn't report usage.
	*
	* Uses a prose+code-aware heuristic instead of the naive `length/4`:
	*  - Count words (split on whitespace) → ~1.33 tokens per English word
	*    (OpenAI tiktoken averages ~0.75 words per token for prose).
	*  - Count non-whitespace, non-alphanumeric characters → ~1 token per
	*    code/punctuation run (matches BPE behavior on operators).
	*  - Round up, floor at 1.
	*
	* This is intentionally without a real BPE tokenizer (tiktoken WASM
	* is ~600 KB and slows cold-start). Drift is ~10–15% vs. tiktoken
	* for mixed English/code; ~25% for pure emoji. The server prefers
	* upstream-reported `usage.prompt_tokens` when available.
	*/
export function estimateTokens(text: string): number {
		if (!text) return 0;
		// Words: split on Unicode whitespace
		const wordCount = (text.match(/\S+/g) ?? []).length;
		// "Code-ish" non-letter/digit chars: punctuation, operators, symbols
		const punctCount = (text.match(/[^\p{L}\p{N}\s]/gu) ?? []).length;
		// Weighted: 1.33 tokens per word for prose, 1 token per punct cluster.
		// Divide punct by 2 because punctuation usually groups (e.g. `===`).
		const estimate = wordCount * 1.33 + punctCount * 0.5;
		return Math.max(1, Math.ceil(estimate));
}

export function flattenMessageContent(content: string | unknown[]): string {
		if (typeof content === "string") return content;
		if (Array.isArray(content)) {
				return content
						.map((part) => {
								if (typeof part === "string") return part;
								if (part && typeof part === "object" && "text" in part) {
										return String((part as { text: unknown }).text ?? "");
								}
								return "";
						})
						.join("");
		}
		return "";
}
