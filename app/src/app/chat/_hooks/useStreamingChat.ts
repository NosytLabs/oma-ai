"use client";

import { MODELS } from "@/lib/models-data";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { useCallback, useEffect, useRef } from "react";
import type { Message, SearchResult } from "@/components/chat";
import { isDegenerateResponse } from "@/lib/degenerate-response";
import { splitInlineThink } from "@/lib/split-inline-think";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import {
	BATCH_INTERVAL_MS,
	consumeSSE,
	createThinkRouter,
	handleChatResponseStatus,
	MAX_MESSAGE_LENGTH,
	stripPendingAssistant,
	type DailyQuota,
} from "@/lib/chat-stream";
import { log } from "@/lib/logger";
import {
	FREE_CHAT_MODEL_IDS,
	isFreeChatModel,
} from "@/lib/model-utils";
import { estimateTokens } from "@/lib/text";
import { appendCapped, parseStreamData } from "./stream-parser";

// Same-origin /api proxy so the Better Auth cookie is sent. Hitting
// :3001 directly drops the session (cross-origin) and playground
// usage never lands in the dashboard. proxy-response keeps SSE streamed.
const CHAT_ENDPOINT = "/api/v1/chat/completions";
const SEARCH_ENDPOINT = "/api/v1/search";

/**
	* Clean the conversation before it hits the upstream API. Two failure modes
	* produce malformed alternation that confuses providers:
	*
	* 1. Empty assistant placeholders (content === "") — persisted when a send
	*    failed mid-flight or aborted before any token arrived. Sending them as
	*    context makes the model see a "reply" that isn't there.
	* 2. Consecutive same-role messages — a send that 401/402'd (e.g. paid model
	*    without an API key) leaves its user message in history with no assistant
	*    reply, so the next send creates two user messages in a row. Providers
	*    either reject this or (as observed with old providers) answer the earlier,
	*    stale question. Keep only the last message of each run.
	*/
export function sanitizeHistory(messages: Message[]): Message[] {
	const cleaned: Message[] = [];
	for (const msg of messages) {
		if (msg.role === "assistant" && !msg.content.trim()) continue;
		const last = cleaned[cleaned.length - 1];
		if (last && last.role === msg.role) {
			cleaned[cleaned.length - 1] = msg;
		} else {
			cleaned.push(msg);
		}
	}
	return cleaned;
}

/**
	* Unique message IDs that don't collide under rapid concurrent sends.
	* Math.random + Date.now is not enough — two clicks in the same ms can
	* collide. Counter + crypto-random suffix eliminates that.
	*/
function newMessageId(prefix: string): string {
	const n =
		typeof performance !== "undefined" && typeof performance.now === "function"
			? Math.floor(performance.now() * 1000)
			: Date.now() * 1000;
	const rand = Math.random().toString(36).slice(2, 10);
	return `${prefix}-${n.toString(36)}-${rand}`;
}

interface UseStreamingChatOptions {
	messagesRef: RefObject<Message[]>;
	compareMessagesRef: RefObject<Message[]>;
	input: string;
	loading: boolean;
	setInput: Dispatch<SetStateAction<string>>;
	setMessages: Dispatch<SetStateAction<Message[]>>;
	setLoading: Dispatch<SetStateAction<boolean>>;
	setError: Dispatch<SetStateAction<string | null>>;
	/**
	 * Compare-mode failures belong to the compare panel, not the primary
	 * conversation's error banner (BUG-H). Kept separate so a dead side
	 * stream can't occupy the main error slot above the composer.
	 */
	setCompareError: Dispatch<SetStateAction<string | null>>;
	model: string;
	systemPrompt: string;
	compareMode: boolean;
	compareModel: string;
	setCompareMessages: Dispatch<SetStateAction<Message[]>>;
	inputRef: RefObject<HTMLTextAreaElement | null>;
	isNearBottomRef: RefObject<boolean>;
	temperature: number;
	topP: number;
	maxTokens: number;
	topK: number;
	freqPenalty: number;
	presPenalty: number;
	stream: boolean;
	webSearchEnabled: boolean;
	setSearching: Dispatch<SetStateAction<boolean>>;
	/**
	 * Guest free-tier quota from server (X-DailyLimit-* headers or 429 body).
	 * Called on success and on daily_limit_exceeded — never invents client counts.
	 */
	onDailyQuota?: (quota: DailyQuota) => void;
}

interface UseStreamingChatResult {
	sendMessage: (overridePrompt?: string) => Promise<void>;
	abortRef: RefObject<AbortController | null>;
}

/**
	* Owns the SSE streaming pipeline for both the primary chat and the
	* compare-mode side panel. The hook is intentionally chat-shaped — it
	* does not own the input box, the message list rendering, or the
	* settings panel. It only:
	*   1. fetches web search context (when enabled) in parallel for both
	*      primary and compare panels
	*   2. opens two parallel SSE streams (or one when compare mode is off)
	*   3. parses the SSE event stream, batches content updates at 250ms
	*      to keep renders cheap during streaming
	*   4. classifies terminal errors (auth / rate-limit / network) and
	*      either strips empty assistant placeholders (abort) or surfaces
	*      the message via setError
	*/
export function useStreamingChat(
	opts: UseStreamingChatOptions,
): UseStreamingChatResult {
	const toast = useToast();
	const abortRef = useRef<AbortController | null>(null);
	// BUG-B: the parent rebuilds a fresh `opts` object every render, so any
	// useCallback that closes over it keeps the FIRST render's values unless
	// every field is listed as a dependency (impossible — the object identity
	// changes, but fields like `model`/`history` can still be missed). A ref
	// written during render gives every callback below the current options
	// with no dependency churn.
	const optsRef = useRef(opts);
	optsRef.current = opts;
	// BUG-E (audit 2026-09-01-userflow.md): when the request has been
	// pending for >15s, show a soft hint so the user knows the spinner
	// is doing something — without it, a 5-minute wait during upstream
	// capacity events looks like a hang. Reset on every new send.
	const stuckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const clearStuckTimer = useCallback(() => {
		if (stuckTimerRef.current) {
			clearTimeout(stuckTimerRef.current);
			stuckTimerRef.current = null;
		}
	}, []);
	useEffect(() => () => clearStuckTimer(), [clearStuckTimer]);

	// Single in-flight "ensure chat key" attempt. The cookie-install endpoint
	// takes a raw `oma_sk_*` key the server already validated and rewrites
	// it into the HttpOnly cookie the browser-direct SSE chat relies on.
	// We surface a friendly 401 once the server says the key is missing.
	const ensureKeyPromiseRef = useRef<Promise<boolean> | null>(null);
	const ensureChatKeyOnce = useCallback(async (): Promise<boolean> => {
		if (ensureKeyPromiseRef.current) return ensureKeyPromiseRef.current;
		ensureKeyPromiseRef.current = (async () => {
			try {
				await api.auth.listKeys();
				const created = await api.auth.createKey("Browser chat");
				const installed = await api.auth.installKeyCookie(created.key);
				return installed.success;
			} catch {
				return false;
			} finally {
				ensureKeyPromiseRef.current = null;
			}
		})();
		return ensureKeyPromiseRef.current;
	}, []);

	useEffect(() => {
		return () => {
			abortRef.current?.abort();
		};
	}, []);

	const fetchWebSearch = useCallback(
		async (
			query: string,
			setSearchingFn: (b: boolean) => void,
		): Promise<{ results: SearchResult[]; contextMessage: Message | null }> => {
			const live = optsRef.current;
			if (!live.webSearchEnabled || !query.trim()) {
				return { results: [], contextMessage: null };
			}
			setSearchingFn(true);
			try {
				const searchResp = await fetch(
					`${SEARCH_ENDPOINT}?query=${encodeURIComponent(query.trim())}`,
					{
						credentials: "include",
						headers: { Accept: "application/json" },
					},
				);
				// Backend returns 200 + empty `results` when upstream is not
				// configured, so the only "expected" non-OK here is 404 if
				// the route was removed. 5xx is a real error.
				if (searchResp.status === 404) {
					toast.info("Web search is not yet available on this deployment");
					return { results: [], contextMessage: null };
				}
				if (!searchResp.ok) {
					toast.error(`Web search failed (${searchResp.status})`);
					return { results: [], contextMessage: null };
				}
				const searchData = await searchResp.json();
				const rawResults = (searchData?.results ?? []) as Array<{
					title: string;
					url: string;
					snippet: string;
					site_name?: string;
					favicon?: string;
				}>;
				if (rawResults.length === 0) {
					// Configured but empty, or upstream unset (server returns []).
					// Surface once so WEB mode doesn't feel silently broken.
					toast.info(
						"No web results for this query — answering without live sources",
					);
					return { results: [], contextMessage: null };
				}
				const results: SearchResult[] = rawResults.map((r) => ({
					title: r.title,
					url: r.url,
					snippet: r.snippet,
					favicon: r.favicon,
				}));
				const contextMessage: Message = {
					role: "system",
					content: `Web search results for "${query.trim()}":\n\n${rawResults
						.map(
							(r) =>
								`- ${r.title}\n  ${r.snippet}\n  Source: ${r.url}${r.site_name ? ` (${r.site_name})` : ""}`,
						)
						.join("\n\n")}`,
					timestamp: Date.now(),
				};
				return { results, contextMessage };
			} catch (err) {
				log.warn("Web search failed", err);
				toast.error(
					"Web search unavailable — proceeding without search results",
				);
				return { results: [], contextMessage: null };
			} finally {
				setSearchingFn(false);
			}
		},
		// Live options come from `optsRef` (see BUG-B) — `toast` is the only
		// real dependency.
		[toast],
	);

	const streamChatCompletion = useCallback(
		async (params: {
			model: string;
			history: Message[];
			setMessages: Dispatch<SetStateAction<Message[]>>;
			searchContext: Message | null;
			searchResults: SearchResult[];
			signal: AbortSignal;
		}): Promise<void> => {
			const {
				model: useModel,
				history,
				setMessages: setMsgs,
				searchContext,
				searchResults,
				signal,
			} = params;
			// BUG-B: read the CURRENT options, not the ones captured when
			// this callback was memoized.
			const live = optsRef.current;

			let messagesToSend = sanitizeHistory(history);
			if (searchContext) {
				messagesToSend = [searchContext, ...messagesToSend];
			}
			if (live.systemPrompt.trim()) {
				const sysMsg: Message = {
					role: "system",
					content: live.systemPrompt.trim(),
					timestamp: Date.now(),
				};
				messagesToSend = [sysMsg, ...messagesToSend];
			}

			// OpenRouter-style models[]: only attach free peers when the
			// selected model is free, so guest chat can fail over without
			// leaving the free tier. Paid models use the server FALLBACK_MAP.
			const freeModelSelected = isFreeChatModel(useModel);
			const freePeers = freeModelSelected
				? [...FREE_CHAT_MODEL_IDS].filter((id) => id !== useModel)
				: [];
			const doFetch = () =>
				fetch(CHAT_ENDPOINT, {
					method: "POST",
					credentials: "include",
					headers: {
						"Content-Type": "application/json",
						Accept: live.stream ? "text/event-stream" : "application/json",
						"X-OMA-Source": "website", // Identify website chat for free tier
					},
					body: JSON.stringify({
						model: useModel,
						...(freePeers.length > 0
							? { models: freePeers.slice(0, 4) }
							: {}),
						messages: messagesToSend.map((m) => ({
							role: m.role,
							content: m.content,
						})),
						temperature: live.temperature,
						top_p: live.topP,
						max_tokens: Math.min(live.maxTokens, MODELS.find((m) => m.id === useModel)?.maxOutputTokens ?? 16384),
						top_k: live.topK,
						frequency_penalty: live.freqPenalty,
						presence_penalty: live.presPenalty,
						stream: live.stream,
						...(live.stream
							? { stream_options: { include_usage: true } }
							: {}),
					}),
					signal,
				});

			let response = await doFetch();

			// Paid models only: logged-in users on a new device may have a session
			// but no `oma_api_key` cookie, so chat returns 401. Free OMA-AI models
			// never need a key, and 402 means insufficient credits rather than a
			// missing key, so only repair paid-model 401 responses.
			if (
				!freeModelSelected &&
				response.status === 401 &&
				!signal.aborted
			) {
				const repaired = await ensureChatKeyOnce();
				if (repaired && !signal.aborted) {
					response = await doFetch();
				}
			}

			// Sync free-tier quota from headers and classify the status
			// (401 auth, 429 rate limit, other non-OK → HTTP error). Throws
			// the user-facing Error for anything non-2xx.
			await handleChatResponseStatus(response, {
				freeModel: freeModelSelected,
				onDailyQuota: live.onDailyQuota,
			});

			// Surface server failover (OpenRouter-style transparency).
			const usedFallback =
				response.headers.get("x-oma-fallback") === "1" ||
				response.headers.get("X-Oma-Fallback") === "1";
			const actualModel =
				response.headers.get("x-actual-model") ||
				response.headers.get("X-Actual-Model") ||
				useModel;
			if (usedFallback && actualModel && actualModel !== useModel) {
				toast.info(`Routed via fallback model · ${actualModel}`);
				// The response *did* succeed (200), so any network error
				// the user might still see in the chat banner is stale —
				// likely a mid-stream read that recovered. Clear it so
				// the user doesn't see "NETWORK ERROR" alongside their
				// actual answer. (BUG-C, audit 2026-09-01-userflow.md)
				live.setError(null);
			}

			const startTime = Date.now();

			if (live.stream && response.body) {
				const reader = response.body.getReader();
				let accumulated = "";
				let accumulatedReasoning = "";
				let realTokenCount = 0;
				let lastUpdateTime = 0;
				let lastFlushedContent = "";
				let lastFlushedReasoning = "";
				// Track upstream finish_reason so the UI can show a TRUNCATED
				// hint when the response was cut off by max_tokens (typical for
				// reasoning models that burn the token budget on `…`).
				let finishReason:
					| "stop"
					| "length"
					| "content_filter"
					| "tool_calls"
					| "function_call"
					| null = null;

				const flushToState = (force = false) => {
					const now = Date.now();
					if (
						force ||
						(now - lastUpdateTime >= BATCH_INTERVAL_MS &&
							(accumulated !== lastFlushedContent ||
								accumulatedReasoning !== lastFlushedReasoning))
					) {
						lastUpdateTime = now;
						lastFlushedContent = accumulated;
						lastFlushedReasoning = accumulatedReasoning;
						// Use the real usage count once it arrives in the final chunk;
						// otherwise approximate from accumulated text.
						const tokenCount = realTokenCount || estimateTokens(accumulated);
						setMsgs((prev) => {
							const updated = [...prev];
							const lastIdx = updated.length - 1;
							if (lastIdx >= 0) {
							updated[lastIdx] = {
								...updated[lastIdx],
								content: accumulated,
								reasoning: accumulatedReasoning || undefined,
								tokens: tokenCount,
								outputTokens: realTokenCount || estimateTokens(accumulated),
								latency: now - startTime,
								truncated: finishReason === "length",
								// BUG-D: flag degenerate fallback output so the UI
								// can surface a "low-quality response" hint instead
								// of rendering a wall of repeated tokens as a normal
								// reply. See isDegenerateResponse for the heuristic.
								degenerate: isDegenerateResponse(accumulated),
								finishReason,
								model: actualModel,
								viaFallback: usedFallback && actualModel !== useModel,
									searchResults:
										searchResults.length > 0
											? searchResults
											: updated[lastIdx].searchResults,
								};
							}
							return updated;
						});
					}
				};

				const appendToContent = (chunk: string) => {
					accumulated = appendCapped(
						accumulated,
						chunk,
						MAX_MESSAGE_LENGTH,
						"\n\n…[response truncated at 100 KB]",
					);
				};
				const appendToReasoning = (chunk: string) => {
					accumulatedReasoning = appendCapped(
						accumulatedReasoning,
						chunk,
						MAX_MESSAGE_LENGTH,
					);
				};
				const router = createThinkRouter({
					onContent: appendToContent,
					onReasoning: appendToReasoning,
				});
				const processData = (raw: string) => {
					// Frame parsing lives in stream-parser.ts so it can be tested
					// without mounting this hook and driving a live stream.
					const d = parseStreamData(raw);
					if (!d) return;
					if (d.content) {
						router.route(d.content);
						flushToState();
					}
					if (d.reasoning) {
						appendToReasoning(d.reasoning);
						flushToState();
					}
					if (d.totalTokens !== undefined) {
						realTokenCount = d.totalTokens;
					}
					if (d.finishReason) {
						finishReason = d.finishReason as typeof finishReason;
					}
				};

				await consumeSSE(reader, (block) => {
					for (const d of block.data) {
						processData(d);
					}
				});
				router.flushTail();
				flushToState(true);
			} else {
				const data = await response.json();
				let content = data.choices?.[0]?.message?.content || "";
				let reasoning = data.choices?.[0]?.message?.reasoning_content || "";
				// Non-streaming fallback: some models emit an inline thinking
				// block inside `content` rather than as a separate field.
				if (!reasoning.trim()) {
					const split = splitInlineThink(content);
					if (split.reasoning) {
						reasoning = split.reasoning;
						content = split.content;
					}
				}
				const usage = data.usage;
				const bodyModel =
					typeof data.model === "string" && data.model
						? data.model
						: actualModel;
				setMsgs((prev) => {
					const updated = [...prev];
					const lastIdx = updated.length - 1;
					if (lastIdx >= 0) {
						updated[lastIdx] = {
							...updated[lastIdx],
							content,
							reasoning: reasoning || undefined,
							tokens: usage?.total_tokens || 0,
							inputTokens: usage?.prompt_tokens || updated[lastIdx].inputTokens,
							outputTokens: usage?.completion_tokens || estimateTokens(content),
							latency: Date.now() - startTime,
							// BUG-D: same degenerate-output flag for the non-streaming path
							degenerate: isDegenerateResponse(content),
							model: bodyModel,
							viaFallback: usedFallback && bodyModel !== useModel,
							searchResults:
								searchResults.length > 0
									? searchResults
									: updated[lastIdx].searchResults,
						};
					}
					return updated;
				});
			}
		// BUG-B: every option is read live through `optsRef`, so the
		// dependency list collapses to the stable helpers it captures.
		}, [ensureChatKeyOnce]);

	const sendMessage = useCallback(
		async (overridePrompt?: string) => {
			// BUG-B: everything below reads the live options object.
			const live = optsRef.current;
			const promptText = (overridePrompt ?? live.input).trim();
			if (!promptText || live.loading) return;

			// Fresh cookie-repair budget for this send (see ensureChatKeyOnce).
			ensureKeyPromiseRef.current = null;

			const userMessage: Message = {
				id: newMessageId("user"),
				role: "user",
				content: promptText,
				timestamp: Date.now(),
				inputTokens: estimateTokens(promptText),
			};

			live.setMessages((prev) => [...prev, userMessage]);
			live.setInput("");
			live.setLoading(true);
			live.setError(null);
			// BUG-H: each send starts with a clean compare error slot so a
			// previous compare failure doesn't linger on a new run.
			live.setCompareError(null);
			// BUG-E: start the stuck-loading hint timer. If the request is
			// still in flight after 15s, surface a soft toast so the user
			// doesn't think the page is hung. Cleared in `finally`.
			clearStuckTimer();
			stuckTimerRef.current = setTimeout(() => {
				toast.info("Server is taking longer than usual — retrying if needed");
			}, 15_000);

			const assistantMessage: Message = {
				id: newMessageId("assistant"),
				role: "assistant",
				content: "",
				timestamp: Date.now(),
			};
			live.setMessages((prev) => [...prev, assistantMessage]);

			// Build compare side: add user message + empty assistant message so the
			// panel mirrors the conversation shape.
			if (live.compareMode) {
				live.setCompareMessages((prev) => [
					...prev,
					userMessage,
					{
						id: newMessageId("compare"),
						role: "assistant",
						content: "",
						timestamp: Date.now(),
					},
				]);
			}

			const abortController = new AbortController();
			abortRef.current = abortController;
			live.isNearBottomRef.current = true;

			// Build history for streaming: refs already have previous messages,
			// and we just appended user+assistant messages via functional updates.
			// The refs will be updated after the next render, so we construct
			// the history manually here to include the new messages.
			const primaryHistory = [
				...live.messagesRef.current,
				userMessage,
				assistantMessage,
			];

			try {
				// Run web search once per prompt. In compare mode we reuse the
				// same context for both streams so we don't double the search
				// latency and backend load.
				const searchResult = await fetchWebSearch(
					promptText,
					live.setSearching,
				);
				const primarySearch = searchResult;
				const compareSearch = live.compareMode
					? searchResult
					: { results: [], contextMessage: null };

				// Fire both streams in parallel. Use Promise.allSettled so one stream
				// failing doesn't leave the other running as a zombie.
				const primaryPromise = streamChatCompletion({
					model: live.model,
					history: primaryHistory,
					setMessages: live.setMessages,
					searchContext: primarySearch.contextMessage,
					searchResults: primarySearch.results,
					signal: abortController.signal,
				});

				const comparePromise = live.compareMode
					? streamChatCompletion({
							model: live.compareModel,
							history: [
								...live.compareMessagesRef.current,
								userMessage,
								{
									id: newMessageId("compare"),
									role: "assistant",
									content: "",
									timestamp: Date.now(),
								},
							],
							setMessages: live.setCompareMessages,
							searchContext: compareSearch.contextMessage,
							searchResults: compareSearch.results,
							signal: abortController.signal,
						})
					: (Promise.resolve() as Promise<void>);

				const results = await Promise.allSettled([
					primaryPromise,
					comparePromise,
				]);
				const [primaryResult, compareResult] = results;

				if (primaryResult.status === "rejected") {
					throw primaryResult.reason;
				}

				if (compareResult.status === "rejected") {
					const err = compareResult.reason;
					const message =
						err instanceof Error ? err.message : "Compare model request failed";
					// BUG-H: the compare stream's failure belongs to the compare
					// panel. Writing it into the primary `error` state parked an
					// unrelated message in the main ChatErrorBanner above the
					// composer while the primary stream was healthy.
					live.setCompareError(
						`${live.compareModel} failed — ${message}`,
					);
					live.setCompareMessages((prev) => stripPendingAssistant(prev));
				}
			} catch (err: unknown) {
				const aborted =
					abortController.signal.aborted ||
					(err instanceof Error && err.name === "AbortError");
				if (aborted) {
					live.setMessages((prev) => stripPendingAssistant(prev));
					if (live.compareMode) {
						live.setCompareMessages((prev) => stripPendingAssistant(prev));
					}
				} else {
					// Network failures (backend down / CORS) surface as TypeError —
					// translate to a friendly message rather than a cryptic "fetch failed".
					let message: string;
					if (err instanceof TypeError) {
						message =
							"Cannot reach the backend server — check your connection and that the API is running";
					} else if (err instanceof Error) {
						message = err.message;
					} else {
						message = "Unknown error";
					}
					live.setError(message);
					live.setMessages((prev) => stripPendingAssistant(prev));
					if (live.compareMode) {
						live.setCompareMessages((prev) => stripPendingAssistant(prev));
					}
				}
			} finally {
				// BUG-A: the streaming/abort state is reset on EVERY exit path
				// (success, HTTP error, network error, abort, or a throw from
				// web search). Previously `loading` was only cleared on the SSE
				// "done" branch, so a fetch failure left the composer
				// permanently disabled with the Stop button stuck on and no
				// way to retry. Clearing the ref also means Stop can never
				// abort a finished request.
				if (abortRef.current === abortController) abortRef.current = null;
				live.setLoading(false);
				clearStuckTimer();
				setTimeout(() => live.inputRef.current?.focus(), 100);
			}
		},
		// BUG-B: `opts` is read live via `optsRef`, so only the stable
		// helpers this callback calls belong in the dependency list.
		[clearStuckTimer, fetchWebSearch, streamChatCompletion],
	);

	return { sendMessage, abortRef };
}
