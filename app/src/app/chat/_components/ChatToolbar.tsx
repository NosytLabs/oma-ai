"use client";

import {
	AlertCircle,
	AlertTriangle,
	CheckCircle2,
	Coins,
	Columns2,
	Download,
	Film,
	Image as ImageIcon,
	Keyboard,
	MessageSquare,
	Search,
	Settings2,
	Share2,
	TerminalSquare,
	Trash2,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { Dispatch, SetStateAction } from "react";
import { memo } from "react";
import type { Message } from "@/components/chat";
import { formatCreditsShort } from "@/components/chat/useBalance";
import { btnBase } from "@/components/playground/PlaygroundComponents";
import { Skeleton } from "@/components/ui/Skeleton";
import type { BalanceResponse } from "@/lib/api";

const LazyModelSelector = dynamic(
	() =>
		import("@/components/chat/ModelSelectorRedesign").then(
			(mod) => mod.ModelSelector,
		),
	{ ssr: false, loading: () => <Skeleton className="h-8 w-40" /> },
);

const LazyStatsBar = dynamic(
	() =>
		import("@/components/playground/PlaygroundComponents").then(
			(mod) => mod.StatsBar,
		),
	{ ssr: false, loading: () => null },
);

const LazyMobileStatsBar = dynamic(
	() =>
		import("@/components/playground/PlaygroundComponents").then(
			(mod) => mod.MobileStatsBar,
		),
	{ ssr: false, loading: () => null },
);

export interface ChatToolbarProps {
	variant?: "chat" | "playground";
	model: string;
	setModel: Dispatch<SetStateAction<string>>;
	paramsOpen: boolean;
	setParamsOpen: Dispatch<SetStateAction<boolean>>;
	webSearchEnabled: boolean;
	setWebSearchEnabled: Dispatch<SetStateAction<boolean>>;
	mediaMode?: "text" | "image" | "video";
	setMediaMode?: Dispatch<SetStateAction<"text" | "image" | "video">>;
	searching: boolean;
	isAuthenticated: boolean;
	balance: BalanceResponse | null;
	balanceDollars: number;
	isLowBalance: boolean;
	compareMode: boolean;
	setCompareMode: Dispatch<SetStateAction<boolean>>;
	shareStatus: "default" | "success" | "error";
	shareConversation: () => void;
	exportStatus: "default" | "loading" | "success" | "error";
	exportConversation: () => void;
	clearChat: () => void;
	/**
	 * `messages.length` rather than the `Message[]` itself. The toolbar
	 * uses this only to gate the share/clear buttons. Holding the array
	 * here would force a re-render on every SSE token flush because the
	 * streaming flush replaces the messages reference.
	 */
	messagesLength: number;
	deferredMessages: Message[];
	setShortcutsOpen: Dispatch<SetStateAction<boolean>>;
	/** Called when a guest tries to select a paid model */
	onAuthRequired?: (modelName: string) => void;
}

/**
 * The top toolbar that sits above the messages pane.
 *
 * Four functional clusters, left → right:
 *   1. Brand mark + model selector + parameters toggle
 *   2. Web search toggle, media mode (text/image/video), searching badge
 *   3. Stats bar (desktop / mobile variants), credit balance pill
 *   4. Compare mode, share, shortcuts, export, clear
 *
 * The Toolbar is purely presentational — every interaction is a prop
 * callback, every label/state is a prop. The page owns the state and
 * the side effects (export blob creation, share link, clear, etc.).
 */
export function ChatToolbar({
	variant = "chat",
	model,
	setModel,
	paramsOpen,
	setParamsOpen,
	webSearchEnabled,
	setWebSearchEnabled,
	mediaMode,
	setMediaMode,
	searching,
	isAuthenticated,
	balance,
	balanceDollars,
	isLowBalance,
	compareMode,
	setCompareMode,
	shareStatus,
	shareConversation,
	exportStatus,
	exportConversation,
	clearChat,
	messagesLength,
	deferredMessages,
	setShortcutsOpen,
	onAuthRequired,
}: ChatToolbarProps) {
	const isChat = variant === "chat";
	const messageCount = messagesLength;

	const creditsPill =
		isChat && isAuthenticated ? (
			balance ? (
				<Link
					href="/deposit"
					aria-label={`Credit balance: ${balanceDollars.toFixed(2)} dollars. Click to add credits.`}
					data-state={isLowBalance ? "low" : "ok"}
					className={`${btnBase} shrink-0 data-[state=low]:!border-warning/40 data-[state=low]:!text-warning data-[state=low]:!bg-warning/10`}
					title="Credits balance — click to deposit"
				>
					{isLowBalance ? (
						<AlertTriangle className="h-3.5 w-3.5 shrink-0" />
					) : (
						<Coins className="h-3.5 w-3.5 shrink-0" />
					)}
					<span className="tabular-nums text-[10px] sm:text-[11px]">
						{formatCreditsShort(balanceDollars)}
					</span>
				</Link>
			) : (
				<span
					className={`${btnBase} shrink-0 opacity-60`}
					aria-label="Loading credit balance"
					title="Loading balance…"
				>
					<Coins className="h-3.5 w-3.5 shrink-0" />
					<span className="tabular-nums text-[10px] sm:text-[11px]">…</span>
				</span>
			)
		) : null;

	const mediaTabs =
		isChat && setMediaMode ? (
			<div
				className="flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-surface p-0.5"
				role="tablist"
				aria-label="Playground mode"
			>
				<button
					type="button"
					role="tab"
					onClick={() => setMediaMode("text")}
					aria-selected={mediaMode === "text"}
					title="Text chat (free OMA-AI models available)"
					className={`${btnBase} !border-0 rounded min-h-[40px] min-w-[40px] ${mediaMode === "text" ? "!bg-accent-dim !text-accent" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
				>
					<MessageSquare className="h-3.5 w-3.5" />
					<span className="hidden sm:inline text-[11px]">Chat</span>
				</button>
				<button
					type="button"
					role="tab"
					onClick={() => setMediaMode("image")}
					aria-selected={mediaMode === "image"}
					title="Image generation (credits)"
					className={`${btnBase} !border-0 rounded min-h-[40px] min-w-[40px] ${mediaMode === "image" ? "!bg-accent-dim !text-accent" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
				>
					<ImageIcon className="h-3.5 w-3.5" />
					<span className="hidden sm:inline text-[11px]">Image</span>
				</button>
				<button
					type="button"
					role="tab"
					onClick={() => setMediaMode("video")}
					aria-selected={mediaMode === "video"}
					title="Video generation (credits)"
					className={`${btnBase} !border-0 rounded min-h-[40px] min-w-[40px] ${mediaMode === "video" ? "!bg-accent-dim !text-accent" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
				>
					<Film className="h-3.5 w-3.5" />
					<span className="hidden sm:inline text-[11px]">Video</span>
				</button>
			</div>
		) : null;

	const webSearchBtn = (
		<button
			type="button"
			onClick={() => setWebSearchEnabled(!webSearchEnabled)}
			aria-label="Toggle web search"
			aria-pressed={webSearchEnabled}
			className={`${btnBase} shrink-0 min-h-[40px] min-w-[40px] ${webSearchEnabled ? "!bg-surface !text-success !border-success/30" : ""} focus-ring`}
			title="Toggle Web Search"
		>
			<Search className="h-3.5 w-3.5" />
			<span className="hidden sm:inline">WEB</span>
		</button>
	);

	return (
		<header
			aria-label="Playground toolbar"
			className="flex h-12 flex-none items-center gap-1.5 border-b border-border bg-void/95 px-1.5 sm:gap-2 sm:px-4"
		>
			{/* Left: model + params (shrinks on mobile) */}
			<div className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
				<div
					className={`mr-1 hidden shrink-0 items-center gap-2 md:flex ${isChat ? "text-accent" : "text-warning"}`}
				>
					<TerminalSquare className="h-4 w-4" />
					<span className="text-[11px] font-bold uppercase tracking-widest">
						OMA
					</span>
				</div>

				<div className="min-w-0 flex-1 sm:max-w-[220px] md:max-w-none md:flex-none">
					<LazyModelSelector
						model={model}
						setModel={setModel}
						isAuthenticated={isAuthenticated}
						onAuthRequired={onAuthRequired}
					/>
				</div>

				<button
					type="button"
					onClick={() => setParamsOpen(!paramsOpen)}
					aria-label="Toggle parameters panel (Cmd+/)"
					aria-pressed={paramsOpen}
					className={`${btnBase} shrink-0 min-h-[36px] min-w-[36px] ${paramsOpen ? "!bg-surface !text-success !border-success/30" : ""} focus-ring`}
					title="Toggle Parameters (Cmd+/)"
				>
					<Settings2 className="h-3.5 w-3.5" />
					<span className="hidden lg:inline">PARAMS</span>
				</button>
			</div>

			{/* Primary actions always visible (mobile + desktop): mode + web search */}
			<div className="flex shrink-0 items-center gap-1">
				{mediaTabs}
				{webSearchBtn}
				{searching && (
					<div
						className="flex shrink-0 items-center gap-1.5 border border-accent/20 bg-accent/10 px-2 py-1 text-[10px] uppercase tracking-widest text-accent"
						role="status"
						aria-live="polite"
					>
						<span className="h-1.5 w-1.5 animate-pulse bg-accent" />
						<span className="hidden xs:inline sm:inline">SEARCH</span>
					</div>
				)}
			</div>

			{/* Secondary actions — scrollable on small screens, never hide media tabs */}
			<div className="flex max-w-[40%] items-center gap-1 overflow-x-auto [scrollbar-width:none] sm:max-w-none sm:gap-2 [&::-webkit-scrollbar]:hidden">
				<div className="hidden shrink-0 md:block">
					<LazyStatsBar messages={deferredMessages} model={model} />
				</div>
				<div className="hidden shrink-0 sm:block md:hidden">
					<LazyMobileStatsBar messages={deferredMessages} model={model} />
				</div>

				{creditsPill}

				<button
					type="button"
					onClick={() => setCompareMode(!compareMode)}
					aria-label="Compare models side-by-side"
					className={`${btnBase} shrink-0 min-h-[40px] min-w-[40px] ${compareMode ? "!bg-surface !text-success !border-success/30" : ""} focus-ring`}
					title="Compare models side-by-side"
					aria-pressed={compareMode}
				>
					<Columns2 className="h-3.5 w-3.5" />
					<span className="hidden lg:inline">COMPARE</span>
				</button>

				<button
					type="button"
					onClick={shareConversation}
					disabled={shareStatus === "default" && messagesLength === 0}
					data-state={shareStatus}
					className={`${btnBase} hidden shrink-0 focus-ring data-[state=success]:border-success/30 data-[state=success]:bg-success/10 data-[state=success]:text-success sm:inline-flex`}
					title="Copy a link that opens this chat with the current model pre-selected"
					aria-label="Copy a link that opens this chat with the current model pre-selected"
				>
					{shareStatus === "success" ? (
						<CheckCircle2 className="h-3.5 w-3.5" />
					) : shareStatus === "error" ? (
						<AlertCircle className="h-3.5 w-3.5" />
					) : (
						<Share2 className="h-3.5 w-3.5" />
					)}
					<span className="hidden lg:inline">SHARE</span>
				</button>

				<button
					type="button"
					onClick={() => setShortcutsOpen(true)}
					className={`${btnBase} hidden shrink-0 focus-ring sm:inline-flex`}
					title="Keyboard shortcuts (?)"
					aria-label="Show keyboard shortcuts"
				>
					<Keyboard className="h-3.5 w-3.5" />
					<span className="hidden lg:inline">?</span>
				</button>

				{messageCount > 0 && (
					<div className="flex shrink-0 items-center gap-1">
						<button
							type="button"
							onClick={exportConversation}
							disabled={exportStatus === "loading"}
							data-state={exportStatus}
							aria-label="Export conversation"
							className={`${btnBase} focus-ring data-[state=loading]:bg-accent/20 data-[state=loading]:text-accent`}
							title="Export"
						>
							{exportStatus === "success" ? (
								<CheckCircle2 className="h-3.5 w-3.5" />
							) : exportStatus === "error" ? (
								<AlertCircle className="h-3.5 w-3.5" />
							) : (
								<Download className="h-3.5 w-3.5" />
							)}
						</button>
						<button
							type="button"
							onClick={clearChat}
							aria-label="Clear conversation"
							className={`${btnBase} hover:!border-error/20 hover:!bg-error/10 hover:!text-error focus-ring`}
							title="Clear"
						>
							<Trash2 className="h-3.5 w-3.5" />
						</button>
					</div>
				)}
			</div>
		</header>
	);
}

// wrap the toolbar in `memo` so SSE token flushes (which
// replace the messages array reference) don't re-render the entire
// toolbar — the toolbar reads `messages.length` (via `clearChat`/`share`)
// but doesn't render the messages themselves. The shell passes a stable
// `messagesLength: number` to keep the memo effective; the actual
// `messages: Message[]` reference is not in the toolbar's prop list.
export const MemoizedChatToolbar = memo(ChatToolbar);
