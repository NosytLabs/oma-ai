"use client";

import { Message } from "@/components/chat";

export type ExportFormat = "json" | "txt" | "md";

export function exportChatHistory(messages: Message[], format: ExportFormat, conversationId?: string) {
		if (!messages || messages.length === 0) return;

		const dateStr = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
		const cid = conversationId ? `-${conversationId.slice(0, 6)}` : "";
		const filename = `oma-chat-${dateStr}${cid}.${format}`;
		
		let content = "";
		
		if (format === "json") {
				content = JSON.stringify(messages, null, 2);
		} else if (format === "txt" || format === "md") {
				const isMd = format === "md";
				content = messages.map((m) => {
						const roleName = m.role === "user" ? "User" : m.role === "assistant" ? "Assistant" : "System";
						if (isMd) {
								return `### ${roleName}\n\n${m.content}\n`;
						}
						return `[${roleName}]\n${m.content}\n`;
				}).join("\n---\n\n");
		}

		const blob = new Blob([content], { type: format === "json" ? "application/json" : "text/plain" });
		const url = URL.createObjectURL(blob);
		
		const a = document.createElement("a");
		a.href = url;
		a.download = filename;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);
}

export async function parseImportedChat(file: File): Promise<Message[]> {
		const text = await file.text();
		
		if (file.name.endsWith(".json")) {
				try {
						const parsed = JSON.parse(text);
						if (!Array.isArray(parsed)) throw new Error("Invalid format: not an array");
						
						// Basic validation
						const isValid = parsed.every(m => typeof m === "object" && m.role && typeof m.content === "string");
						if (!isValid) throw new Error("Invalid message structure");
						
						return parsed as Message[];
				} catch (err: unknown) {
						throw new Error(`Failed to parse JSON chat history: ${err instanceof Error ? err.message : String(err)}`);
				}
		}

		// Very basic txt/md parser based on our export format
		// In a robust implementation, this could use regex to better match blocks
		const blocks = text.split(/\n---\n\n/);
		const messages: Message[] = [];
		
		for (const block of blocks) {
				if (!block.trim()) continue;
				
				// Check if it's markdown format (### Role) or txt format ([Role])
				const roleMatch = block.match(/^(### \w+|\[\w+\])/);
				if (!roleMatch) continue;
				
				const roleStr = roleMatch[0].toLowerCase();
				const role = roleStr.includes("user") ? "user" : roleStr.includes("assistant") ? "assistant" : "system";
				
				const content = block.slice(roleMatch[0].length).trim();
				if (content) {
						messages.push({
								id: crypto.randomUUID(),
								role: role as "user" | "assistant" | "system",
								content,
								timestamp: Date.now()
						});
				}
		}
		
		if (messages.length === 0) {
				throw new Error("Could not extract any valid messages from text file");
		}
		
		return messages;
}
