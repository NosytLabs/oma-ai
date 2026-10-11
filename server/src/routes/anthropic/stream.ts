import { createStreamingProxy, type StreamingProxyArgs } from "../../inference/streaming.js";

export function anthropicStopReason(reason?: string) {
	return ({ stop: "end_turn", length: "max_tokens", tool_calls: "tool_use", content_filter: "end_turn" } as Record<string, string>)[reason ?? "stop"] ?? "end_turn";
}

/** Translate SSE after the shared gateway has handled framing, metering and cancellation. */
export function createAnthropicStream(upstream: Response, model: string, id: string, billing: StreamingProxyArgs): ReadableStream<Uint8Array> {
	const reader = createStreamingProxy(upstream, billing).getReader();
	const decoder = new TextDecoder(); const encoder = new TextEncoder();
	let carry = ""; let started = false; let nextIndex = 0; let textIndex: number | undefined;
	let finishReason = "stop"; let outputTokens = 0;
	const openBlocks = new Set<number>();
	const tools = new Map<number, { index: number; id: string; name: string }>();
	let emitted = 0;
	let terminated = false;
	function emit(controller: ReadableStreamDefaultController<Uint8Array>, type: string, fields: Record<string, unknown> = {}) {
		controller.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify({ type, ...fields })}\n\n`));
		emitted++;
	}
	function consume(controller: ReadableStreamDefaultController<Uint8Array>, line: string) {
		if (!line.startsWith("data:")) return;
		const payload = line.slice(5).trim(); if (!payload || payload === "[DONE]") return;
		const chunk = JSON.parse(payload);
		if (chunk.error) throw new Error("Upstream stream failed");
		if (Number.isSafeInteger(chunk.usage?.completion_tokens) && chunk.usage.completion_tokens >= 0) outputTokens = chunk.usage.completion_tokens;
		if (!started) {
			emit(controller, "message_start", { message: { id, type: "message", role: "assistant", model, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: chunk.usage?.prompt_tokens ?? billing.promptTokens, output_tokens: 0 } } });
			started = true;
		}
		const choice = chunk.choices?.[0]; const delta = choice?.delta;
		const text = delta?.content || delta?.reasoning_content || delta?.reasoning;
		if (typeof text === "string" && text) {
			if (textIndex === undefined) { textIndex = nextIndex++; openBlocks.add(textIndex); emit(controller, "content_block_start", { index: textIndex, content_block: { type: "text", text: "" } }); }
			emit(controller, "content_block_delta", { index: textIndex, delta: { type: "text_delta", text } });
		}
		for (const call of delta?.tool_calls ?? []) {
			const upstreamIndex = call.index ?? 0;
			let tool = tools.get(upstreamIndex);
			if (!tool) {
				if (!call.id || !call.function?.name) throw new Error("Invalid upstream tool stream");
				tool = { index: nextIndex++, id: call.id, name: call.function.name }; tools.set(upstreamIndex, tool); openBlocks.add(tool.index);
				emit(controller, "content_block_start", { index: tool.index, content_block: { type: "tool_use", id: tool.id, name: tool.name, input: {} } });
			}
			if (call.function?.arguments) emit(controller, "content_block_delta", { index: tool.index, delta: { type: "input_json_delta", partial_json: call.function.arguments } });
		}
		if (choice?.finish_reason) finishReason = choice.finish_reason;
	}
	return new ReadableStream({
		async pull(controller) {
			if (terminated) return;
			try {
				const before = emitted;
				while (true) {
				const { done, value } = await reader.read();
				if (terminated) return;
				carry += done ? decoder.decode() : decoder.decode(value, { stream: true });
				const lines = carry.split("\n"); carry = lines.pop() ?? "";
				for (const line of lines) consume(controller, line);
				if (done) {
					if (carry) consume(controller, carry);
					for (const index of openBlocks) emit(controller, "content_block_stop", { index });
					if (started) { emit(controller, "message_delta", { delta: { stop_reason: anthropicStopReason(finishReason), stop_sequence: null }, usage: { output_tokens: outputTokens } }); emit(controller, "message_stop"); }
					terminated = true;
					controller.close();
					return;
				}
				if (emitted > before) return;
				}
			} catch {
				if (terminated) return;
				terminated = true;
				emit(controller, "error", { error: { type: "api_error", message: "Inference stream could not be completed" } });
				await reader.cancel().catch(() => {}); controller.close();
			}
		},
		cancel(reason) { terminated = true; return reader.cancel(reason); },
	});
}
