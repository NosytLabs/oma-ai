import { afterEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@/components/chat";
import {
	consumeSSE,
	createStreamWatchdog,
	createThinkRouter,
	handleChatResponseStatus,
	MAX_MESSAGE_LENGTH,
	StreamStallError,
	stripPendingAssistant,
} from "@/lib/chat-stream";

const msg = (id: string, content: string): Message => ({
	id,
	role: "assistant",
	content,
	timestamp: 0,
});

describe("stripPendingAssistant", () => {
	it("removes a trailing empty assistant placeholder", () => {
		expect(stripPendingAssistant([msg("a", "ok"), msg("b", "")])).toEqual([
			msg("a", "ok"),
		]);
	});

	it("leaves a non-empty tail untouched", () => {
		const list = [msg("a", "ok")];
		expect(stripPendingAssistant(list)).toBe(list);
	});

	it("leaves an empty list untouched", () => {
		expect(stripPendingAssistant([])).toEqual([]);
	});
});

describe("createThinkRouter", () => {
	const run = (tokens: string[]) => {
		const content: string[] = [];
		const reasoning: string[] = [];
		const router = createThinkRouter({
			onContent: (c) => content.push(c),
			onReasoning: (r) => reasoning.push(r),
		});
		for (const t of tokens) router.route(t);
		router.flushTail();
		return { content: content.join(""), reasoning: reasoning.join("") };
	};

	it("passes prose through untouched", () => {
		const { content, reasoning } = run(["hello", " ", "world"]);
		expect(content).toBe("hello world");
		expect(reasoning).toBe("");
	});

	it("routes <thinking>… response into reasoning and drops the tags", () => {
		const { content, reasoning } = run([
			"answer",
			"<thinking>let me",
			" compute</think",
			">",
			"done",
		]);
		expect(reasoning).toBe("let me compute");
		expect(content).toBe("answerdone");
	});

	it("routes <think>… response into reasoning and drops the tags", () => {
		const { content, reasoning } = run([
			"answer<thin",
			"k>private reasoning</thin",
			"k>done",
		]);
		expect(reasoning).toBe("private reasoning");
		expect(content).toBe("answerdone");
	});

	it("keeps an unclosed thinking block in reasoning until the end", () => {
		const { content, reasoning } = run(["<thinking>half", "tag"]);
		expect(reasoning).toBe("halftag");
		expect(content).toBe("");
	});

	it("handles multiple think blocks in one stream", () => {
		const { content, reasoning } = run([
			"a<thinking>one</th",
			"ink>b<thinking>two</think>c",
		]);
		expect(reasoning).toBe("onetwo");
		expect(content).toBe("abc");
	});
});

describe("consumeSSE", () => {
	const streamOf = (chunks: string[]) => {
		const encoder = new TextEncoder();
		const queue = chunks.map((c) => encoder.encode(c));
		return new ReadableStream<Uint8Array>({
			pull(controller) {
				if (queue.length === 0) {
					controller.close();
					return;
				}
				controller.enqueue(queue.shift()!);
			},
		});
	};

	it("splits blank-line-delimited events and normalizes CRLF", async () => {
		const blocks: string[][] = [];
		await consumeSSE(streamOf(["data: a\r\n\r\ndata: b\n\n"]).getReader(), (b) =>
			blocks.push(b.data),
		);
		expect(blocks).toEqual([["a"], ["b"]]);
	});

	it("joins a block split across chunks", async () => {
		const blocks: string[][] = [];
		await consumeSSE(streamOf(["data: a", "b\n\n"]).getReader(), (b) =>
			blocks.push(b.data),
		);
		expect(blocks).toEqual([["ab"]]);
	});

	it("handles a trailing block with no final blank line", async () => {
		const blocks: string[][] = [];
		await consumeSSE(streamOf(["data: a\n\n", "data: last"]).getReader(), (b) =>
			blocks.push(b.data),
		);
		expect(blocks).toEqual([["a"], ["last"]]);
	});

	it("reports activity for every chunk read", async () => {
		let activity = 0;
		await consumeSSE(streamOf(["data: a\n\n", "data: b\n\n"]).getReader(), () => {}, () => {
			activity++;
		});
		expect(activity).toBe(2);
	});
});

describe("createStreamWatchdog", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("aborts with phase first-data when no data ever arrives", () => {
		vi.useFakeTimers();
		const parent = new AbortController();
		const watchdog = createStreamWatchdog(parent.signal, { firstDataMs: 1_000, idleMs: 500 });
		expect(watchdog.signal.aborted).toBe(false);
		vi.advanceTimersByTime(999);
		expect(watchdog.signal.aborted).toBe(false);
		vi.advanceTimersByTime(1);
		expect(watchdog.signal.aborted).toBe(true);
		expect(watchdog.stalledPhase()).toBe("first-data");
		watchdog.dispose();
	});

	it("switches to the idle window once data arrives", () => {
		vi.useFakeTimers();
		const parent = new AbortController();
		const watchdog = createStreamWatchdog(parent.signal, { firstDataMs: 1_000, idleMs: 500 });
		vi.advanceTimersByTime(900);
		watchdog.activity();
		// Past the first-data deadline, but inside the idle window.
		vi.advanceTimersByTime(400);
		expect(watchdog.signal.aborted).toBe(false);
		vi.advanceTimersByTime(100);
		expect(watchdog.signal.aborted).toBe(true);
		expect(watchdog.stalledPhase()).toBe("idle");
		watchdog.dispose();
	});

	it("mirrors a parent abort without claiming a stall", () => {
		vi.useFakeTimers();
		const parent = new AbortController();
		const watchdog = createStreamWatchdog(parent.signal, { firstDataMs: 1_000, idleMs: 500 });
		parent.abort();
		expect(watchdog.signal.aborted).toBe(true);
		expect(watchdog.stalledPhase()).toBeNull();
		watchdog.dispose();
	});

	it("does not fire after dispose", () => {
		vi.useFakeTimers();
		const parent = new AbortController();
		const watchdog = createStreamWatchdog(parent.signal, { firstDataMs: 1_000, idleMs: 500 });
		watchdog.dispose();
		vi.advanceTimersByTime(5_000);
		expect(watchdog.signal.aborted).toBe(false);
		expect(watchdog.stalledPhase()).toBeNull();
	});

	it("StreamStallError carries phase, partial flag and an actionable message", () => {
		const first = new StreamStallError("first-data", false);
		expect(first.stallPhase).toBe("first-data");
		expect(first.partial).toBe(false);
		expect(first.message).toMatch(/did not respond in time/i);
		const idle = new StreamStallError("idle", true);
		expect(idle.partial).toBe(true);
		expect(idle.message).toMatch(/partial answer has been kept/i);
	});
});

describe("handleChatResponseStatus", () => {
	const resp = (status: number, body: unknown = {}, headers: Record<string, string> = {}) =>
		new Response(JSON.stringify(body), {
			status,
			headers: { "Content-Type": "application/json", ...headers },
		});

	it("returns normally for 2xx", async () => {
		await expect(
			handleChatResponseStatus(resp(200), { freeModel: true }),
		).resolves.toBeUndefined();
	});

	it("throws an auth error for 401", async () => {
		await expect(
			handleChatResponseStatus(resp(401), { freeModel: false }),
		).rejects.toThrow(/Authentication required/);
	});

	it("throws a free-tier message for 401 on a free model", async () => {
		await expect(
			handleChatResponseStatus(resp(401), { freeModel: true }),
		).rejects.toThrow(/Free model request was rejected/);
	});

	it("reports daily_limit_exceeded to the quota callback on 429", async () => {
		const quota: unknown[] = [];
		await expect(
			handleChatResponseStatus(
				resp(429, { error: { code: "daily_limit_exceeded", remaining: 0, limit: 10 } }),
				{ freeModel: true, onDailyQuota: (q) => quota.push(q) },
			),
		).rejects.toThrow();
		expect(quota).toEqual([{ remaining: 0, limit: 10, exhausted: true }]);
	});

	it("surfaces other 429 messages", async () => {
		await expect(
			handleChatResponseStatus(
				resp(429, { error: { message: "slow down" } }),
				{ freeModel: true },
			),
		).rejects.toThrow("slow down");
	});

	it("syncs quota from daily-limit headers on success", async () => {
		const quota: unknown[] = [];
		await handleChatResponseStatus(
			resp(200, {}, { "X-DailyLimit-Remaining": "3", "X-DailyLimit-Limit": "20" }),
			{ freeModel: true, onDailyQuota: (q) => quota.push(q) },
		);
		expect(quota).toEqual([{ remaining: 3, limit: 20 }]);
	});

	it("falls back to server error message for other statuses", async () => {
		await expect(
			handleChatResponseStatus(resp(500, { error: { message: "boom" } }), {
				freeModel: true,
			}),
		).rejects.toThrow("boom");
		await expect(
			handleChatResponseStatus(resp(503), { freeModel: true }),
		).rejects.toThrow(/503/);
	});

	it("exports MAX_MESSAGE_LENGTH for callers", () => {
		expect(MAX_MESSAGE_LENGTH).toBe(100 * 1024);
	});
});
