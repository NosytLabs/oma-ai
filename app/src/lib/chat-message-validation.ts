import type { Message, SearchResult } from "@/components/chat/chat-message-shared";

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSearchResult(value: unknown): value is SearchResult {
	return isRecord(value) && typeof value.title === "string" &&
		typeof value.url === "string" && typeof value.snippet === "string" &&
		(value.favicon === undefined || typeof value.favicon === "string");
}

/** Validate fields consumed by renderers while preserving future metadata. */
export function isChatMessage(value: unknown): value is Message {
	if (!isRecord(value)) return false;
	if (value.role !== "user" && value.role !== "assistant" && value.role !== "system") return false;
	if (typeof value.content !== "string" || typeof value.timestamp !== "number" || !Number.isFinite(value.timestamp)) return false;
	if (value.format !== undefined && value.format !== "text" && value.format !== "a2ui" && value.format !== "openui") return false;
	for (const field of ["id", "model", "reasoning"] as const) {
		if (value[field] !== undefined && typeof value[field] !== "string") return false;
	}
	for (const field of ["tokens", "latency", "inputTokens", "outputTokens"] as const) {
		const number = value[field];
		if (number !== undefined && (typeof number !== "number" || !Number.isFinite(number) || number < 0)) return false;
	}
	for (const field of ["truncated", "viaFallback", "degenerate"] as const) {
		if (value[field] !== undefined && typeof value[field] !== "boolean") return false;
	}
	if (value.finishReason !== undefined && value.finishReason !== null &&
		!["stop", "length", "content_filter", "tool_calls", "function_call"].includes(String(value.finishReason))) return false;
	return value.searchResults === undefined ||
		(Array.isArray(value.searchResults) && value.searchResults.every(isSearchResult));
}
