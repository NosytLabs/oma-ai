"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Dispatch, SetStateAction } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Message } from "@/components/chat";
import {
	CHAT_PARAMS_DEFAULTS,
	normalizeChatParams,
	readChatParams,
	writeChatParams,
	type ChatParams,
} from "@/lib/chat-params-storage";
import { MODELS } from "@/lib/models-data";
import { FREE_DEFAULT_CHAT_MODEL } from "@/lib/model-utils";

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

interface ComparisonFields {
	mode: boolean;
	model: string;
	messages: Message[];
	error: string | null;
}
interface ComparisonOwner { key: string | null }
function emptyComparison(owner: ComparisonOwner): ComparisonFields & { owner: ComparisonOwner } {
	return { owner, mode: false, model: FREE_DEFAULT_CHAT_MODEL, messages: [], error: null };
}

export interface UsePlaygroundStateOptions {
	/**
	 * Override the default model. Useful for tests and for callers that
	 * already resolved the search-param-derived value elsewhere. Defaults
	 * to `?model=<value>` from the current URL, falling back to
	 * `FREE_DEFAULT_CHAT_MODEL` (free OMA-AI / MiniMax on Gonka/OpenBroker).
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
	/**
	 * Ids of the models currently served (live availability set). When
	 * provided, a selection that is no longer in this set — whether it came
	 * from `?model=`, localStorage, or an earlier pick — falls back to
	 * FREE_DEFAULT_CHAT_MODEL so a send never goes out with an unusable
	 * model (BUG-G). Pass the live list; omit it to skip the check.
	 */
	availableModelIds?: string[];
	/** When `true`, auth state has resolved — safe to read the userId-scoped
	 *  bucket. Before this flips on, hydration stays pending so a guest value
	 *  cannot flash into or initialize an authenticated account. */
	authReady?: boolean;
}

export interface PlaygroundState {
	// --- Core chat ---
	model: string;
	/** URL/storage model hydration has finished for the current account identity. */
	modelHydrated: boolean;
	/** A valid `?model=` supplied the first model shown on this mount. */
	hasInitialUrlModel: boolean;
	setModel: Dispatch<SetStateAction<string>>;
	messages: Message[];
	setMessages: Dispatch<SetStateAction<Message[]>>;
	input: string;
	setInput: Dispatch<SetStateAction<string>>;
	loading: boolean;
	setLoading: Dispatch<SetStateAction<boolean>>;
	error: string | null;
	setError: Dispatch<SetStateAction<string | null>>;
	/** Compare-panel errors. Kept out of `error` so an unrelated side
	 *  stream can't take over the primary ChatErrorBanner (BUG-H). */
	compareError: string | null;
	setCompareError: Dispatch<SetStateAction<string | null>>;

	// --- Settings panel + model params ---
	paramsOpen: boolean;
	setParamsOpen: Dispatch<SetStateAction<boolean>>;
	showAdvanced: boolean;
	setShowAdvanced: Dispatch<SetStateAction<boolean>>;
	/**
	 * Non-null when a parameter write failed; the optimistic change has
	 * already been reverted (BUG-I). Cleared on the next successful save.
	 */
	paramsError: string | null;
	clearParamsError: () => void;
	applyChatParams: (updates: Partial<ChatParams>) => boolean;
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
	const initialUrlModelRef = useRef<string | null>(
		isKnownModelId(urlModel) ? urlModel : null,
	);
	const initialDefaultModelRef = useRef(
		options.defaultModel && isKnownModelId(options.defaultModel)
			? options.defaultModel
			: FREE_DEFAULT_CHAT_MODEL,
	);
	const initialModel = (() => {
		if (options.defaultModel && isKnownModelId(options.defaultModel))
			return options.defaultModel;
		if (urlModel && isKnownModelId(urlModel)) return urlModel;
		// localStorage read is deferred to the post-mount effect below so
		// the SSR pass and the first client render agree — useState's
		// initializer runs on both, and a localStorage hit on the server
		// would throw (or return null, making the two passes diverge).
		return FREE_DEFAULT_CHAT_MODEL;
	})();

	// --- Core chat ---
	const [model, setModelRaw] = useState<string>(initialModel);
	const [hydratedModelIdentity, setHydratedModelIdentity] = useState<string | null>(
		null,
	);
	const initialUrlIdentityRef = useRef<string | null>(null);
	// Track the last userId we persisted under. The effect below moves the
	// stored value into a new bucket on sign-in / sign-out so a guest's
	// saved model doesn't leak into a signed-in session (and vice versa).
	const lastScopedUserIdRef = useRef<string | null>(null);

	/** Track whether the user has explicitly changed the model since mount.
		*  Used to gate the URL mirror effect so a cold load on /chat doesn't
* rewrite a clean URL to ?model=<default-free-model>, while a deep
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

	// BUG-I: parameters used to be pure component state. They now hydrate
	// from localStorage and every change is written back; a failed write
	// reverts the optimistic UI update and raises `paramsError` so the
	// panel can say "not saved" instead of pretending the change stuck.
	// The SSR pass and the first client render must agree, so the stored
	// value is read in an effect (not a useState initializer).
	const [chatParams, setChatParams] = useState<ChatParams>({
		...CHAT_PARAMS_DEFAULTS,
	});
	const [paramsError, setParamsError] = useState<string | null>(null);
	const chatParamsRef = useRef(chatParams);
	chatParamsRef.current = chatParams;

	useEffect(() => {
		if (typeof window === "undefined") return;
		const stored = readChatParams();
		if (stored) setChatParams(stored);
	}, []);

	// Manual controls and generated forms commit through the same checked path.
	// Persist before updating React state, so a failed form is never half applied.
	const applyChatParams = useCallback((updates: Partial<ChatParams>): boolean => {
		const next = normalizeChatParams({ ...chatParamsRef.current, ...updates });
		if (!writeChatParams(next)) {
			setParamsError("Couldn't save these settings in your browser — changes were not applied");
			return false;
		}
		chatParamsRef.current = next;
		setChatParams(next);
		setParamsError(null);
		return true;
	}, []);

	const updateParam = useCallback(
		<K extends keyof ChatParams>(key: K, value: SetStateAction<ChatParams[K]>) => {
			const resolved = typeof value === "function"
				? (value as (previous: ChatParams[K]) => ChatParams[K])(chatParamsRef.current[key])
				: value;
			applyChatParams({ [key]: resolved });
		},
		[applyChatParams],
	);

	const setTemperature = useCallback<Dispatch<SetStateAction<number>>>(
		(next) => updateParam("temperature", next),
		[updateParam],
	);
	const setTopP = useCallback<Dispatch<SetStateAction<number>>>(
		(next) => updateParam("topP", next),
		[updateParam],
	);
	const setMaxTokens = useCallback<Dispatch<SetStateAction<number>>>(
		(next) => updateParam("maxTokens", next),
		[updateParam],
	);
	const setTopK = useCallback<Dispatch<SetStateAction<number>>>(
		(next) => updateParam("topK", next),
		[updateParam],
	);
	const setFreqPenalty = useCallback<Dispatch<SetStateAction<number>>>(
		(next) => updateParam("freqPenalty", next),
		[updateParam],
	);
	const setPresPenalty = useCallback<Dispatch<SetStateAction<number>>>(
		(next) => updateParam("presPenalty", next),
		[updateParam],
	);
	const setStream = useCallback<Dispatch<SetStateAction<boolean>>>(
		(next) => updateParam("stream", next),
		[updateParam],
	);
	const { temperature, topP, maxTokens, topK, freqPenalty, presPenalty, stream } =
		chatParams;

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

	// --- Compare mode ---
	// Default the compare slot to a free OMA-AI peer so guests can run
	// side-by-side without signing in for Venice models.
	const comparisonOwner = options.authReady ? modelStorageKey(options.userId) : null;
	const [comparison, setComparison] = useState(() => emptyComparison({ key: comparisonOwner }));
	// Primary threads have their own persisted identity buckets. Comparison
	// transcripts are transient and must disappear before a new owner can send.
	// Adjust this state owner before children commit, rather than mutating a
	// render ref or leaving private content visible until a passive effect.
	const visibleComparison = comparison.owner.key === comparisonOwner ? comparison : emptyComparison({ key: comparisonOwner });
	if (visibleComparison !== comparison) setComparison(visibleComparison);
	const comparisonScope = visibleComparison.owner;
	const { mode: compareMode, model: compareModel, messages: compareMessages, error: compareError } = visibleComparison;
	const updateComparison = useCallback(<K extends keyof ComparisonFields>(field: K, next: SetStateAction<ComparisonFields[K]>) => {
		setComparison(previous => {
			// The scope object is a transition generation, so a first-A setter
			// stays invalid after A to B to A, even though the key matches again.
			if (previous.owner !== comparisonScope) return previous;
			const value = typeof next === "function" ? (next as (value: ComparisonFields[K]) => ComparisonFields[K])(previous[field]) : next;
			return { ...previous, [field]: value };
		});
	}, [comparisonScope]);
	const setCompareMode = useCallback<Dispatch<SetStateAction<boolean>>>(next => updateComparison("mode", next), [updateComparison]);
	const setCompareModel = useCallback<Dispatch<SetStateAction<string>>>(next => updateComparison("model", next), [updateComparison]);
	const setCompareMessages = useCallback<Dispatch<SetStateAction<Message[]>>>(next => updateComparison("messages", next), [updateComparison]);
	const setCompareError = useCallback<Dispatch<SetStateAction<string | null>>>(next => updateComparison("error", next), [updateComparison]);

	// --- Misc UI ---
	const [shortcutsOpen, setShortcutsOpen] = useState<boolean>(false);

	// Rehydrate once auth resolves and again whenever the mounted account
	// changes. A valid URL model wins only for the first resolved identity;
	// later account transitions must read their own bucket instead of carrying
	// the previous account's selection across scopes.
	useEffect(() => {
		if (typeof window === "undefined") return;
		if (!options.authReady) {
			userChangedModelRef.current = false;
			setHydratedModelIdentity(null);
			return;
		}
		const userId = options.userId ?? null;
		const identity = modelStorageKey(userId);
		lastScopedUserIdRef.current = userId;
		userChangedModelRef.current = false;
		const preserveInitialUrl =
			initialUrlModelRef.current !== null &&
			(initialUrlIdentityRef.current === null ||
				initialUrlIdentityRef.current === identity);
		if (preserveInitialUrl && initialUrlIdentityRef.current === null) {
			initialUrlIdentityRef.current = identity;
		}
		if (!preserveInitialUrl) {
			setModelRaw(readStoredModel(userId) ?? initialDefaultModelRef.current);
		}
		setHydratedModelIdentity(identity);
	}, [options.authReady, options.userId]);

	// BUG-G: validate the resolved selection against the LIVE availability
	// set. `isKnownModelId` only checks the static catalog, so a model the
	// provider retired (or a guest-tier gated one) still passes and the
	// next send would go out with a model the server rejects.
	useEffect(() => {
		if (typeof window === "undefined") return;
		const available = options.availableModelIds;
		if (!available || available.length === 0) return;
		if (available.includes(model)) return;
		const fallback = available.includes(FREE_DEFAULT_CHAT_MODEL)
			? FREE_DEFAULT_CHAT_MODEL
			: available[0];
		setModelRaw(fallback);
	}, [options.availableModelIds, model]);

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
	// rewrite a clean URL to ?model=<default-free-model>; only an
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
		modelHydrated:
			Boolean(options.authReady) &&
			hydratedModelIdentity === modelStorageKey(options.userId ?? null),
		hasInitialUrlModel: initialUrlModelRef.current !== null,
		setModel,
		messages,
		setMessages,
		input,
		setInput,
		loading,
		setLoading,
		error,
		setError,
		compareError,
		setCompareError,

		// Settings panel + model params
		paramsOpen,
		setParamsOpen,
		showAdvanced,
		setShowAdvanced,
		paramsError,
		clearParamsError: () => setParamsError(null),
		applyChatParams,
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
	};
}
