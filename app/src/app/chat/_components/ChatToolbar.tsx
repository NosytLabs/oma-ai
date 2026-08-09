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
	Settings2,
	Share2,
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

export interface ChatToolbarProps {
	variant?: "chat" | "playground";
	model: string;
	setModel: Dispatch<SetStateAction<string>>;
	paramsOpen: boolean;
	setParamsOpen: Dispatch<SetStateAction<boolean>>;
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
 * 1. Brand mark + model selector + parameters toggle
 * 2. Media mode (text/image/video), searching badge
 * 3. Stats bar (desktop / mobile variants), credit balance pill
 * 4. Compare mode, share, shortcuts, export, clear
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
	mediaMode,
	setMediaMode,
}: ChatToolbarProps) {
	const isChat = variant === "chat";
	const messageCount = messagesLength;

	const creditsPill =
		isChat && isAuthenticated ? (
			balance ? (
				<Link
					href="/deposit"
					aria-label={`Credit balance: ${Math.round(parseFloat(balance.balanceCents))} credits. Click to add credits.`}
					data-state={isLowBalance ? "low" : "ok"}
					className={`${btnBase} shrink-0 data-[state=low]:!border-warning/40 data-[state=low]:!text-warning data-[state=low]:!bg-warning/10`}
					title="Credit balance — click to add credits"
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
					title="Loading credits…"
				>
					<Coins className="h-3.5 w-3.5 shrink-0" />
					<span className="tabular-nums text-[10px] sm:text-[11px]">…</span>
				</span>
			)
		) : null;

	// 2026-08-02: IMAGE and VIDEO tabs restored — the underlying
	// endpoints (/v1/images/generations, /v1/videos/generations) exist
	// on the server and the generation panels are wired into MessagesList.
	const mediaTabs =
		isChat && setMediaMode ? (
			<div
				className="flex shrink-0 items-center gap-0.5 rounded-[var(--radius-md)] border border-border bg-surface p-0.5"
				role="tablist"
				aria-label="Playground mode"
			>
				<button
					type="button"
					role="tab"
					onClick={() => setMediaMode("text")}
					aria-selected={mediaMode === "text"}
					title="Text chat (free OMA-AI models available)"
					className={`${btnBase} !border-0 rounded-[var(--radius-md)] min-h-[36px] min-w-[40px] transition-[colors,box-shadow,transform] duration-200 ease-out active:scale-[0.97] ${mediaMode === "text" ? "!bg-accent/15 !text-accent" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
				>
					<MessageSquare className="h-4 w-4" />
					<span className="hidden sm:inline text-[12px] font-medium tracking-wide">Chat</span>
				</button>
				<button
					type="button"
					role="tab"
					onClick={() => setMediaMode("image")}
					aria-selected={mediaMode === "image"}
					title="Image generation (credits)"
					className={`${btnBase} !border-0 rounded-[var(--radius-md)] min-h-[36px] min-w-[40px] transition-[colors,box-shadow,transform] duration-200 ease-out active:scale-[0.97] ${mediaMode === "image" ? "!bg-accent/15 !text-accent" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
				>
					<ImageIcon className="h-4 w-4" />
					<span className="hidden sm:inline text-[12px] font-medium tracking-wide">Image</span>
				</button>
				<button
					type="button"
					role="tab"
					onClick={() => setMediaMode("video")}
					aria-selected={mediaMode === "video"}
					title="Video generation (credits)"
					className={`${btnBase} !border-0 rounded-[var(--radius-md)] min-h-[36px] min-w-[40px] transition-[colors,box-shadow,transform] duration-200 ease-out active:scale-[0.97] ${mediaMode === "video" ? "!bg-accent/15 !text-accent" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
				>
					<Film className="h-4 w-4" />
					<span className="hidden sm:inline text-[12px] font-medium tracking-wide">Video</span>
				</button>
			</div>
		) : null;

	// Web search toggle moved into the composer input row (2026-08-01) —
	// it belongs next to the send action, not in the model/status toolbar.

	return (
		<header
			aria-label="Playground toolbar"
			className="grid h-14 min-w-0 flex-none grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-border bg-void/95 px-3 sm:gap-3 sm:px-6 z-20"
		>
			{/* Left: model + params (shrinks on mobile) */}
			<div className="flex min-w-0 items-center gap-1 sm:gap-2 justify-self-start">
				{/* Compact model badge — replaces the previous "OMA · Gemini 3 Flash" pill
				 that was duplicating the navbar brand. Now just shows the current
				 model with tier color so the active selection is always visible. */}
				<div className="min-w-0 w-[clamp(7rem,36vw,13.75rem)] flex-none sm:w-auto sm:flex-1 sm:max-w-[200px] md:max-w-[220px]">
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
					aria-label="PARAMS — toggle parameters panel (Cmd+/)"
					aria-pressed={paramsOpen}
					className={`${btnBase} shrink-0 min-h-[36px] min-w-[36px] transition-[colors,box-shadow,transform] duration-200 ease-out active:scale-[0.97] ${paramsOpen ? "!bg-surface !text-success !border-success/30" : ""} focus-ring`}
					title="Toggle Parameters (Cmd+/)"
				>
					<Settings2 className="h-3.5 w-3.5" />
					<span className="hidden lg:inline">PARAMS</span>
				</button>
			</div>

			{/* Primary actions always visible (mobile + desktop) */}
			<div className="flex shrink-0 items-center gap-1">
				{mediaTabs}
				{searching && (
					<div
						className="flex shrink-0 items-center gap-1.5 border border-accent/20 bg-accent/10 px-2 py-1.5 text-[10px] uppercase tracking-widest text-accent"
						role="status"
						aria-live="polite"
						aria-label="Searching the web"
					>
						<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
						<span>SEARCH</span>
					</div>
				)}
			</div>

			{/* Secondary actions — credits always visible, rest hidden on mobile */}
			<div className="flex min-w-0 items-center gap-1 sm:gap-2 justify-self-end">
				<div className="hidden shrink-0 xl:block">
					<LazyStatsBar messages={deferredMessages} model={model} />
				</div>

				{creditsPill}

				<button
					type="button"
					onClick={() => setCompareMode(!compareMode)}
					aria-label="Compare models side-by-side"
					className={`${btnBase} hidden shrink-0 sm:flex min-h-[36px] min-w-[36px] transition-[colors,box-shadow,transform] duration-200 ease-out active:scale-[0.97] ${compareMode ? "!bg-surface !text-success !border-success/30" : ""} focus-ring`}
					title="Compare models side-by-side"
					aria-pressed={compareMode}
				>
					<Columns2 className="h-3.5 w-3.5" />
					<span className="hidden xl:inline">COMPARE</span>
				</button>

				<button
					type="button"
					onClick={shareConversation}
					disabled={shareStatus === "default" && messagesLength === 0}
					data-state={shareStatus}
					className={`${btnBase} max-xl:hidden shrink-0 focus-ring transition-[colors,box-shadow,transform] duration-200 ease-out active:scale-[0.97] data-[state=success]:border-success/30 data-[state=success]:bg-success/10 data-[state=success]:text-success xl:inline-flex`}
					title="Copy a link that opens this chat with the current model pre-selected"
					aria-label="SHARE — copy a link that opens this chat with the current model pre-selected"
				>
					{shareStatus === "success" ? (
						<CheckCircle2 className="h-3.5 w-3.5" />
					) : shareStatus === "error" ? (
						<AlertCircle className="h-3.5 w-3.5" />
					) : (
						<Share2 className="h-3.5 w-3.5" />
					)}
					<span className="hidden xl:inline">SHARE</span>
				</button>

				<button
					type="button"
					onClick={() => setShortcutsOpen(true)}
					className={`${btnBase} max-sm:hidden shrink-0 focus-ring transition-[colors,box-shadow,transform] duration-200 ease-out active:scale-[0.97] sm:inline-flex`}
					title="Keyboard shortcuts (?)"
					aria-label="? — show keyboard shortcuts"
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
							aria-label="Export conversation to JSON"
							className={`${btnBase} focus-ring transition-[colors,box-shadow,transform] duration-200 ease-out active:scale-[0.97] data-[state=loading]:bg-accent/20 data-[state=loading]:text-accent`}
							title="Export conversation (JSON)"
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
							aria-label="Clear conversation and local history"
							className={`${btnBase} transition-[colors,box-shadow,transform] duration-200 ease-out active:scale-[0.97] hover:!border-error/20 hover:!bg-error/10 hover:!text-error focus-ring`}
							title="Clear chat (also clears browser local history)"
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
