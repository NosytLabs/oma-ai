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
	// User toggle always wins.
	if (opts.userExpanded) return true;
	// After streaming ends with no content and reasoning present, expose the
	// reasoning so the user isn't left with a blank bubble. Users who don't
	// care can leave it closed; the thinking-pill above the answer still
	// advertised that reasoning existed.
	if (!opts.streaming && hasReasoning && opts.content.trim().length === 0)
		return true;
	// During streaming we deliberately do NOT auto-expand the chain-of-
	// thought: word-by-word token dumps on a slow-reasoning model (observed
	// in production with MiniMax M2.7 free chat — 471 reasoning tokens
	// streamed live for a 4-word answer) make the surface look broken and
	// make the user abandon. The ThinkingOrb in the avatar column already
	// gives a progress signal. If the answer never arrives, the post-stream
	// branch above auto-expands; if it does arrive, the user can still click
	// to read the reasoning.
	return false;
}
