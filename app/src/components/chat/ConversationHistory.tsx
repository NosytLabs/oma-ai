"use client";

import {
	Download,
	MessageSquare,
	Pencil,
	Pin,
	PinOff,
	Plus,
	Search,
	Trash2,
	X,
} from "lucide-react";
import { useMemo, useState } from "react";
import type { ChatPersistenceStatus } from "@/app/chat/_hooks/useConversationHistory";
import type { ConversationThread } from "@/lib/chat-storage";

export interface ConversationHistoryProps {
	threads: ConversationThread[];
	activeThreadId: string;
	disabled: boolean;
	persistenceStatus: ChatPersistenceStatus;
	persistenceError: string | null;
	onNew: () => void;
	onSelect: (threadId: string) => void;
	onRename: (threadId: string, title: string) => void;
	onTogglePinned: (threadId: string) => void;
	onDelete: (threadId: string) => void;
	onExport: (threadId: string) => void;
	onClose?: () => void;
	autoFocusSearch?: boolean;
	className?: string;
}

function threadMatches(thread: ConversationThread, query: string): boolean {
	if (!query) return true;
	const searchable = [
		thread.title,
		thread.draft,
		...thread.messages.map((message) => message.content),
	]
		.join("\n")
		.toLocaleLowerCase();
	return searchable.includes(query);
}

function updatedLabel(timestamp: number): string {
	const date = new Date(timestamp);
	if (!Number.isFinite(date.getTime())) return "";
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: date.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
	}).format(date);
}

export function ConversationHistory({
	threads,
	activeThreadId,
	disabled,
	persistenceStatus,
	persistenceError,
	onNew,
	onSelect,
	onRename,
	onTogglePinned,
	onDelete,
	onExport,
	onClose,
	autoFocusSearch = false,
	className = "",
}: ConversationHistoryProps) {
	const [query, setQuery] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingTitle, setEditingTitle] = useState("");
	const normalizedQuery = query.trim().toLocaleLowerCase();
	const visibleThreads = useMemo(
		() => threads.filter((thread) => threadMatches(thread, normalizedQuery)),
		[normalizedQuery, threads],
	);

	const finishRename = (threadId: string) => {
		onRename(threadId, editingTitle);
		setEditingId(null);
	};

	return (
		<aside
			aria-label="Conversation history"
			className={`flex h-full min-h-0 w-full flex-col border-r border-border bg-void/95 ${className}`}
		>
			<div className="flex items-center justify-between gap-2 border-b border-border px-3 py-3">
				<div className="min-w-0">
					<h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-text">
						Chats
					</h2>
					<p className="mt-0.5 text-[10px] text-text-muted">
						{threads.length} {threads.length === 1 ? "conversation" : "conversations"}
					</p>
				</div>
				<div className="flex shrink-0 items-center gap-1">
					<button
						type="button"
						onClick={onNew}
						disabled={disabled}
						className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-accent/35 bg-accent/10 px-2.5 text-[11px] font-semibold text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
					>
						<Plus className="h-3.5 w-3.5" aria-hidden="true" />
						New chat
					</button>
					{onClose && <button type="button" onClick={onClose} aria-label="Close conversation history" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-text-muted hover:bg-surface-elevated hover:text-text focus-ring"><X className="h-4 w-4" aria-hidden="true" /></button>}
				</div>
			</div>

			<div className="p-3 pb-2">
				<label className="relative block">
					<span className="sr-only">Search chats</span>
					<Search
						className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted"
						aria-hidden="true"
					/>
					<input
						type="search"
						aria-label="Search chats"
						placeholder="Search chats"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						autoFocus={autoFocusSearch}
						className="h-9 w-full rounded-lg border border-border bg-surface/70 pl-8 pr-3 text-xs text-text outline-none placeholder:text-text-muted focus:border-accent/50 focus:ring-1 focus:ring-accent/30"
					/>
				</label>
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
				{visibleThreads.length === 0 ? (
					<div className="px-3 py-8 text-center text-xs text-text-muted">
						No conversations match “{query.trim()}”.
					</div>
				) : (
					<ul className="space-y-1" aria-label="Saved conversations">
						{visibleThreads.map((thread) => {
							const active = thread.id === activeThreadId;
							const editing = editingId === thread.id;
							return (
								<li
									key={thread.id}
									className={`group rounded-lg border transition-colors ${
										active
											? "border-accent/35 bg-accent/10"
											: "border-transparent hover:border-border hover:bg-surface/60"
									}`}
								>
									{editing ? (
										<div className="p-2">
											<input
												type="text"
												aria-label="Rename conversation"
												value={editingTitle}
												onChange={(event) => setEditingTitle(event.target.value)}
												onKeyDown={(event) => {
													if (event.key === "Enter") finishRename(thread.id);
													if (event.key === "Escape") setEditingId(null);
												}}
												onBlur={() => finishRename(thread.id)}
												autoFocus
												className="h-8 w-full rounded border border-accent/50 bg-void px-2 text-xs text-text outline-none ring-1 ring-accent/20"
											/>
										</div>
									) : (
										<>
											<button
												type="button"
												onClick={() => onSelect(thread.id)}
												disabled={disabled}
												aria-label={`Open ${thread.title}`}
												aria-current={active ? "page" : undefined}
												className="flex w-full min-w-0 items-start gap-2 px-2.5 pb-1 pt-2.5 text-left disabled:cursor-not-allowed disabled:opacity-50"
											>
												<MessageSquare
													className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${active ? "text-accent" : "text-text-muted"}`}
													aria-hidden="true"
												/>
												<span className="min-w-0 flex-1">
													<span className="block truncate text-xs font-medium text-text">
														{thread.title}
													</span>
													<span className="mt-1 flex items-center gap-1.5 text-[10px] text-text-muted">
														{thread.pinned && <Pin className="h-2.5 w-2.5" aria-label="Pinned" />}
														<span>{updatedLabel(thread.updatedAt)}</span>
														{thread.draft && <span className="text-warning/80">Draft</span>}
													</span>
												</span>
											</button>
											<div className="flex items-center justify-end gap-0.5 px-1.5 pb-1.5">
												<button
													type="button"
													disabled={disabled}
													onClick={() => {
														setEditingId(thread.id);
														setEditingTitle(thread.title);
													}}
													aria-label={`Rename ${thread.title}`}
													className="rounded p-1.5 text-text-muted hover:bg-white/5 hover:text-text disabled:cursor-not-allowed disabled:opacity-35"
												>
													<Pencil className="h-3 w-3" aria-hidden="true" />
												</button>
												<button
													type="button"
													disabled={disabled}
													onClick={() => onTogglePinned(thread.id)}
													aria-label={`${thread.pinned ? "Unpin" : "Pin"} ${thread.title}`}
													className="rounded p-1.5 text-text-muted hover:bg-white/5 hover:text-text disabled:cursor-not-allowed disabled:opacity-35"
												>
													{thread.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
												</button>
												<button
													type="button"
													disabled={disabled || thread.messages.length === 0}
													onClick={() => onExport(thread.id)}
													aria-label={`Export ${thread.title}`}
													className="rounded p-1.5 text-text-muted hover:bg-white/5 hover:text-text disabled:cursor-not-allowed disabled:opacity-35"
												>
													<Download className="h-3 w-3" aria-hidden="true" />
												</button>
												<button
													type="button"
													disabled={disabled}
													onClick={() => {
														if (
															window.confirm(
																`Delete “${thread.title}”? This removes its local history from this browser.`,
															)
														) {
															onDelete(thread.id);
														}
													}}
													aria-label={`Delete ${thread.title}`}
													className="rounded p-1.5 text-text-muted hover:bg-red-400/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-35"
												>
													<Trash2 className="h-3 w-3" aria-hidden="true" />
												</button>
											</div>
										</>
									)}
								</li>
							);
						})}
					</ul>
				)}
			</div>

			<div className="border-t border-border px-3 py-2.5 text-[10px] leading-relaxed text-text-muted">
				{persistenceStatus === "error" && persistenceError ? (
					<p role="alert" className="text-warning">
						{persistenceError}
					</p>
				) : (
					<p>Saved only in this browser on this device.</p>
				)}
			</div>
		</aside>
	);
}
