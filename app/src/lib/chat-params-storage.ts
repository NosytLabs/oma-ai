/**
 * Persistence for the chat parameters panel (temperature, top_p, penalties,
 * max_tokens, top_k, stream).
 *
 * BUG-I: the panels used to hold these values as plain component state, so
 * they looked applied but nothing was ever stored — a reload silently
 * reverted every slider, and a failed write (private mode, quota exceeded,
 * corrupt JSON) had no error path and no revert. This module is the single
 * write point so callers can (a) surface a failure and (b) roll the UI back
 * to the last value that actually persisted.
 *
 * Reads are defensive: unknown/partial/out-of-range payloads fall back to
 * the defaults rather than feeding NaN into a request body.
 */

export interface ChatParams {
	temperature: number;
	topP: number;
	maxTokens: number;
	topK: number;
	freqPenalty: number;
	presPenalty: number;
	stream: boolean;
}

export const CHAT_PARAMS_STORAGE_KEY = "oma_chat_params";

export const CHAT_PARAMS_DEFAULTS: ChatParams = {
	temperature: 0.7,
	topP: 1,
	maxTokens: 2048,
	topK: 40,
	freqPenalty: 0,
	presPenalty: 0,
	stream: true,
};

/** Inclusive bounds, matching the slider/input ranges in SettingsPanel. */
export const CHAT_PARAM_BOUNDS: Record<keyof Omit<ChatParams, "stream">, [number, number]> = {
	temperature: [0, 2],
	topP: [0, 1],
	maxTokens: [1, 32000],
	topK: [1, 100],
	freqPenalty: [-2, 2],
	presPenalty: [-2, 2],
};

function clampNumber(key: keyof typeof CHAT_PARAM_BOUNDS, value: unknown): number {
	const [min, max] = CHAT_PARAM_BOUNDS[key];
	if (typeof value !== "number" || !Number.isFinite(value)) {
		return CHAT_PARAMS_DEFAULTS[key];
	}
	return Math.min(max, Math.max(min, value));
}

/** Merge a partial/unknown payload over the defaults, dropping junk fields. */
export function normalizeChatParams(raw: unknown): ChatParams {
	if (!raw || typeof raw !== "object") return { ...CHAT_PARAMS_DEFAULTS };
	const o = raw as Record<string, unknown>;
	return {
		temperature: clampNumber("temperature", o.temperature),
		topP: clampNumber("topP", o.topP),
		maxTokens: clampNumber("maxTokens", o.maxTokens),
		topK: clampNumber("topK", o.topK),
		freqPenalty: clampNumber("freqPenalty", o.freqPenalty),
		presPenalty: clampNumber("presPenalty", o.presPenalty),
		stream: typeof o.stream === "boolean" ? o.stream : CHAT_PARAMS_DEFAULTS.stream,
	};
}

/** Returns null when nothing has been stored yet. Never throws. */
export function readChatParams(): ChatParams | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(CHAT_PARAMS_STORAGE_KEY);
		if (!raw) return null;
		return normalizeChatParams(JSON.parse(raw));
	} catch {
		// Corrupt JSON or storage blocked — treat as "nothing saved" rather
		// than crashing the playground on mount.
		return null;
	}
}

/**
 * Write the params. Returns `true` on success and `false` when the write
 * failed (private mode, quota, serialization) so the caller can revert the
 * optimistic UI update and tell the user.
 */
export function writeChatParams(params: ChatParams): boolean {
	if (typeof window === "undefined") return false;
	try {
		window.localStorage.setItem(
			CHAT_PARAMS_STORAGE_KEY,
			JSON.stringify(normalizeChatParams(params)),
		);
		return true;
	} catch {
		return false;
	}
}
