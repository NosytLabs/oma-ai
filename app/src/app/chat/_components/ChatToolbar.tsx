"use client";

import {
	AlertCircle,
	AlertTriangle,
	CheckCircle2,
	Coins,
	Columns2,
	FileDown,
	FileJson,
	FileText,
	Keyboard,
	MessageSquarePlus,
	MoreHorizontal,
	Settings2,
	Share2,
	Trash2,
	Upload,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { memo, useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Message } from "@/components/chat";
import { formatCreditsShort } from "@/components/chat/useBalance";
import { btnBase } from "@/components/playground/PlaygroundComponents";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import type { BalanceResponse } from "@/lib/api";

const LazyModelSelector = dynamic(
	() => import("@/components/chat/ModelSelector").then((mod) => mod.ModelSelector),
	{ ssr: false, loading: () => <Skeleton className="h-8 w-40" /> },
);

const LazyStatsBar = dynamic(
	() => import("@/components/playground/PlaygroundComponents").then((mod) => mod.StatsBar),
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
	messagesLength: number;
	deferredMessages: Message[];
	setShortcutsOpen: Dispatch<SetStateAction<boolean>>;
}

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
}: ChatToolbarProps) {
	const isChat = variant === "chat";
	const messageCount = messagesLength;
	const toast = useToast();
	const [moreMenuOpen, setMoreMenuOpen] = useState(false);
	const moreMenuRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!moreMenuOpen) return;
		function handleClickOutside(event: MouseEvent) {
			if (!moreMenuRef.current?.contains(event.target as Node)) {
				setMoreMenuOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, [moreMenuOpen]);

	const closeMoreMenu = () => setMoreMenuOpen(false);
	const creditsPill =
		isChat && isAuthenticated ? (
			balance ? (
				<Link
					href="/deposit"
					aria-label={`Credit balance: ${Math.round(parseFloat(balance.balanceCents))} credits. Click to add credits.`}
					data-state={isLowBalance ? "low" : "ok"}
					className={`${btnBase} min-h-9 min-w-9 shrink-0 sm:min-h-10 sm:min-w-10 data-[state=low]:!border-warning/40 data-[state=low]:!bg-warning/10 data-[state=low]:!text-warning`}
					title="Credit balance — click to add credits"
				>
					{isLowBalance ? <AlertTriangle className="h-3.5 w-3.5" /> : <Coins className="h-3.5 w-3.5" />}
					<span className="tabular-nums text-[10px] sm:text-[11px]">{formatCreditsShort(balanceDollars)}</span>
				</Link>
			) : (
				<span className={`${btnBase} min-h-9 min-w-9 shrink-0 opacity-60 sm:min-h-10 sm:min-w-10`} aria-label="Loading credit balance" title="Loading credits…">
					<Coins className="h-3.5 w-3.5" />
					<span className="tabular-nums text-[10px] sm:text-[11px]">…</span>
				</span>
			)
		) : null;

	return (
		<header aria-label="Playground toolbar" className="z-20 flex min-h-14 min-w-0 flex-none flex-wrap items-center gap-x-1.5 gap-y-1.5 border-b border-border bg-void/95 px-4 py-1.5 sm:gap-x-3 sm:px-6 md:h-14 md:flex-nowrap md:px-6 md:py-0 lg:px-8">
			<div className="flex min-w-0 max-w-full items-center gap-1.5 sm:gap-2 md:flex-1">
				<div className="min-w-0 max-w-[min(14rem,calc(100%-3rem))] overflow-visible sm:max-w-[220px] md:max-w-[260px]">
					<LazyModelSelector model={model} setModel={setModel} isAuthenticated={isAuthenticated} />
				</div>
				{searching && (
					<div className="flex shrink-0 items-center gap-1.5 border border-accent/20 bg-accent/10 px-2 py-1.5 text-[10px] uppercase tracking-widest text-accent" role="status" aria-live="polite" aria-label="Searching the web">
						<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
						<span>SEARCH</span>
					</div>
				)}
			</div>

			<div
				className={`ml-auto flex shrink-0 items-center justify-end gap-1 sm:gap-2 ${
					messageCount === 0 && !creditsPill ? "hidden" : ""
				}`}
			>
				{messageCount > 0 && (
					<div className="hidden shrink-0 xl:block">
						<LazyStatsBar messages={deferredMessages} model={model} />
					</div>
				)}
				{creditsPill}
				<div
					ref={moreMenuRef}
					className={`relative ${messageCount === 0 ? "hidden" : ""}`}
				>
					<button type="button" onClick={() => setMoreMenuOpen((open) => !open)} aria-label="More chat actions" aria-expanded={moreMenuOpen} aria-haspopup="menu" className={`${btnBase} min-h-9 min-w-9 shrink-0 sm:min-h-10 sm:min-w-10 ${moreMenuOpen ? "!border-success/30 !bg-surface !text-success" : ""}`} title="More chat actions">
						<MoreHorizontal className="h-4 w-4" aria-hidden="true" />
						<span className="hidden text-[11px] font-semibold tracking-wider sm:inline">MORE</span>
					</button>
					{moreMenuOpen && (
						<div role="menu" aria-label="More chat actions" className="absolute right-0 top-full z-[100] mt-2 w-56 rounded-xl border border-border bg-surface p-1.5 shadow-2xl shadow-black/40">
							<button type="button" role="menuitem" onClick={() => { setParamsOpen(!paramsOpen); closeMoreMenu(); }} aria-pressed={paramsOpen} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-white/70 hover:bg-white/5 hover:text-white"><Settings2 className="h-3.5 w-3.5" /> Parameters</button>
							<button type="button" role="menuitem" onClick={() => { setCompareMode(!compareMode); closeMoreMenu(); }} aria-pressed={compareMode} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-white/70 hover:bg-white/5 hover:text-white"><Columns2 className="h-3.5 w-3.5" /> Compare models</button>
							<button type="button" role="menuitem" onClick={() => { setShortcutsOpen(true); closeMoreMenu(); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-white/70 hover:bg-white/5 hover:text-white"><Keyboard className="h-3.5 w-3.5" /> Keyboard shortcuts</button>
							{newConversation && <button type="button" role="menuitem" onClick={() => { newConversation(); closeMoreMenu(); }} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-white/70 hover:bg-white/5 hover:text-white"><MessageSquarePlus className="h-3.5 w-3.5" /> New conversation</button>}
							<div className="my-1 border-t border-border" />
							<button type="button" role="menuitem" onClick={() => { shareConversation(); closeMoreMenu(); }} disabled={shareStatus === "default" && messagesLength === 0} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-white/70 hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-35">
								{shareStatus === "success" ? <CheckCircle2 className="h-3.5 w-3.5" /> : shareStatus === "error" ? <AlertCircle className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />} {shareStatus === "success" ? "Link copied" : "Share conversation"}
							</button>
							{importConversation && (
								<label role="menuitem" className="flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-white/70 hover:bg-white/5 hover:text-white">
									<Upload className="h-3.5 w-3.5" /> Import conversation
									<input type="file" className="hidden" accept=".json,.md,.txt" onChange={async (event) => {
										const file = event.target.files?.[0];
										if (!file) return;
										try {
											const { parseImportedChat } = await import("@/lib/chat-export");
											importConversation(await parseImportedChat(file));
										} catch (error: unknown) {
											toast.error(error instanceof Error ? error.message : "Failed to import conversation");
										}
										event.target.value = "";
										closeMoreMenu();
									}}
									/>
								</label>
							)}
							{isChat && messageCount > 0 && (
								<div className="flex items-center gap-1 px-2.5 py-1.5">
									<span className="mr-auto text-[10px] uppercase tracking-widest text-white/35">Export</span>
									<button type="button" onClick={() => { exportConversation("json"); closeMoreMenu(); }} className="rounded px-1.5 py-1 text-[10px] text-white/60 hover:bg-white/5 hover:text-white" title="Export JSON"><FileJson className="mr-0.5 inline h-3 w-3" />JSON</button>
									<button type="button" onClick={() => { exportConversation("md"); closeMoreMenu(); }} className="rounded px-1.5 py-1 text-[10px] text-white/60 hover:bg-white/5 hover:text-white" title="Export Markdown"><FileDown className="mr-0.5 inline h-3 w-3" />MD</button>
									<button type="button" onClick={() => { exportConversation("txt"); closeMoreMenu(); }} className="rounded px-1.5 py-1 text-[10px] text-white/60 hover:bg-white/5 hover:text-white" title="Export text"><FileText className="mr-0.5 inline h-3 w-3" />TXT</button>
								</div>
							)}
							<button type="button" role="menuitem" onClick={() => { clearChat(); closeMoreMenu(); }} disabled={messageCount === 0} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] text-red-300/70 hover:bg-red-400/10 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-35"><Trash2 className="h-3.5 w-3.5" /> Clear conversation</button>
						</div>
					)}
				</div>
			</div>
		</header>
	);
}

export const MemoizedChatToolbar = memo(ChatToolbar);
