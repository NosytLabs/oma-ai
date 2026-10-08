"use client";

import {
	AlertCircle, AlertTriangle, BookOpen, CheckCircle2, Coins, Columns2,
	FileDown, FileJson, FileText, HelpCircle, History, Keyboard,
	Link2, MessageSquarePlus, MoreHorizontal, Settings2, Trash2, Upload,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { memo, useEffect, useId, useRef, useState } from "react";
import type { ChangeEvent, Dispatch, KeyboardEvent, SetStateAction } from "react";
import type { Message } from "@/components/chat";
import { formatCreditsShort } from "@/components/chat/useBalance";
import { btnBase } from "@/components/playground/PlaygroundComponents";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import type { BalanceResponse } from "@/lib/api";
import type { ModelLinkStatus } from "../_hooks/useModelLinkShare";

const LazyModelSelector = dynamic(
	() => import("@/components/chat/ModelSelector").then((mod) => mod.ModelSelector),
	{ ssr: false, loading: () => <Skeleton className="h-9 w-full max-w-52" /> },
);
const LazyStatsBar = dynamic(
	() => import("@/components/playground/PlaygroundComponents").then((mod) => mod.StatsBar),
	{ ssr: false, loading: () => null },
);
const menuItemClass = "flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-text-secondary hover:bg-surface-elevated hover:text-text-bright focus-visible:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-35";
const iconClass = "h-4 w-4 shrink-0";
const toolbarButtonClass = `${btnBase} min-h-11 min-w-11 shrink-0 disabled:cursor-not-allowed disabled:opacity-35`;

interface ChatToolbarProps {
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
	modelLinkStatus: ModelLinkStatus;
	copyModelLink: () => void;
	exportConversation: (format?: "json" | "txt" | "md") => void;
	importConversation?: (messages: Message[]) => void;
	newConversation?: () => void;
	clearChat: () => void;
	messagesLength: number;
	deferredMessages: Message[];
	setShortcutsOpen: Dispatch<SetStateAction<boolean>>;
	loading?: boolean;
	historyOpen?: boolean;
	onToggleHistory?: () => void;
}

export function ChatToolbar({
	model, setModel, paramsOpen, setParamsOpen, searching,
	isAuthenticated, balance, balanceDollars, isLowBalance, compareMode,
	setCompareMode, modelLinkStatus, copyModelLink, exportConversation,
	importConversation, newConversation, clearChat, messagesLength,
	deferredMessages, setShortcutsOpen, loading = false, historyOpen = false,
	onToggleHistory,
}: ChatToolbarProps) {
	const toast = useToast();
	const [moreMenuOpen, setMoreMenuOpen] = useState(false);
	const menuId = useId();
	const moreMenuRef = useRef<HTMLDivElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const importRef = useRef<HTMLInputElement>(null);
	const loadingRef = useRef(loading);
	loadingRef.current = loading;

	useEffect(() => {
		if (!moreMenuOpen) return;
		menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')?.focus();
		function handleOutsidePointer(event: PointerEvent) {
			if (!moreMenuRef.current?.contains(event.target as Node)) setMoreMenuOpen(false);
		}
		document.addEventListener("pointerdown", handleOutsidePointer);
		return () => document.removeEventListener("pointerdown", handleOutsidePointer);
	}, [moreMenuOpen]);

	function closeMoreMenu() {
		setMoreMenuOpen(false);
		triggerRef.current?.focus();
	}

	function runMenuAction(action: () => void) {
		closeMoreMenu();
		action();
	}

	function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.key === "Escape") {
			event.preventDefault();
			closeMoreMenu();
			return;
		}
		if (event.key === "Tab") {
			setMoreMenuOpen(false);
			return;
		}
		if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
		event.preventDefault();
		const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)') ?? []);
		if (!items.length) return;
		const current = items.indexOf(document.activeElement as HTMLElement);
		const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1
			: (current + (event.key === "ArrowUp" ? -1 : 1) + items.length) % items.length;
		items[next].focus();
	}

	async function handleImport(event: ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		event.target.value = "";
		if (!file || !importConversation || loadingRef.current) return;
		try {
			const { parseImportedChat } = await import("@/lib/chat-export");
			const messages = await parseImportedChat(file);
			if (loadingRef.current) {
				toast.error("Stop the current response before importing a conversation.");
				return;
			}
			importConversation(messages);
		} catch (error: unknown) {
			toast.error(error instanceof Error ? error.message : "Failed to import conversation");
		}
	}

	return (
		<header aria-label="Chat toolbar" className="gutter-page z-20 flex min-h-14 min-w-0 flex-none items-center gap-1.5 border-b border-border bg-void/95 py-1 sm:gap-3">
			{onToggleHistory && (
				<button type="button" onClick={onToggleHistory} aria-label="Conversation history" aria-expanded={historyOpen} className={toolbarButtonClass} title="Conversation history">
					<History className={iconClass} aria-hidden="true" />
				</button>
			)}
			<div className="flex min-w-0 flex-1 items-center gap-2">
				<div className="min-w-0 w-full max-w-72">
					<LazyModelSelector model={model} setModel={setModel} isAuthenticated={isAuthenticated} />
				</div>
				{searching && (
					<div className="hidden shrink-0 items-center gap-1.5 text-xs text-accent sm:flex" role="status" aria-live="polite" aria-label="Searching the web">
						<span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" aria-hidden="true" />Searching
					</div>
				)}
			</div>
			{messagesLength > 0 && <div className="hidden shrink-0 xl:block"><LazyStatsBar messages={deferredMessages} model={model} /></div>}
			{isAuthenticated && (
				balance ? (
					<Link href="/deposit" aria-label={`Credit balance: ${Math.round(parseFloat(balance.balanceCents))} credits. Add credits.`} data-state={isLowBalance ? "low" : "ok"} className={`${toolbarButtonClass} hidden sm:inline-flex data-[state=low]:!border-warning/40 data-[state=low]:!bg-warning/10 data-[state=low]:!text-warning`} title="Add credits">
						{isLowBalance ? <AlertTriangle className={iconClass} /> : <Coins className={iconClass} />}<span className="text-xs tabular-nums">{formatCreditsShort(balanceDollars)}</span>
					</Link>
				) : <span className={`${toolbarButtonClass} hidden opacity-60 sm:inline-flex`} aria-label="Loading credit balance"><Coins className={iconClass} /><span>…</span></span>
			)}
			{newConversation && (
				<button type="button" onClick={newConversation} disabled={loading} aria-label="New conversation" title={loading ? "Stop the response before starting a new conversation" : "New conversation"} className={toolbarButtonClass}>
					<MessageSquarePlus className={iconClass} aria-hidden="true" /><span className="hidden text-xs sm:inline">New chat</span>
				</button>
			)}
			<div ref={moreMenuRef} className="relative shrink-0">
				<button ref={triggerRef} type="button" onClick={() => setMoreMenuOpen((open) => !open)} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setMoreMenuOpen(true); } }} aria-label="More chat actions" aria-expanded={moreMenuOpen} aria-haspopup="menu" aria-controls={moreMenuOpen ? menuId : undefined} className={toolbarButtonClass} title="More chat actions">
					<MoreHorizontal className={iconClass} aria-hidden="true" />
				</button>
				{moreMenuOpen && (
					<div id={menuId} ref={menuRef} role="menu" aria-label="More chat actions" onKeyDown={handleMenuKeyDown} className="absolute right-0 top-full z-[100] mt-2 max-h-[calc(100dvh-8rem-var(--consent-banner-height,0px))] w-64 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-2xl shadow-black/40">
						<button type="button" role="menuitem" onClick={() => runMenuAction(() => setParamsOpen(!paramsOpen))} className={menuItemClass}><Settings2 className={iconClass} />{paramsOpen ? "Hide parameters" : "Parameters"}</button>
						<button type="button" role="menuitem" onClick={() => runMenuAction(() => setCompareMode(!compareMode))} disabled={loading} className={menuItemClass}><Columns2 className={iconClass} />{compareMode ? "Stop comparing models" : "Compare models"}</button>
						<button type="button" role="menuitem" onClick={() => runMenuAction(() => setShortcutsOpen(true))} className={menuItemClass}><Keyboard className={iconClass} />Keyboard shortcuts</button>
						{isAuthenticated && <Link href="/deposit" role="menuitem" onClick={closeMoreMenu} className={`${menuItemClass} sm:hidden`}><Coins className={iconClass} />{balance ? `${formatCreditsShort(balanceDollars)} · Add credits` : "Add credits"}</Link>}
						<div role="separator" className="my-1 border-t border-border" />
						<button type="button" role="menuitem" onClick={() => runMenuAction(copyModelLink)} className={menuItemClass}>
							{modelLinkStatus === "success" ? <CheckCircle2 className={iconClass} /> : modelLinkStatus === "error" ? <AlertCircle className={iconClass} /> : <Link2 className={iconClass} />}{modelLinkStatus === "success" ? "Model link copied" : modelLinkStatus === "error" ? "Copy model link failed" : "Copy model link"}
						</button>
						{importConversation && <button type="button" role="menuitem" disabled={loading} onClick={() => runMenuAction(() => importRef.current?.click())} className={menuItemClass}><Upload className={iconClass} />Import conversation</button>}
						{messagesLength > 0 && <>
							<button type="button" role="menuitem" onClick={() => runMenuAction(() => exportConversation("json"))} className={menuItemClass}><FileJson className={iconClass} />Export JSON</button>
							<button type="button" role="menuitem" onClick={() => runMenuAction(() => exportConversation("md"))} className={menuItemClass}><FileDown className={iconClass} />Export Markdown</button>
							<button type="button" role="menuitem" onClick={() => runMenuAction(() => exportConversation("txt"))} className={menuItemClass}><FileText className={iconClass} />Export text</button>
						</>}
						<button type="button" role="menuitem" onClick={() => runMenuAction(clearChat)} disabled={messagesLength === 0 || loading} className={`${menuItemClass} !text-red-300 hover:bg-red-400/10`}><Trash2 className={iconClass} />Clear conversation</button>
						<div role="separator" className="my-1 border-t border-border" />
						<Link href="/models" role="menuitem" onClick={closeMoreMenu} className={menuItemClass}><Columns2 className={iconClass} />Browse models</Link>
						<Link href="/getting-started" role="menuitem" onClick={closeMoreMenu} className={menuItemClass}><BookOpen className={iconClass} />Getting started</Link>
						<Link href="/faq" role="menuitem" onClick={closeMoreMenu} className={menuItemClass}><HelpCircle className={iconClass} />FAQ</Link>
					</div>
				)}
			</div>
			{importConversation && <input ref={importRef} type="file" className="hidden" accept=".json,.md,.txt" aria-label="Import conversation file" onChange={handleImport} />}
		</header>
	);
}

export const MemoizedChatToolbar = memo(ChatToolbar);
