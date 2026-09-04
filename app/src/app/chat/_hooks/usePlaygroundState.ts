"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "@/components/chat";
import { MODELS } from "@/lib/models-data";

/**
	* Status enum for the share-conversation button. No 'loading' state —
	* the share copy is gated on the clipboard write resolving.
	*/
type ShareStatus = "default" | "success" | "error";

/** localStorage key for the user-scoped model preference. Mirrors the
	*  `conversationStorageKey` pattern: guests get their own bucket so a
	*  signed-in / signed-out pair of users on the same browser don't fight
	*  over the saved model. The value is unknown until auth resolves, so the
	*  hook re-reads it inside an effect when `userId` changes. */
function modelStorageKey(userId: string | null | undefined): string {
	return userId ? `oma_chat_model:u:${userId}` : "oma_chat_model:guest";
}

/** Validates a value looks like a catalog id we still serve. Drops stale
	*  saves (e.g. catalog trimmed an entry since last visit) so we never
	*  boot the playground with a model that 404s. */
function isKnownModelId(id: string | null | undefined): id is string {
	if (!id || typeof id !== "string") return false;
	return MODELS.some((m) => m.id === id);
}

function readStoredModel(userId: string | null | undefined): string | null {
	if (typeof window === "undefined") return null;
	try {
		const v = localStorage.getItem(modelStorageKey(userId));
		return isKnownModelId(v) ? v : null;
	} catch {
		return null;
	}
}

/**
	* Media mode is now text-only — OMA sells text + multimodal LLM
	* inference. Legacy `?mode=image|video|create` deep links still resolve
	* to the chat surface so old share URLs don't break. The previous image
	* and video generation routes have been removed from the server.
	*/
export type MediaMode = "text";

export function parseMediaMode(_raw: string | null | undefined): MediaMode {
	// All non-text deep links (image, video, create, media) redirect to
	// the chat surface — image/video generation is no longer offered.
	return "text";
}

export interface UsePlaygroundStateOptions {
	/**
	 * Override the default model. Useful for tests and for callers that
	 * already resolved the search-param-derived value elsewhere. Defaults
	 * to `?model=<value>` from the current URL, falling back to
	 * `deepseek-v4-flash-0731-openbroker` (free OMA-AI on Gonka).
	 */
	defaultModel?: string;
	/**
	 * Authenticated user id, or `null`/`undefined` for an anonymous guest.
	 * Drives which localStorage bucket the saved model lives in so a guest's
	 * picking doesn't leak into a signed-in session on the same browser.
	 * Pass `null` until `useAuth().isReady === true` — the hook will treat
	 * unknown auth as guest and re-read once the id resolves.
	 */
	userId?: string | null;
	/** When `true`, auth state has resolved — safe to read the userId-scoped
	 *  bucket. Before this flips on, the hook always reads the guest bucket
	 *  to avoid an `undefined`/`null` key smashing both. */
	authReady?: boolean;
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
	// Resolution priority on first mount:
	//   1. `options.defaultModel` (test overrides / SSR)
	//   2. `?model=` URL param — wins so shared deep links survive reload
	//   3. localStorage preference (user-scoped, see `modelStorageKey`)
	//   4. FREE_DEFAULT_CHAT_MODEL — always render *something* on cold start
	// The lazy initializer avoids a localStorage hit on every render and
	// keeps SSR + first paint consistent (no flicker to a stale default).
	const urlModel = searchParams?.get("model");
	const initialModel = (() => {
		if (options.defaultModel && isKnownModelId(options.defaultModel))
			return options.defaultModel;
		if (urlModel && isKnownModelId(urlModel)) return urlModel;
		// localStorage read is deferred to the post-mount effect below so
		// the SSR pass and the first client render agree — useState's
		// initializer runs on both, and a localStorage hit on the server
		// would throw (or return null, making the two passes diverge).
		return "deepseek-v4-flash-0731-openbroker";
	})();

	// --- Core chat ---
	const [model, setModelRaw] = useState<string>(initialModel);
	// Track the last userId we persisted under. The effect below moves the
	// stored value into a new bucket on sign-in / sign-out so a guest's
	// saved model doesn't leak into a signed-in session (and vice versa).
	const lastScopedUserIdRef = useRef<string | null>(null);

	/** Track whether the user has explicitly changed the model since mount.
		*  Used to gate the URL mirror effect so a cold load on /chat doesn't
* rewrite a clean URL to ?model=deepseek-v4-flash-0731-openbroker, while a deep
		*  link ?model=foo (which sets the initial state via the lazy
		*  initializer) still wins on first render. Flips to `true` only on
		*  the wrapper call, not on internal `setModelRaw` writes (rehydrate
		*  / option override) so an auth-driven bucket swap doesn't pollute
		*  the URL either. */
	const userChangedModelRef = useRef(false);
	const setModel = useCallback<Dispatch<SetStateAction<string>>>((next) => {
		userChangedModelRef.current = true;
		setModelRaw((prev) => {
			const value = typeof next === "function" ? next(prev) : next;
			return value;
		});
	}, []);
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

	// --- Web search (persist preference so WEB mode survives reloads) ---
	const [webSearchEnabled, setWebSearchEnabledState] = useState<boolean>(() => {
		if (typeof window === "undefined") return false;
		try {
			return localStorage.getItem("oma_chat_web_search") === "1";
		} catch {
			return false;
		}
	});
	const setWebSearchEnabled = useCallback((v: SetStateAction<boolean>) => {
		setWebSearchEnabledState((prev) => {
			const next = typeof v === "function" ? v(prev) : v;
			try {
				if (next) localStorage.setItem("oma_chat_web_search", "1");
				else localStorage.removeItem("oma_chat_web_search");
			} catch {
				/* private mode */
			}
			return next;
		});
	}, []);
	const [searching, setSearching] = useState<boolean>(false);

	// --- System prompt ---
	const [systemPrompt, setSystemPrompt] = useState<string>("");
	const [systemPromptOpen, setSystemPromptOpen] = useState<boolean>(false);

	// --- Toolbar status states ---
	const [shareStatus, setShareStatus] = useState<ShareStatus>("default");

	// --- Compare mode ---
	// Default the compare slot to a free OMA-AI peer so guests can run
	// side-by-side without signing in for Venice models.
	const [compareMode, setCompareMode] = useState<boolean>(false);
	const [compareModel, setCompareModel] = useState<string>("deepseek-v4-flash-0731-openbroker");
	const [compareMessages, setCompareMessages] = useState<Message[]>([]);

	// --- Misc UI ---
	const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);
	const [mediaMode, setMediaMode] = useState<MediaMode>("text");

	// Strip legacy `?mode=` query params on mount so old share URLs
	// land cleanly on the chat surface instead of carrying dead state.
	useEffect(() => {
		if (typeof window === "undefined" || !pathname) return;
		const raw = searchParams?.get("mode");
		if (!raw) return;
		const params = new URLSearchParams(searchParams?.toString() ?? "");
		params.delete("mode");
		const qs = params.toString();
		const href = qs ? `${pathname}?${qs}` : pathname;
		router.replace(href, { scroll: false });
	}, [pathname, router, searchParams]);

	// Model persistence — rehydrate from localStorage on mount (after auth
	// resolves, so the user-scoped bucket is correct) and re-write whenever
	// the user picks a new model. URL `?model=` always wins on the first
	// rehydration so deep links keep working.
	useEffect(() => {
		if (typeof window === "undefined") return;
		const userId = options.authReady ? options.userId ?? null : null;
		lastScopedUserIdRef.current = userId;
		const urlParam = searchParams?.get("model");
		if (!urlParam || !isKnownModelId(urlParam)) {
			const stored = readStoredModel(userId);
			if (stored && stored !== model) {
				setModelRaw(stored);
			}
		}
		// Intentionally one-shot on mount — re-running when `model` changes
		// would clobber the user's in-flight selection with the stored one.
	}, [options.authReady]);

	// Persist whenever the user explicitly picks a model. Gated by
	// `userChangedModelRef` (NOT by a one-shot `isFirstWrite` ref) so
	// React StrictMode's double-invoked effects don't write the initial
	// URL/default value back to localStorage — that would clobber a
	// previously-saved choice the moment the user lands on /chat or on
	// a fresh deep link.
	useEffect(() => {
		if (typeof window === "undefined") return;
		if (!userChangedModelRef.current) return;
		if (!isKnownModelId(model)) return;
		try {
			localStorage.setItem(
				modelStorageKey(lastScopedUserIdRef.current),
				model,
			);
		} catch {
			/* private mode */
		}
	}, [model]);

	// Mirror the selection into `?model=` so a refresh / share URL keeps
	// it. Gated by `userChangedModelRef` so cold loads on /chat don't
	// rewrite a clean URL to ?model=deepseek-v4-flash-0731-openbroker; only an
	// explicit user pick triggers a router.replace. Deep links via
	// ?model=… still win on first mount via the `initialModel` initializer.
	useEffect(() => {
		if (typeof window === "undefined" || !pathname) return;
		if (!userChangedModelRef.current) return;
		// Read the live URL instead of the App Router snapshot. The snapshot can
		// lag one render behind immediately after a client-side selection.
		const params = new URLSearchParams(window.location.search);
		const current = params.get("model");
		if (current === model) return;
		if (model && isKnownModelId(model)) {
			params.set("model", model);
		} else {
			params.delete("model");
		}
		const qs = params.toString();
		const href = qs ? `${pathname}?${qs}` : pathname;
		router.replace(href, { scroll: false });
	}, [model, pathname, router, searchParams]);

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
