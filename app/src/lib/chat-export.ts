"use client";

import type { Message } from "@/components/chat/chat-message-shared";
import { isChatMessage } from "@/lib/chat-message-validation";

export type ExportFormat = "json" | "txt" | "md";

const ROLE_NAMES = { user: "User", assistant: "Assistant", system: "System" } as const;
const CONTENT_TYPES = { json: "application/json", md: "text/markdown", txt: "text/plain" } as const;

export function exportChatHistory(messages: Message[], format: ExportFormat, conversationId?: string) {
	if (messages.length === 0) return;
	const date = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
	const suffix = conversationId ? `-${conversationId.slice(0, 6)}` : "";
	const content = format === "json" ? JSON.stringify(messages, null, 2)
		: messages.map((message) => {
			const role = ROLE_NAMES[message.role];
			return format === "md" ? `### ${role}\n\n${message.content}\n`
				: `[${role}]\n${message.content}\n`;
		}).join("\n---\n\n");
	const url = URL.createObjectURL(new Blob([content], { type: CONTENT_TYPES[format] }));
	const link = document.createElement("a");
	link.href = url;
	link.download = `oma-chat-${date}${suffix}.${format}`;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}

export async function parseImportedChat(file: File): Promise<Message[]> {
	const text = await file.text();
	if (file.name.toLowerCase().endsWith(".json")) {
		let parsed: unknown;
		try {
			parsed = JSON.parse(text);
		} catch {
			throw new Error("Invalid JSON conversation file.");
		}
		if (!Array.isArray(parsed) || parsed.length === 0) {
			throw new Error("Invalid or empty conversation: expected an array of messages.");
		}
		const now = Date.now();
		const ids = new Set<string>();
		return parsed.map((value: unknown, index) => {
			if (!value || typeof value !== "object" || Array.isArray(value)) {
				throw new Error(`Invalid message at position ${index + 1}.`);
			}
			const fields = value as Record<string, unknown>;
			const candidate = { ...fields, timestamp: fields.timestamp ?? now };
			if (!isChatMessage(candidate)) {
				throw new Error(`Invalid message at position ${index + 1}: check its role, content, and metadata.`);
			}
			const id = candidate.id && !ids.has(candidate.id) ? candidate.id : crypto.randomUUID();
			ids.add(id);
			return { ...candidate, id };
		});
	}

	// Text and Markdown exports share an explicit separator and role heading.
	const messages: Message[] = [];
	for (const block of text.split(/\r?\n---\r?\n\r?\n/)) {
		const heading = block.trimStart().match(/^(?:### (User|Assistant|System)|\[(User|Assistant|System)\])\r?\n/i);
		if (!heading) continue;
		const role = (heading[1] ?? heading[2]).toLowerCase() as Message["role"];
		const content = block.trimStart().slice(heading[0].length).trim();
		if (content) messages.push({ id: crypto.randomUUID(), role, content, timestamp: Date.now() });
	}
	if (messages.length === 0) throw new Error("Could not extract any valid messages from the text file.");
	return messages;
}
