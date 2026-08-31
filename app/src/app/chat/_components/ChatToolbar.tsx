"use client";

import {
	AlertCircle,
	AlertTriangle,
	CheckCircle2,
	Coins,
	Columns2,
	Download,
	Upload,
	FileDown,
	FileText,
	FileJson,
	Keyboard,
	Settings2,
	Share2,
	Trash2,
	MessageSquarePlus,
	Bug,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { memo, useState, useRef, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Message } from "@/components/chat";
import { formatCreditsShort } from "@/components/chat/useBalance";
import { btnBase } from "@/components/playground/PlaygroundComponents";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import type { BalanceResponse } from "@/lib/api";

const LazyModelSelector = dynamic(
	() =>
		import("@/components/chat/ModelSelector").then(
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
	searching: boolean;
	isAuthenticated: boolean;
	balance: BalanceResponse | null;
	balanceDollars: number;
	isLowBalance: boolean;
	compareMode: boolean;
	setCompareMode: Dispatch<SetStateAction<boolean>>;
	shareStatus: "default" | "success" | "error";
	shareConversation: () => void;
	exportConversation: (format?: "json" | "txt" | "md") => void;
	importConversation?: (messages: Message[]) => void;
	newConversation?: () => void;
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
	* Three functional clusters, left → right:
	* 1. Input/mode — model selector + parameters + media-mode (Chat | Create) tabs.
	*    All three are decisions about *what kind of input this is*, so they live in
	*    one group. The media-mode toggle is no longer a separate floating cluster
	*    (see git history for the "orphan tabs at mobile" fix).
	* 2. (searching badge sits inside cluster 1 when web search is in flight)
	* 3. Stats bar (desktop / mobile variants), credit balance pill, then
	*    compare mode, share, shortcuts, export, clear.
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
	exportConversation,
	importConversation,
	newConversation,
	clearChat,
	messagesLength,
	deferredMessages,
	setShortcutsOpen,
	onAuthRequired,
}: ChatToolbarProps) {
	const isChat = variant === "chat";
	const messageCount = messagesLength;
	const toast = useToast();
	const [exportMenuOpen, setExportMenuOpen] = useState(false);
	const exportMenuRef = useRef<HTMLDivElement>(null);

	// Close export menu when clicking outside
	useEffect(() => {
		if (!exportMenuOpen) return;
		function handleClickOutside(e: MouseEvent) {
			if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
				setExportMenuOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [exportMenuOpen]);

	const creditsPill =
		isChat && isAuthenticated ? (
			balance ? (
				<Link
					href="/deposit"
					aria-label={`Credit balance: ${Math.round(parseFloat(balance.balanceCents))} credits. Click to add credits.`}
					data-state={isLowBalance ? "low" : "ok"}
					className={`${btnBase} shrink-0 data-[state=low]:!border-warning/40 data-[state=low]:!text-warning data-[state=low]:!bg-warning/10 min-h-9 min-w-9 sm:min-h-10 sm:min-w-10`}
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
					className={`${btnBase} shrink-0 opacity-60 min-h-9 min-w-9 sm:min-h-10 sm:min-w-10`}
					aria-label="Loading credit balance"
					title="Loading credits…"
				>
					<Coins className="h-3.5 w-3.5 shrink-0" />
					<span className="tabular-nums text-[10px] sm:text-[11px]">…</span>
				</span>
			)
		) : null;

	// Web search toggle moved into the composer input row (2026-08-01) —
	// it belongs next to the send action, not in the model/status toolbar.

	return (
		<header
			aria-label="Playground toolbar"
			className="z-20 flex min-h-14 min-w-0 flex-none flex-wrap items-center gap-x-1.5 gap-y-1.5 border-b border-border bg-void/95 px-4 py-1.5 sm:gap-x-3 sm:px-6 md:h-14 md:flex-nowrap md:px-6 md:py-0 lg:px-8"
		>
			{/* Left "input/mode" cluster — model + params + media-mode tabs.
			    All three are decisions about *what kind of input this is*,
			    so they live in one group. On mobile (<md) the cluster takes
			    its own row via `basis-full` so it never gets squashed by
			    the secondary actions. In Create mode the model selector
			    and PARAMS hide (Create studio picks its own model) but the
			    Chat | Create tabs stay so the user can switch back. */}
			<div className="flex min-w-0 max-w-full basis-full items-center gap-1.5 sm:gap-2 md:flex-1 md:basis-auto">
				<div className="min-w-0 max-w-[min(14rem,calc(100%-3rem))] flex-1 overflow-hidden sm:max-w-[220px] md:max-w-[260px]">
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
					className={`${btnBase} shrink-0 min-h-11 min-w-11 sm:min-h-10 sm:min-w-10 transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] ${paramsOpen ? "!bg-surface !text-success !border-success/30" : ""} focus-ring`}
					title="Toggle Parameters (Cmd+/)"
				>
					<Settings2 className="h-4 w-4" />
					<span className="hidden lg:inline text-[11px] font-semibold tracking-wider">
						PARAMS
					</span>
				</button>

				{/* Chat-only mode — no Create tab. The chat surface is text + multimodal LLM only. */}

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
			<div className="flex shrink-0 items-center gap-1 sm:gap-2 justify-self-end">
				<div className="hidden shrink-0 xl:block">
					<LazyStatsBar messages={deferredMessages} model={model} />
				</div>

				{creditsPill}

				<button
					type="button"
					onClick={() => setCompareMode(!compareMode)}
					aria-label="Compare models side-by-side"
					className={`${btnBase} max-sm:!hidden shrink-0 sm:inline-flex min-h-9 min-w-9 sm:min-h-10 sm:min-w-10 transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] ${compareMode ? "!bg-surface !text-success !border-success/30" : ""} focus-ring`}
					title="Compare models side-by-side"
					aria-pressed={compareMode}
				>
					<Columns2 className="h-4 w-4" />
					<span className="hidden xl:inline text-[11px] font-semibold tracking-wider">
						COMPARE
					</span>
				</button>

				<button
					type="button"
					onClick={shareConversation}
					disabled={shareStatus === "default" && messagesLength === 0}
					data-state={shareStatus}
					className={`${btnBase} max-md:!hidden shrink-0 focus-ring transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] data-[state=success]:border-success/30 data-[state=success]:bg-success/10 data-[state=success]:text-success md:inline-flex min-h-9 min-w-9 sm:min-h-10 sm:min-w-10`}
					title="Copy a link that opens this chat with the current model pre-selected"
					aria-label="SHARE — copy a link that opens this chat with the current model pre-selected"
				>
					{shareStatus === "success" ? (
						<CheckCircle2 className="h-4 w-4" />
					) : shareStatus === "error" ? (
						<AlertCircle className="h-4 w-4" />
					) : (
						<Share2 className="h-4 w-4" />
					)}
					<span className="hidden lg:inline text-[11px] font-semibold tracking-wider">
						SHARE
					</span>
				</button>

				<button
					type="button"
					onClick={() => setShortcutsOpen(true)}
					className={`${btnBase} max-sm:!hidden shrink-0 focus-ring transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] sm:inline-flex min-h-9 min-w-9 sm:min-h-10 sm:min-w-10`}
					title="Keyboard shortcuts (?)"
					aria-label="? — show keyboard shortcuts"
				>
					<Keyboard className="h-4 w-4" />
				</button>
				
				{newConversation && (
					<button
						type="button"
						onClick={newConversation}
						aria-label="New Conversation (Cmd/Ctrl+N)"
						className={`${btnBase} focus-ring transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] hover:!border-success/20 hover:!bg-success/10 hover:!text-success min-h-9 min-w-9 sm:min-h-10 sm:min-w-10`}
						title="New Conversation (Cmd/Ctrl+N)"
					>
						<MessageSquarePlus className="h-4 w-4" />
					</button>
				)}

				<button
					type="button"
					onClick={() => window.open('mailto:support@oma-ai.com?subject=OMA AI App Feedback', '_blank')}
					className={`${btnBase} max-sm:!hidden shrink-0 focus-ring transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] min-h-9 min-w-9 sm:inline-flex sm:min-h-10 sm:min-w-10`}
					title="Provide Feedback / Report Bug"
					aria-label="Provide Feedback"
				>
					<Bug className="h-4 w-4" />
				</button>

				<div className="flex shrink-0 items-center gap-1">
					{importConversation && (
						<label
							className={`${btnBase} max-sm:!hidden focus-ring cursor-pointer transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] min-h-9 min-w-9 sm:inline-flex sm:min-h-10 sm:min-w-10`}
							title="Import conversation (JSON, MD, TXT)"
						>
							<Upload className="h-4 w-4" />
							<input 
								type="file" 
								className="hidden" 
								accept=".json,.md,.txt" 
								onChange={async (e) => {
									const file = e.target.files?.[0];
									if (!file) return;
									try {
										const { parseImportedChat } = await import("@/lib/chat-export");
										const msgs = await parseImportedChat(file);
										importConversation(msgs);
									} catch (err: unknown) {
										const msg = err instanceof Error ? err.message : String(err);
										toast.error(msg || "Failed to import conversation");
									}
									e.target.value = "";
								}} 
							/>
						</label>
					)}
					{messageCount > 0 && variant === "chat" && (
						<>
							<div className="relative" ref={exportMenuRef}>
								<button
									type="button"
									onClick={() => setExportMenuOpen(!exportMenuOpen)}
									aria-label="Export conversation"
									className={`${btnBase} focus-ring transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] min-h-9 min-w-9 sm:min-h-10 sm:min-w-10 ${exportMenuOpen ? "bg-accent/10 text-accent border-accent/20" : ""}`}
									title="Export conversation"
								>
									<Download className="h-4 w-4" />
								</button>
								{exportMenuOpen && (
									<div className="absolute right-0 top-full mt-2 w-40 rounded-lg border border-border bg-surface p-1 shadow-lg z-[100] animate-in fade-in zoom-in duration-200">
										<button
											type="button"
											onClick={() => { exportConversation("json"); setExportMenuOpen(false); }}
											className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/5 focus-visible:outline-none focus-visible:bg-white/5 focus-visible:ring-2 focus-visible:ring-accent/50"
										>
											<FileJson className="h-4 w-4" /> JSON
										</button>
										<button
											type="button"
											onClick={() => { exportConversation("md"); setExportMenuOpen(false); }}
											className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/5 focus-visible:outline-none focus-visible:bg-white/5 focus-visible:ring-2 focus-visible:ring-accent/50"
										>
											<FileDown className="h-4 w-4" /> Markdown
										</button>
										<button
											type="button"
											onClick={() => { exportConversation("txt"); setExportMenuOpen(false); }}
											className="flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-white/5 focus-visible:outline-none focus-visible:bg-white/5 focus-visible:ring-2 focus-visible:ring-accent/50"
										>
											<FileText className="h-4 w-4" /> Text
										</button>
									</div>
								)}
							</div>
							<button
								type="button"
								onClick={clearChat}
								aria-label="Clear conversation and local history"
								className={`${btnBase} transition-[color,background-color,border-color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] hover:!border-error/20 hover:!bg-error/10 hover:!text-error focus-ring min-h-9 min-w-9 sm:min-h-10 sm:min-w-10`}
								title="Clear chat (also clears browser local history)"
							>
								<Trash2 className="h-4 w-4" />
							</button>
						</>
					)}
				</div>
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
