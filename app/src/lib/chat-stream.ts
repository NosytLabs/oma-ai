import type { Message } from "@/components/chat";
import { parseSSEBlock, type SSEBlock } from "@/lib/sse-parser";

/**
	* Shared primitives for the SSE chat pipeline: raw block consumption,
	* think-tag routing, response-status classification, and empty-assistant
	* cleanup. Pure (React-free) so the logic runs in tests without a hook.
	*/

export const MAX_MESSAGE_LENGTH = 100 * 1024;
export const BATCH_INTERVAL_MS = 250;

export interface DailyQuota {
	remaining: number;
	limit: number;
	exhausted?: boolean;
}

/**
	* Remove a trailing empty assistant placeholder. Sends that fail mid-flight
	* or abort before any token arrives leave an assistant message with
	* content === "" in the list; strip it so the conversation doesn't show a
	* phantom reply.
	*/
export function stripPendingAssistant(messages: Message[]): Message[] {
	if (messages.length > 0 && messages[messages.length - 1]?.content === "") {
		return messages.slice(0, -1);
	}
	return messages;
}

export interface ThinkRouterHandlers {
	onContent: (chunk: string) => void;
	onReasoning: (chunk: string) => void;
}

export interface ThinkRouter {
	route: (token: string) => void;
	flushTail: () => void;
}

/**
	* State machine that routes content deltas into prose vs. the "thinking"
	* section. Some models wrap reasoning inside <thinking>…</think> tags in
	* the `content` field rather than emitting a separate `reasoning_content`
	* delta; watch for those tags and route the enclosed text to the reasoning
	* handler so the rendered answer never shows the raw markup. A carry-over
	* buffer keeps partial tags that span two SSE chunks aligned.
	*/
export function createThinkRouter(handlers: ThinkRouterHandlers): ThinkRouter {
	const THINK_OPEN = "<thinking>";
	const THINK_CLOSE = "</think>";
	let inThinkingBlock = false;
	// Carry-over buffer for partial tag matches that span two SSE chunks.
	let tagCarry = "";

	const route = (token: string) => {
		if (!token) return;
		// Splice the carry-over so partial tags that arrived in the
		// previous chunk now line up with the next one.
		const stream = tagCarry + token;
		tagCarry = "";
		let cursor = 0;
		while (cursor < stream.length) {
			if (!inThinkingBlock) {
				// Look for the next <thinking> opening tag.
				const openIdx = stream.indexOf(THINK_OPEN, cursor);
				if (openIdx === -1) {
					// No more tags in this slice. Before flushing, keep
					// the last few chars as carry-over so a partial tag
					// that landed at the chunk boundary isn't lost. Clamp
					// to cursor so text after an open tag in this chunk
					// isn't sliced off past its start.
					const safeLen = Math.max(
						cursor,
						stream.length - (THINK_OPEN.length - 1),
					);
					const safeSlice = stream.slice(cursor, safeLen);
					const tail = stream.slice(safeLen);
					if (safeSlice) handlers.onContent(safeSlice);
					tagCarry = tail;
					break;
				}
				// Flush the prose before the tag, then drop the tag itself.
				const before = stream.slice(cursor, openIdx);
				if (before) handlers.onContent(before);
				cursor = openIdx + THINK_OPEN.length;
				inThinkingBlock = true;
			} else {
				// Inside a thinking block — look for the closing tag.
				const closeIdx = stream.indexOf(THINK_CLOSE, cursor);
				if (closeIdx === -1) {
					const safeLen = Math.max(
						cursor,
						stream.length - (THINK_CLOSE.length - 1),
					);
					const safeSlice = stream.slice(cursor, safeLen);
					const tail = stream.slice(safeLen);
					if (safeSlice) handlers.onReasoning(safeSlice);
					tagCarry = tail;
					break;
				}
				const inside = stream.slice(cursor, closeIdx);
				if (inside) handlers.onReasoning(inside);
				cursor = closeIdx + THINK_CLOSE.length;
				inThinkingBlock = false;
			}
		}
	};

	const flushTail = () => {
		// Trailing content that straddled a chunk boundary would otherwise
		// be lost forever once the stream ends.
		if (tagCarry) {
			if (inThinkingBlock) handlers.onReasoning(tagCarry);
			else handlers.onContent(tagCarry);
			tagCarry = "";
		}
	};

	return { route, flushTail };
}

/**
	* Read a fetch Response body to completion, splitting the payload into SSE
	* blocks (blank-line delimited, CRLF-normalized), parsing each block, and
	* forwarding only valid blocks to the callback. The buffer is capped at
	* 1 MB to prevent unbounded growth on a stalled or non-SSE connection.
	* Always releases the reader in `finally` so the connection doesn't linger
	* in the browser's pool until GC.
	*/
export async function consumeSSE(
	reader: ReadableStreamDefaultReader<Uint8Array>,
	onBlock: (block: SSEBlock) => void,
): Promise<void> {
	const decoder = new TextDecoder();
	const SSE_BUFFER_MAX_BYTES = 1024 * 1024;
	let sseBuffer = "";
	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			sseBuffer += decoder.decode(value, { stream: true });
			if (sseBuffer.length > SSE_BUFFER_MAX_BYTES) {
				throw new Error(
					"SSE buffer exceeded 1 MB limit — connection may be stalled or sending non-SSE data",
				);
			}
			// Per the SSE spec, events are delimited by a blank line. Normalize
			// CRLF to LF so a single `\n\n` split handles all line endings.
			const normalized = sseBuffer.replace(/\r\n/g, "\n");
			const parts = normalized.split("\n\n");
			sseBuffer = parts.pop() ?? "";
			for (const block of parts) {
				const parsed = parseSSEBlock(block);
				if (parsed) onBlock(parsed);
			}
		}
		if (sseBuffer.trim()) {
			const parsed = parseSSEBlock(sseBuffer);
			if (parsed) onBlock(parsed);
			sseBuffer = "";
		}
	} finally {
		try {
			reader.cancel();
		} catch {
			// already closed / aborted — nothing to do
		}
	}
}

export interface ChatResponseOptions {
	freeModel: boolean;
	onDailyQuota?: (quota: DailyQuota) => void;
}

/**
	* Sync guest free-tier quota from daily-limit headers on every response
	* that carries them (success and rate-limit), then classify the status:
	* 401 → auth error, 429 → rate limit (surfacing daily_limit_exceeded to
	* the quota callback), anything else non-OK → HTTP error. Throws the
	* user-facing Error; returns normally for 2xx.
	*/
export async function handleChatResponseStatus(
	response: Response,
	opts: ChatResponseOptions,
): Promise<void> {
	const headerRem = response.headers.get("X-DailyLimit-Remaining");
	const headerLim = response.headers.get("X-DailyLimit-Limit");
	if (headerRem != null && opts.onDailyQuota) {
		const remaining = Number(headerRem);
		const limit = headerLim != null ? Number(headerLim) : 20;
		if (Number.isFinite(remaining)) {
			opts.onDailyQuota({
				remaining: Math.max(0, Math.floor(remaining)),
				limit:
					Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 20,
			});
		}
	}

	if (response.status === 401) {
		throw new Error(
			opts.freeModel
				? "Free model request was rejected — try again or pick another OMA-AI free model"
				: "Authentication required — sign in and create an API key for paid models (OMA-AI free models work without sign-in)",
		);
	}
	if (response.status === 429) {
		const errBody = await response.json().catch(() => null);
		const err = errBody?.error as
			| {
					message?: string;
					code?: string;
					remaining?: number;
					limit?: number;
			  }
			| undefined;
		// Server daily cap — pin UI free-left to 0 (do not keep local optimistic count).
		if (err?.code === "daily_limit_exceeded" && opts.onDailyQuota) {
			opts.onDailyQuota({
				remaining:
					typeof err.remaining === "number" ? Math.max(0, err.remaining) : 0,
				limit:
					typeof err.limit === "number" && err.limit > 0 ? err.limit : 20,
				exhausted: true,
			});
		}
		throw new Error(
			err?.message || "rate limit exceeded — please wait and try again",
		);
	}
	if (!response.ok) {
		const errBody = await response.json().catch(() => null);
		const errMsg =
			errBody?.error?.message ||
			`HTTP ${response.status}: ${response.statusText}`;
		throw new Error(errMsg);
	}
}