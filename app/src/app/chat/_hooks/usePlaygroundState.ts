"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useState } from "react";
import type { Message } from "@/components/chat";

/**
 * Status enum for the export-conversation button. Cycles through loading
 * → success/error → default so the toolbar can render the right icon
 * without spawning extra toast spam.
 */
export type ExportStatus = "default" | "loading" | "success" | "error";

/**
 * Status enum for the share-conversation button. No 'loading' state —
 * the share copy is gated on the clipboard write resolving.
 */
export type ShareStatus = "default" | "success" | "error";

/**
 * Media mode toggles between text chat, image generation, and video
 * generation panels. Synced with `?mode=text|image|video` so deep links
 * and redirects from /image-generation + /video-generation work.
 */
export type MediaMode = "text" | "image" | "video";

const MEDIA_MODES: readonly MediaMode[] = ["text", "image", "video"] as const;

export function parseMediaMode(raw: string | null | undefined): MediaMode {
	const v = (raw ?? "").trim().toLowerCase();
	if (v === "image" || v === "img") return "image";
	if (v === "video" || v === "vid") return "video";
	if (v === "text" || v === "chat" || v === "") return "text";
	return "text";
}

export interface UsePlaygroundStateOptions {
	/**
	 * Override the default model. Useful for tests and for callers that
	 * already resolved the search-param-derived value elsewhere. Defaults
	 * to `?model=<value>` from the current URL, falling back to
	 * `minimax-m2.7` (free OMA-AI).
	 */
	defaultModel?: string;
}

export interface PlaygroundState {
	// --- Core chat ---
	model: string;
	setModel: Dispatch<SetStateAction<string>>;
	messages: Message[];
	setMessages: Dispatch<SetStateAction<Message[]>>;
	input: string;
	setInput: Dispatch<SetStateAction<string>>;
	loading: boolean;
	setLoading: Dispatch<SetStateAction<boolean>>;
	error: string | null;
	setError: Dispatch<SetStateAction<string | null>>;

	// --- Settings panel + model params ---
	paramsOpen: boolean;
	setParamsOpen: Dispatch<SetStateAction<boolean>>;
	showAdvanced: boolean;
	setShowAdvanced: Dispatch<SetStateAction<boolean>>;
	temperature: number;
	setTemperature: Dispatch<SetStateAction<number>>;
	topP: number;
	setTopP: Dispatch<SetStateAction<number>>;
	maxTokens: number;
	setMaxTokens: Dispatch<SetStateAction<number>>;
	topK: number;
	setTopK: Dispatch<SetStateAction<number>>;
	freqPenalty: number;
	setFreqPenalty: Dispatch<SetStateAction<number>>;
	presPenalty: number;
	setPresPenalty: Dispatch<SetStateAction<number>>;
	stream: boolean;
	setStream: Dispatch<SetStateAction<boolean>>;

	// --- Web search ---
	webSearchEnabled: boolean;
	setWebSearchEnabled: Dispatch<SetStateAction<boolean>>;
	searching: boolean;
	setSearching: Dispatch<SetStateAction<boolean>>;

	// --- System prompt ---
	systemPrompt: string;
	setSystemPrompt: Dispatch<SetStateAction<string>>;
	systemPromptOpen: boolean;
	setSystemPromptOpen: Dispatch<SetStateAction<boolean>>;

	// --- Toolbar status states ---
	exportStatus: ExportStatus;
	setExportStatus: Dispatch<SetStateAction<ExportStatus>>;
	shareStatus: ShareStatus;
	setShareStatus: Dispatch<SetStateAction<ShareStatus>>;

	// --- Compare mode ---
	compareMode: boolean;
	setCompareMode: Dispatch<SetStateAction<boolean>>;
	compareModel: string;
	setCompareModel: Dispatch<SetStateAction<string>>;
	compareMessages: Message[];
	setCompareMessages: Dispatch<SetStateAction<Message[]>>;

	// --- Misc UI ---
	shortcutsOpen: boolean;
	setShortcutsOpen: Dispatch<SetStateAction<boolean>>;
	mediaMode: MediaMode;
	setMediaMode: Dispatch<SetStateAction<MediaMode>>;
}

/**
 * Playground state container.
 *
 * Bundles every `useState` slot the playground chat page owns into a
 * single hook so the page component stays focused on wiring + callbacks.
 * No cross-cutting logic lives here — just plain state + setters. The
 * side-effects (persistence, streaming, scroll, shortcuts) stay in their
 * own hooks and consume the destructured fields from this one.
 *
 * The `model` initial value is sourced from the `?model=` query param
 * via `useSearchParams`. Callers MUST be wrapped in a `<Suspense>`
 * boundary (the Next.js rule for any client component that reads
 * search params during SSR).
 */
export function usePlaygroundState(
	options: UsePlaygroundStateOptions = {},
): PlaygroundState {
	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();
	// Default to free OMA-AI (OpenBroker) model so guests can chat without sign-in.
	// Lazy string keeps this hook free of a models-data import cycle; value must
	// match FREE_DEFAULT_CHAT_MODEL in @/lib/model-utils.
	const defaultModel =
		options.defaultModel ?? searchParams?.get("model") ?? "minimax-m2.7";
	const initialMode = parseMediaMode(searchParams?.get("mode"));

	// --- Core chat ---
	const [model, setModel] = useState<string>(defaultModel);
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState<string>("");
	const [loading, setLoading] = useState<boolean>(false);
	const [error, setError] = useState<string | null>(null);

	// --- Settings panel + model params ---
	const [paramsOpen, setParamsOpen] = useState<boolean>(false);
	const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
	const [temperature, setTemperature] = useState<number>(0.7);
	const [topP, setTopP] = useState<number>(1);
	const [maxTokens, setMaxTokens] = useState<number>(2048);
	const [topK, setTopK] = useState<number>(40);
	const [freqPenalty, setFreqPenalty] = useState<number>(0);
	const [presPenalty, setPresPenalty] = useState<number>(0);
	const [stream, setStream] = useState<boolean>(true);

	// --- Web search ---
	const [webSearchEnabled, setWebSearchEnabled] = useState<boolean>(false);
	const [searching, setSearching] = useState<boolean>(false);

	// --- System prompt ---
	const [systemPrompt, setSystemPrompt] = useState<string>("");
	const [systemPromptOpen, setSystemPromptOpen] = useState<boolean>(false);

	// --- Toolbar status states ---
	const [exportStatus, setExportStatus] = useState<ExportStatus>("default");
	const [shareStatus, setShareStatus] = useState<ShareStatus>("default");

	// --- Compare mode ---
	// chat playground is a free OMA-AI / Gonka surface. Default
	// the compare slot to the second free model so guests never see a paid
	// Venice model they can't call without signing in.
	const [compareMode, setCompareMode] = useState<boolean>(false);
	const [compareModel, setCompareModel] = useState<string>("kimi-k2-6");
	const [compareMessages, setCompareMessages] = useState<Message[]>([]);

	// --- Misc UI ---
	const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);
	const [mediaMode, setMediaModeState] = useState<MediaMode>(initialMode);

	// Keep mode in sync if the user lands with a new ?mode= (redirects, back/forward).
	useEffect(() => {
		const fromUrl = parseMediaMode(searchParams?.get("mode"));
		setMediaModeState((prev) => (prev === fromUrl ? prev : fromUrl));
	}, [searchParams]);

	const setMediaMode = useCallback(
		(next: SetStateAction<MediaMode>) => {
			setMediaModeState((prev) => {
				const resolved = typeof next === "function" ? next(prev) : next;
				const mode = MEDIA_MODES.includes(resolved) ? resolved : "text";
				// Reflect mode in the URL without a full navigation (shareable deep link).
				if (typeof window !== "undefined" && pathname) {
					const params = new URLSearchParams(searchParams?.toString() ?? "");
					if (mode === "text") params.delete("mode");
					else params.set("mode", mode);
					const qs = params.toString();
					const href = qs ? `${pathname}?${qs}` : pathname;
					router.replace(href, { scroll: false });
				}
				return mode;
			});
		},
		[pathname, router, searchParams],
	);

	return {
		// Core chat
		model,
		setModel,
		messages,
		setMessages,
		input,
		setInput,
		loading,
		setLoading,
		error,
		setError,

		// Settings panel + model params
		paramsOpen,
		setParamsOpen,
		showAdvanced,
		setShowAdvanced,
		temperature,
		setTemperature,
		topP,
		setTopP,
		maxTokens,
		setMaxTokens,
		topK,
		setTopK,
		freqPenalty,
		setFreqPenalty,
		presPenalty,
		setPresPenalty,
		stream,
		setStream,

		// Web search
		webSearchEnabled,
		setWebSearchEnabled,
		searching,
		setSearching,

		// System prompt
		systemPrompt,
		setSystemPrompt,
		systemPromptOpen,
		setSystemPromptOpen,

		// Toolbar status states
		exportStatus,
		setExportStatus,
		shareStatus,
		setShareStatus,

		// Compare mode
		compareMode,
		setCompareMode,
		compareModel,
		setCompareModel,
		compareMessages,
		setCompareMessages,

		// Misc UI
		shortcutsOpen,
		setShortcutsOpen,
		mediaMode,
		setMediaMode,
	};
}
