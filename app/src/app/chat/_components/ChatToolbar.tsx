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
}: ChatToolbarProps) {
	const isChat = variant === "chat";
	const messageCount = messagesLength;
	return (
		<header
			aria-label="Playground toolbar"
			className="flex-none h-12 border-b border-border flex items-center justify-between px-4 bg-void/95"
		>
			<div className="flex items-center gap-4">
				<div
					className={`flex items-center gap-2 mr-4 ${isChat ? "text-accent" : "text-warning"}`}
				>
					<TerminalSquare className="w-4 h-4" />
					<span className="text-[11px] font-bold tracking-widest uppercase">
						OMA.WB
					</span>
				</div>

				<div className="h-4 w-px bg-border hidden md:block" />

				<LazyModelSelector model={model} setModel={setModel} />

				<button
					type="button"
					onClick={() => setParamsOpen(!paramsOpen)}
					aria-label="Toggle parameters panel (Cmd+/)"
					aria-pressed={paramsOpen}
					className={`${btnBase} ${paramsOpen ? "!bg-surface !text-success !border-success/30" : ""} focus-ring`}
					title="Toggle Parameters (Cmd+/)"
				>
					<Settings2 className="w-3.5 h-3.5" />
					<span className="hidden sm:inline">PARAMS</span>
				</button>
			</div>

			<div className="flex items-center gap-2">
				<button
					type="button"
					onClick={() => setWebSearchEnabled(!webSearchEnabled)}
					aria-label="Toggle web search"
					aria-pressed={webSearchEnabled}
					className={`${btnBase} ${webSearchEnabled ? "!bg-surface !text-success !border-success/30" : ""} focus-ring`}
					title="Toggle Web Search (Tinyfish MCP)"
				>
					<Search className="w-3.5 h-3.5" />
					<span className="hidden sm:inline">WEB</span>
				</button>

				{isChat && setMediaMode && (
					<div
						className="flex items-center gap-0.5 border border-border bg-surface"
						role="group"
						aria-label="Chat mode"
					>
						<button
							type="button"
							onClick={() => setMediaMode("text")}
							aria-pressed={mediaMode === "text"}
							title="Text chat"
							className={`${btnBase} !border-0 ${mediaMode === "text" ? "!bg-accent-dim !text-accent" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
						>
							<MessageSquare className="w-3.5 h-3.5" />
							<span className="hidden md:inline">TEXT</span>
						</button>
						<button
							type="button"
							onClick={() => setMediaMode("image")}
							aria-pressed={mediaMode === "image"}
							title="Image generation"
							className={`${btnBase} !border-0 ${mediaMode === "image" ? "!bg-accent-dim !text-accent" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
						>
							<ImageIcon className="w-3.5 h-3.5" />
							<span className="hidden md:inline">IMG</span>
						</button>
						<button
							type="button"
							onClick={() => setMediaMode("video")}
							aria-pressed={mediaMode === "video"}
							title="Video generation"
							className={`${btnBase} !border-0 ${mediaMode === "video" ? "!bg-accent-dim !text-accent" : ""} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent`}
						>
							<Film className="w-3.5 h-3.5" />
							<span className="hidden md:inline">VID</span>
						</button>
					</div>
				)}

				{searching && (
					<div className="flex items-center gap-2 px-3 py-1.5 text-[10px] text-accent uppercase tracking-widest border border-accent/20 bg-accent/10">
						<span className="w-1.5 h-1.5 bg-accent animate-pulse" />
						NET_REQ
					</div>
				)}

				<div className="h-4 w-px bg-border mx-2 hidden md:block" />
				<div className="hidden md:block">
					<LazyStatsBar messages={deferredMessages} model={model} />
				</div>
				<div className="md:hidden">
					<LazyMobileStatsBar messages={deferredMessages} model={model} />
				</div>
				<div className="h-4 w-px bg-border mx-2 hidden md:block" />

				{/* Credits pill — visible only in chat when authenticated. Warns (warning
            palette) under $1 so the user knows to top up before a big call. */}
				{isChat && isAuthenticated && balance && (
					<Link
						href="/deposit"
						aria-label={`Credit balance: ${balanceDollars.toFixed(2)} dollars. Click to add credits.`}
						data-state={isLowBalance ? "low" : "ok"}
						className={`${btnBase} data-[state=low]:!border-warning/40 data-[state=low]:!text-warning data-[state=low]:!bg-warning/10`}
						title="Credits balance — click to deposit"
					>
						{isLowBalance ? (
							<AlertTriangle className="w-3.5 h-3.5" />
						) : (
							<Coins className="w-3.5 h-3.5" />
						)}
						<span className="hidden sm:inline tabular-nums">
							{formatCreditsShort(balanceDollars)}
						</span>
					</Link>
				)}

				<button
					type="button"
					onClick={() => setCompareMode(!compareMode)}
					aria-label="Compare models side-by-side"
					className={`${btnBase} ${compareMode ? "!bg-surface !text-success !border-success/30" : ""} focus-ring`}
					title="Compare models side-by-side"
					aria-pressed={compareMode}
				>
					<Columns2 className="w-3.5 h-3.5" />
					<span className="hidden sm:inline">COMPARE</span>
				</button>

				<button
					type="button"
					onClick={shareConversation}
					disabled={shareStatus === "default" && messagesLength === 0}
					data-state={shareStatus}
					className={`${btnBase} focus-ring data-[state=success]:text-success data-[state=success]:border-success/30 data-[state=success]:bg-success/10`}
					title="Copy a link that opens this chat with the current model pre-selected"
					aria-label="Copy a link that opens this chat with the current model pre-selected"
				>
					{shareStatus === "success" ? (
						<CheckCircle2 className="w-3.5 h-3.5" />
					) : shareStatus === "error" ? (
						<AlertCircle className="w-3.5 h-3.5" />
					) : (
						<Share2 className="w-3.5 h-3.5" />
					)}
					<span className="hidden sm:inline">SHARE</span>
				</button>

				<button
					type="button"
					onClick={() => setShortcutsOpen(true)}
					className={`${btnBase} focus-ring`}
					title="Keyboard shortcuts (?)"
					aria-label="Show keyboard shortcuts"
				>
					<Keyboard className="w-3.5 h-3.5" />
					<span className="hidden sm:inline">?</span>
				</button>

				{messageCount > 0 && (
					<div className="flex items-center gap-1">
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
								<CheckCircle2 className="w-3.5 h-3.5" />
							) : exportStatus === "error" ? (
								<AlertCircle className="w-3.5 h-3.5" />
							) : (
								<Download className="w-3.5 h-3.5" />
							)}
						</button>
						<button
							type="button"
							onClick={clearChat}
							aria-label="Clear conversation"
							className={`${btnBase} hover:!text-error hover:!border-error/20 hover:!bg-error/10 focus-ring`}
							title="Clear"
						>
							<Trash2 className="w-3.5 h-3.5" />
						</button>
					</div>
				)}
			</div>
		</header>
	);
}

// ponytail: wrap the toolbar in `memo` so SSE token flushes (which
// replace the messages array reference) don't re-render the entire
// toolbar — the toolbar reads `messages.length` (via `clearChat`/`share`)
// but doesn't render the messages themselves. The shell passes a stable
// `messagesLength: number` to keep the memo effective; the actual
// `messages: Message[]` reference is not in the toolbar's prop list.
export const MemoizedChatToolbar = memo(ChatToolbar);
