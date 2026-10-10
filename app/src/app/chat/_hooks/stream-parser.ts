/**
 * SSE frame parsing for chat completions.
 *
 * This is deliberately pure. It was previously an inline closure inside the
 * 300-line `streamChatCompletion` callback in useStreamingChat.ts, which made
 * the only way to exercise it mount the hook and push a live stream through
 * it. Every edge case below is a real one we hit: truncated frames at chunk
 * boundaries, keepalive frames, reasoning models that emit a separate
 * thinking field, and a final usage frame.
 */

export type StreamDelta = {
	/** Assistant text for this frame, if present. */
	content?: string;
	/** Thinking/reasoning text for this frame, if present. */
	reasoning?: string;
	/** Real token total, from the final usage frame. Absent when unreported. */
	totalTokens?: number;
	inputTokens?: number;
	outputTokens?: number;
	/** Upstream finish_reason. "length" means the answer was cut short. */
	finishReason?: string;
};

/**
 * Parse one SSE `data:` payload into a flat delta.
 *
 * Returns null when the frame carries nothing to apply: blank lines, the
 * `[DONE]` sentinel, malformed JSON, and informational frames that carry only
 * a role or an empty choice. Callers treat null as a no-op.
 */
export function parseStreamData(raw: string): StreamDelta | null {
	const data = raw.trim();
	if (!data || data === "[DONE]") return null;

	let parsed: {
		choices?: Array<{
			delta?: {
				content?: unknown;
				reasoning_content?: unknown;
				reasoning?: unknown;
			};
			finish_reason?: unknown;
		}>;
		usage?: { total_tokens?: unknown; prompt_tokens?: unknown; completion_tokens?: unknown };
	};

	try {
		parsed = JSON.parse(data);
	} catch {
		// A frame split across a network boundary lands here. Dropping it is
		// correct: the reader re-frames, and throwing would kill the message.
		return null;
	}

	const choice = parsed.choices?.[0];
	const delta: StreamDelta = {};

	// Reasoning models (DeepSeek R1, Claude extended thinking) emit
	// `reasoning_content`; some emit plain `reasoning`. Prefer the former so
	// the thinking phase stays visible instead of rendering blank.
	const reasoning = choice?.delta?.reasoning_content ?? choice?.delta?.reasoning;
	if (typeof reasoning === "string" && reasoning) delta.reasoning = reasoning;

	const content = choice?.delta?.content;
	if (typeof content === "string" && content) delta.content = content;

	// Prefer the provider's real count over our text-length estimate. A zero
	// means "not reported", so it is treated as absent, matching the previous
	// truthy check.
	const total = parsed.usage?.total_tokens;
	if (typeof total === "number" && Number.isSafeInteger(total) && total > 0) delta.totalTokens = total;
	const input = parsed.usage?.prompt_tokens;
	const output = parsed.usage?.completion_tokens;
	if (typeof input === "number" && Number.isSafeInteger(input) && input >= 0) delta.inputTokens = input;
	if (typeof output === "number" && Number.isSafeInteger(output) && output >= 0) delta.outputTokens = output;

	const reason = choice?.finish_reason;
	if (typeof reason === "string" && reason.length > 0) {
		delta.finishReason = reason;
	}

	return Object.keys(delta).length > 0 ? delta : null;
}

/**
 * Append to a buffer, capping it and marking the cut exactly once so the user
 * sees that the response was truncated rather than having it silently stop.
 */
export function appendCapped(
	current: string,
	chunk: string,
	maxLength: number,
	truncationMarker?: string,
): string {
	if (!chunk) return current;
	if (current.length < maxLength) return current + chunk;
	// Only append the marker the first time the cap is hit, otherwise a long
	// stream would repeat it on every subsequent frame.
	if (truncationMarker && !current.endsWith(truncationMarker)) {
		return current + truncationMarker;
	}
	return current;
}
