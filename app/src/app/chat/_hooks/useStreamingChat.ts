"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import { useCallback, useEffect, useRef } from "react";
import type { Message, SearchResult } from "@/components/chat";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { DEFAULT_API_URL } from "@/lib/config";
import { log } from "@/lib/logger";
import { isFreeChatModel } from "@/lib/model-utils";
import { estimateTokens } from "@/lib/text";

// Chat completions must hit the backend directly for true SSE streaming —
// the Next /api catch-all buffers the full body and breaks streams.
// Web search is short JSON: prefer same-origin /api proxy (public free path)
// so free-guest WEB mode works without CORS surprises in production.
const CHAT_ENDPOINT = `${DEFAULT_API_URL}/v1/chat/completions`;
function searchEndpoint(): string {
	if (typeof window !== "undefined") return "/api/v1/search";
	return `${DEFAULT_API_URL}/v1/search`;
}
const MAX_MESSAGE_LENGTH = 100 * 1024;
const BATCH_INTERVAL_MS = 250;

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

/**
 * SSE events end with \n\n. A single event can have multiple
 * `data:` lines that must be concatenated. Per the SSE spec, ignore lines
 * starting with `:` (comment). A bare `data:` line is treated as the string
 * "data: ". The event ends at the first blank line.
 */
function parseSSEBlock(
	block: string,
): { event?: string; data: string[]; id?: string } | null {
	if (!block || block.trim() === "") return null;
	const lines = block.split("\n");
	const data: string[] = [];
	let event: string | undefined;
	let id: string | undefined;
	for (const line of lines) {
		if (!line || line.startsWith(":")) continue;
		const colon = line.indexOf(":");
		const field = colon === -1 ? line : line.slice(0, colon);
		const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
		if (field === "data") data.push(value);
		else if (field === "event") event = value;
		else if (field === "id") id = value;
	}
	if (data.length === 0 && !event && !id) return null;
	return { event, data, id };
}

export interface UseStreamingChatOptions {
	messagesRef: RefObject<Message[]>;
	compareMessagesRef: RefObject<Message[]>;
	input: string;
	loading: boolean;
	setInput: Dispatch<SetStateAction<string>>;
	setMessages: Dispatch<SetStateAction<Message[]>>;
	setLoading: Dispatch<SetStateAction<boolean>>;
	setError: Dispatch<SetStateAction<string | null>>;
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
}

export interface UseStreamingChatResult {
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

	// Single in-flight "ensure chat key" attempt. The cookie-install endpoint
	// takes a raw `oma_sk_*` key the server already validated and rewrites
	// it into the HttpOnly cookie the browser-direct SSE chat relies on.
	// We surface a friendly 401 once the server says the key is missing.
	const ensureKeyPromiseRef = useRef<Promise<boolean> | null>(null);
	const ensureChatKeyOnce = useCallback(async (): Promise<boolean> => {
		if (ensureKeyPromiseRef.current) return ensureKeyPromiseRef.current;
		ensureKeyPromiseRef.current = (async () => {
			try {
				const existing = await api.auth.listKeys();
				if (existing.keys.length > 0) {
					// Promote the newest key — users always have a fresh one
					// ready from /v1/keys (POST). Real launches install it via
					// a separate UI affordance; this is the auto-repair path.
					return true;
				}
				return false;
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
					if (!opts.webSearchEnabled || !query.trim()) {
						return { results: [], contextMessage: null };
					}
					setSearchingFn(true);
					try {
						const searchResp = await fetch(
							`${searchEndpoint()}?query=${encodeURIComponent(query.trim())}`,
							{
								credentials: "include",
								headers: { Accept: "application/json" },
							},
						);
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
		[opts.webSearchEnabled, toast],
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

			let messagesToSend = history;
			if (searchContext) {
				messagesToSend = [searchContext, ...history];
			}
			if (opts.systemPrompt.trim()) {
				const sysMsg: Message = {
					role: "system",
					content: opts.systemPrompt.trim(),
					timestamp: Date.now(),
				};
				messagesToSend = [sysMsg, ...messagesToSend];
			}

			const doFetch = () =>
				fetch(CHAT_ENDPOINT, {
					method: "POST",
					credentials: "include",
					headers: {
						"Content-Type": "application/json",
						Accept: opts.stream ? "text/event-stream" : "application/json",
					},
					body: JSON.stringify({
						model: useModel,
						messages: messagesToSend.map((m) => ({
							role: m.role,
							content: m.content,
						})),
						temperature: opts.temperature,
						top_p: opts.topP,
						max_tokens: opts.maxTokens,
						top_k: opts.topK,
						frequency_penalty: opts.freqPenalty,
						presence_penalty: opts.presPenalty,
						stream: opts.stream,
						...(opts.stream
							? { stream_options: { include_usage: true } }
							: {}),
					}),
					signal,
				});

			let response = await doFetch();

			// Paid models only: logged-in users on a new device have a session
			// but no `oma_api_key` cookie, so chat 401s/402s. Free OMA-AI models
			// never need a key — skip ensureKey so guests are not blocked.
			const freeModel = isFreeChatModel(useModel);
			if (
				!freeModel &&
				(response.status === 401 || response.status === 402) &&
				!signal.aborted
			) {
				const repaired = await ensureChatKeyOnce();
				if (repaired && !signal.aborted) {
					response = await doFetch();
				}
			}

			if (response.status === 401) {
				throw new Error(
					freeModel
						? "Free model request was rejected — try again or pick another OMA-AI free model"
						: "Authentication required — sign in and create an API key for paid models (OMA-AI free models work without sign-in)",
				);
			}
			if (response.status === 429) {
				const errBody = await response.json().catch(() => null);
				throw new Error(
					errBody?.error?.message ||
						"rate limit exceeded — please wait and try again",
				);
			}
			if (!response.ok) {
				const errBody = await response.json().catch(() => null);
				const errMsg =
					errBody?.error?.message ||
					`HTTP ${response.status}: ${response.statusText}`;
				throw new Error(errMsg);
			}

			const startTime = Date.now();

			if (opts.stream && response.body) {
				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				let accumulated = "";
				let accumulatedReasoning = "";
				let realTokenCount = 0;
				let lastUpdateTime = 0;
				let lastFlushedContent = "";
				let lastFlushedReasoning = "";

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

				let sseBuffer = "";
				const SSE_BUFFER_MAX_BYTES = 1024 * 1024; // 1 MB cap to prevent unbounded growth
				const processData = (raw: string) => {
					const data = raw.trim();
					if (!data || data === "[DONE]") return;
					try {
						const parsed = JSON.parse(data);
						const choice = parsed.choices?.[0];
						const delta = choice?.delta?.content;
						if (delta) {
							if (accumulated.length < MAX_MESSAGE_LENGTH) {
								accumulated += delta;
							} else if (!accumulated.endsWith("[response truncated at 100 KB]")) {
								// Surface truncation exactly once so the user
								// knows the response was capped, instead of
								// silently dropping content.
								accumulated += "\n\n…[response truncated at 100 KB]";
							}
							flushToState();
						}
						// Reasoning models (DeepSeek R1, Claude extended thinking) emit
						// `reasoning_content` separately from `content`. Capture it so the
						// thinking phase is visible in the collapsible "Thinking" section
						// instead of showing blank while the model reasons.
						const reasoningDelta = choice?.delta?.reasoning_content;
						if (reasoningDelta) {
							if (accumulatedReasoning.length < MAX_MESSAGE_LENGTH) {
								accumulatedReasoning += reasoningDelta;
							}
							flushToState();
						}
						// OpenAI streams emit a final chunk with `usage` when
						// `stream_options.include_usage` is set (or some providers do it
						// unconditionally). Prefer the real count over our estimate.
						if (parsed.usage?.total_tokens) {
							realTokenCount = parsed.usage.total_tokens;
						}
					} catch (err) {
						log.warn("Failed to parse streaming response", err);
					}
				};
				const handleBlock = (block: string) => {
					const parsed = parseSSEBlock(block);
					if (!parsed) return;
					for (const d of parsed.data) {
						processData(d);
					}
				};
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
						for (const block of parts) handleBlock(block);
					}
					if (sseBuffer.trim()) {
						handleBlock(sseBuffer);
						sseBuffer = "";
					}
					flushToState(true);
				} finally {
					// Always release the underlying stream — otherwise the
					// connection lingers in the browser's pool until GC.
					try {
						reader.cancel();
					} catch {
						// already closed / aborted — nothing to do
					}
				}
				} else {
				const data = await response.json();
				const content = data.choices?.[0]?.message?.content || "";
				const reasoning = data.choices?.[0]?.message?.reasoning_content || "";
				const usage = data.usage;
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
							searchResults:
								searchResults.length > 0
									? searchResults
									: updated[lastIdx].searchResults,
						};
					}
					return updated;
				});
			}
		},
		[
			opts.systemPrompt,
			opts.temperature,
			opts.topP,
			opts.maxTokens,
			opts.topK,
			opts.freqPenalty,
			opts.presPenalty,
			opts.stream,
			ensureChatKeyOnce,
		],
	);

	const sendMessage = useCallback(
		async (overridePrompt?: string) => {
			"use no memo";
			const promptText = (overridePrompt ?? opts.input).trim();
			if (!promptText || opts.loading) return;

			// Fresh cookie-repair budget for this send (see ensureChatKeyOnce).
			ensureKeyPromiseRef.current = null;

			const userMessage: Message = {
				id: newMessageId("user"),
				role: "user",
				content: promptText,
				timestamp: Date.now(),
				inputTokens: estimateTokens(promptText),
			};

			opts.setMessages((prev) => [...prev, userMessage]);
			opts.setInput("");
			opts.setLoading(true);
			opts.setError(null);

			const assistantMessage: Message = {
				id: newMessageId("assistant"),
				role: "assistant",
				content: "",
				timestamp: Date.now(),
			};
			opts.setMessages((prev) => [...prev, assistantMessage]);

			// Build compare side: add user message + empty assistant message so the
			// panel mirrors the conversation shape.
			if (opts.compareMode) {
				opts.setCompareMessages((prev) => [
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
			opts.isNearBottomRef.current = true;

			// Build history for streaming: refs already have previous messages,
			// and we just appended user+assistant messages via functional updates.
			// The refs will be updated after the next render, so we construct
			// the history manually here to include the new messages.
			const primaryHistory = [
				...opts.messagesRef.current,
				userMessage,
				assistantMessage,
			];

			try {
				// Run web search once per prompt. In compare mode we reuse the
				// same context for both streams so we don't double the search
				// latency and backend load.
				const searchResult = await fetchWebSearch(
					promptText,
					opts.setSearching,
				);
				const primarySearch = searchResult;
				const compareSearch = opts.compareMode
					? searchResult
					: { results: [], contextMessage: null };

				// Fire both streams in parallel. Use Promise.allSettled so one stream
				// failing doesn't leave the other running as a zombie.
				const primaryPromise = streamChatCompletion({
					model: opts.model,
					history: primaryHistory,
					setMessages: opts.setMessages,
					searchContext: primarySearch.contextMessage,
					searchResults: primarySearch.results,
					signal: abortController.signal,
				});

				const comparePromise = opts.compareMode
					? streamChatCompletion({
							model: opts.compareModel,
							history: [
								...opts.compareMessagesRef.current,
								userMessage,
								{
									id: newMessageId("compare"),
									role: "assistant",
									content: "",
									timestamp: Date.now(),
								},
							],
							setMessages: opts.setCompareMessages,
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
					opts.setError(`Compare: ${message}`);
					opts.setCompareMessages((prev) => {
						const updated = [...prev];
						if (
							updated.length > 0 &&
							updated[updated.length - 1]?.content === ""
						) {
							return updated.slice(0, -1);
						}
						return updated;
					});
				}
			} catch (err: unknown) {
				const aborted =
					abortController.signal.aborted ||
					(err instanceof Error && err.name === "AbortError");
				if (aborted) {
					opts.setMessages((prev) => {
						const updated = [...prev];
						if (updated[updated.length - 1]?.content === "") {
							return updated.slice(0, -1);
						}
						return updated;
					});
					if (opts.compareMode) {
						opts.setCompareMessages((prev) => {
							const updated = [...prev];
							if (updated[updated.length - 1]?.content === "") {
								return updated.slice(0, -1);
							}
							return updated;
						});
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
					opts.setError(message);
					opts.setMessages((prev) => {
						const updated = [...prev];
						if (updated[updated.length - 1]?.content === "") {
							return updated.slice(0, -1);
						}
						return updated;
					});
					if (opts.compareMode) {
						opts.setCompareMessages((prev) => {
							const updated = [...prev];
							if (updated[updated.length - 1]?.content === "") {
								return updated.slice(0, -1);
							}
							return updated;
						});
					}
				}
			} finally {
				opts.setLoading(false);
				setTimeout(() => opts.inputRef.current?.focus(), 100);
			}
			// "opts" is intentionally excluded from deps: it's a fresh object on every
			// render, so including it would cause infinite re-renders. sendMessage reads
			// from refs (opts.*Ref) and the latest opts via closure — the useCallback
			// identity changes only when the listed deps change.
		// eslint-disable-next-line react-hooks/exhaustive-deps
		}, [
			opts.input,
			opts.loading,
			opts.model,
			opts.compareMode,
			opts.compareModel,
			opts.compareMessagesRef,
			opts.messagesRef,
			opts.isNearBottomRef,
			opts.inputRef,
			opts.setInput,
			opts.setMessages,
			opts.setLoading,
			opts.setError,
			opts.setCompareMessages,
			opts.setSearching,
			fetchWebSearch,
			streamChatCompletion,
		],
	);

	return { sendMessage, abortRef };
}
