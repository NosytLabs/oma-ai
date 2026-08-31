/**
	* Stream-status predicates for assistant message UI.
	* Kept pure so unit tests can lock the "no infinite THINKING…" contract
	* without mounting the full ChatMessage tree.
	*/

export function isWaitingForFirstToken(opts: {
	streaming: boolean;
	content: string;
	reasoning?: string;
}): boolean {
	const hasReasoning = !!opts.reasoning?.trim();
	// Waiting only when we have neither content nor reasoning tokens yet.
	// Reasoning-first models stream thinking before the answer — treat that
	// as progress, not a stuck empty bubble.
	return opts.streaming && opts.content.length === 0 && !hasReasoning;
}

export function shouldExpandReasoning(opts: {
	streaming: boolean;
	content: string;
	reasoning?: string;
	userExpanded?: boolean;
}): boolean {
	const hasReasoning = !!opts.reasoning?.trim();
	// Keep reasoning open while streaming with no answer yet, and after the
	// stream ends if the model never emitted visible content (answer only
	// in reasoning) so the user is not left with a blank bubble.
	return (
		!!opts.userExpanded ||
		(opts.streaming && !opts.content) ||
		(!opts.streaming && !opts.content.trim() && hasReasoning)
	);
}
