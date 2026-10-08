import { isA2UI } from "@/components/chat/A2UIRenderer";
import type { Message } from "@/components/chat/chat-message-shared";

export type MessageClassification =
	| { kind: "plain" }
	| { kind: "a2ui"; payload: unknown }
	| { kind: "openui"; response: string };

export interface ClassifyMessageOptions {
	format?: Message["format"];
	isStreaming?: boolean;
	/** OpenUI's catalog-aware parser; injectable so this helper remains pure. */
	isValidOpenUI?: (response: string) => boolean;
}

export function classifyMessage(
	content: string,
	options: ClassifyMessageOptions = {},
): MessageClassification {
	const trimmed = content.trimStart();
	const openui = classifyOpenUI(trimmed, options);
	if (openui) return openui;

	if (trimmed.startsWith("{")) {
		const parsed = safeJsonParse(trimmed);
		if (parsed && isA2UI(parsed)) return { kind: "a2ui", payload: parsed };
		if (isA2UI(trimmed)) return { kind: "a2ui", payload: trimmed };
		return { kind: "plain" };
	}

	return detectEmbeddedA2UI(trimmed);
}

function classifyOpenUI(
	content: string,
	options: ClassifyMessageOptions,
): Extract<MessageClassification, { kind: "openui" }> | null {
	const extracted = extractOpenUIResponse(content);
	const looksLikeAssignment = looksLikeOpenUIAssignment(extracted.response);

	if (options.isStreaming) {
		const looksLikeRequestedStream =
			options.format === "openui" &&
			looksLikeRequestedOpenUIStream(extracted.response);
		return extracted.explicit || looksLikeAssignment || looksLikeRequestedStream
			? { kind: "openui", response: extracted.response }
			: null;
	}

	if (!extracted.response) return null;
	const hasOpenUIPrefix =
		extracted.explicit || looksLikeAssignment || options.format === "openui";
	if (!hasOpenUIPrefix) return null;

	const isValid = options.isValidOpenUI
		? options.isValidOpenUI(extracted.response)
		: looksLikeAssignment;
	return isValid ? { kind: "openui", response: extracted.response } : null;
}

function looksLikeRequestedOpenUIStream(response: string): boolean {
	const withoutComments = stripLeadingLineComments(response);
	return (
		looksLikeOpenUIAssignment(withoutComments) ||
		looksLikePartialRootAssignment(withoutComments)
	);
}

function looksLikeOpenUIAssignment(response: string): boolean {
	return /^root\s*=|^[A-Za-z_$][\w$]*\s*=\s*[A-Z][\w$]*\s*\(/.test(response);
}

/** Keep an incomplete `root = Component(` prefix out of the text stream. */
function looksLikePartialRootAssignment(response: string): boolean {
	const firstLine = response.split(/\r?\n/, 1)[0].trim();
	if (!firstLine) return false;
	if ("root".startsWith(firstLine)) return true;
	return /^root\s*(?:=\s*(?:[A-Z][\w$]*)?)?$/.test(firstLine);
}

/** OpenUI Lang accepts `//` and `#` line comments before its root statement. */
function stripLeadingLineComments(response: string): string {
	let remaining = response.trimStart();
	while (remaining.startsWith("//") || remaining.startsWith("#")) {
		const nextLine = remaining.indexOf("\n");
		if (nextLine === -1) return "";
		remaining = remaining.slice(nextLine + 1).trimStart();
	}
	return remaining;
}

/** Remove a model-friendly OpenUI markdown fence without exposing it to users. */
function extractOpenUIResponse(content: string): {
	response: string;
	explicit: boolean;
} {
	const fence = content.match(/^```(?:openui|openui-lang)\s*(?:\r?\n)?/i);
	if (!fence) return { response: content.trim(), explicit: false };
	const body = content.slice(fence[0].length).replace(/\r?\n?```\s*$/, "");
	return { response: body.trim(), explicit: true };
}

function safeJsonParse(source: string): unknown {
	try {
		const value = JSON.parse(source);
		return value && typeof value === "object" ? value : null;
	} catch {
		return null;
	}
}

function detectEmbeddedA2UI(text: string): MessageClassification {
	if (!text.includes("{")) return { kind: "plain" };
	const candidates: string[] = [];
	let depth = 0;
	let openAt = -1;
	let inString = false;
	let escaped = false;

	for (let index = 0; index < text.length; index++) {
		const character = text[index];
		if (inString) {
			if (escaped) escaped = false;
			else if (character === "\\") escaped = true;
			else if (character === '"') inString = false;
			continue;
		}
		if (character === '"') {
			inString = true;
			continue;
		}
		if (character === "{") {
			if (depth === 0) openAt = index;
			depth++;
		} else if (character === "}" && depth > 0) {
			depth--;
			if (depth === 0 && openAt >= 0) {
				candidates.push(text.slice(openAt, index + 1));
				openAt = -1;
			}
		}
	}

	for (let index = candidates.length - 1; index >= 0; index--) {
		const parsed = safeJsonParse(candidates[index]);
		if (parsed && isA2UI(parsed)) return { kind: "a2ui", payload: parsed };
	}
	if (isA2UI(text)) return { kind: "a2ui", payload: text };
	return { kind: "plain" };
}
