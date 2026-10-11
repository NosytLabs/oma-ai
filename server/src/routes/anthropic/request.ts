import { z } from "zod";
import type { CallProviderOptions } from "../../inference/proxy.js";

const textBlock = z.object({ type: z.literal("text"), text: z.string() });
const contentBlock = z.discriminatedUnion("type", [
	textBlock,
	z.object({ type: z.literal("tool_use"), id: z.string().min(1), name: z.string().min(1), input: z.record(z.string(), z.unknown()) }),
	z.object({ type: z.literal("tool_result"), tool_use_id: z.string().min(1), content: z.union([z.string(), z.array(textBlock)]), is_error: z.boolean().optional() }),
]);
export const anthropicSchema = z.object({
	model: z.string(),
	messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.union([z.string(), z.array(contentBlock).min(1)]) }).superRefine((message, ctx) => {
		if (Array.isArray(message.content) && message.content.some(block =>
			(message.role === "user" && block.type === "tool_use") || (message.role === "assistant" && block.type === "tool_result"))) {
			ctx.addIssue({ code: "custom", path: ["content"], message: "tool_use belongs to assistant messages; tool_result belongs to user messages" });
		}
	})).min(1),
	system: z.union([z.string(), z.array(textBlock)]).optional(),
	max_tokens: z.number().int().positive(),
	temperature: z.number().min(0).max(1).optional(), top_p: z.number().min(0).max(1).optional(),
	stream: z.boolean().optional().default(false),
	tools: z.array(z.object({ name: z.string().min(1), description: z.string().optional(), input_schema: z.record(z.string(), z.unknown()) })).optional(),
	tool_choice: z.discriminatedUnion("type", [
		z.object({ type: z.literal("auto") }), z.object({ type: z.literal("any") }), z.object({ type: z.literal("none") }),
		z.object({ type: z.literal("tool"), name: z.string().min(1) }),
	]).optional(),
});
type Request = z.infer<typeof anthropicSchema>;

export function toOpenAIMessages(messages: Request["messages"], system?: Request["system"]): CallProviderOptions["messages"] {
	const result: CallProviderOptions["messages"] = [];
	if (system) result.push({ role: "system", content: typeof system === "string" ? system : system.map(s => s.text).join("\n") });
	for (const message of messages) {
		if (typeof message.content === "string") { result.push({ role: message.role, content: message.content }); continue; }
		const text = message.content.filter(b => b.type === "text").map(b => b.text).join("");
		const calls = message.content.filter(b => b.type === "tool_use").map(b => ({ id: b.id, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input) } }));
		if (message.role === "assistant") {
			result.push({ role: "assistant", content: text || null, ...(calls.length ? { tool_calls: calls } : {}) });
		} else {
			for (const block of message.content) if (block.type === "tool_result") result.push({ role: "tool", tool_call_id: block.tool_use_id, content: typeof block.content === "string" ? block.content : block.content.map(b => b.text).join("\n") });
			if (text) result.push({ role: "user", content: text });
		}
	}
	return result;
}

export function toOpenAITools(tools: Request["tools"]) {
	return tools?.map(tool => ({ type: "function", function: { name: tool.name, ...(tool.description ? { description: tool.description } : {}), parameters: tool.input_schema } }));
}
export function toOpenAIToolChoice(choice: Request["tool_choice"]) {
	if (!choice) return undefined;
	if (choice.type === "tool") return { type: "function", function: { name: choice.name } };
	return choice.type === "any" ? "required" : choice.type;
}
