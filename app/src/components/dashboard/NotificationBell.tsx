"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import {
	ArrowUpRight,
	Bell,
	BellOff,
	CheckCheck,
	Inbox,
	X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { formatTime, formatUsd } from "@/lib/utils";
import { depositStatusLabel } from "@/lib/deposit-status";
import { useAuth } from "@/lib/hooks/useAuth";

type Notification = {
	id: string;
	depositId: string;
	type: string;
	status: string;
	amountUsd: string | null;
	creditsIssued: string | null;
	txHash: string | null;
	method: string | null;
	createdAt: string;
	notifiedAt: string | null;
};

const STATUS_COLOR: Record<string, string> = {
	completed: "text-success",
	pending: "text-warning",
	settling: "text-warning",
	failed: "text-error",
	expired: "text-text-muted",
	refunded: "text-text-muted",
};

interface NotificationBellProps {
	/** Optional className to position the bell (e.g. relative wrappers). */
	className?: string;
}

/**
	* Bell-icon dropdown that surfaces the user's deposit/payment notifications.
	* Pulls from `api.deposit.getNotifications()` with a 60s refetch so a fresh
	* deposit (or status change) shows up without a manual refresh.
	*
	* Designed to be slotted into any header — passes no position props; the
	* parent is responsible for the relative wrapper if needed.
	*/
export function NotificationBell({ className = "" }: NotificationBellProps) {
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);
	const queryClient = useQueryClient();
	const router = useRouter();
	const { user, isReady, isAuthenticated, isDemo } = useAuth();
	const accountId = user?.id ?? "";
	const enabled = isReady && isAuthenticated && !isDemo && Boolean(accountId);

	const { data, isLoading, isError, isFetching, refetch } = useQuery({
		queryKey: ["notifications", accountId],
		queryFn: ({ signal }) => api.deposit.getNotifications(accountId, signal),
		enabled,
		staleTime: 60_000,
		refetchInterval: 60_000,
	});

	const markRead = useMutation({
		mutationFn: ({ notificationId, ownerId }: { notificationId: string; ownerId: string }) =>
			api.deposit.markNotificationRead(notificationId, ownerId),
		onSuccess: (_data, { ownerId }) => {
			void queryClient.invalidateQueries({ queryKey: ["notifications", ownerId] });
		},
	});

	const notifications: Notification[] =
		(data as { notifications?: Notification[] })?.notifications ?? [];
	const recent = notifications.slice(0, 10);
	// Read state is stored on this device, separately for each account.
	const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
	const unreadCount = recent.filter((n) => {
		if (n.notifiedAt) return false; // already acknowledged by user
		return new Date(n.createdAt).getTime() > oneDayAgo;
	}).length;

	// Close on click outside + Escape
	useEffect(() => {
		if (!open) return;
		const onDown = (e: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setOpen(false);
			}
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onDown);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDown);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	const handleToggle = useCallback(() => setOpen((o) => !o), []);
	if (!enabled) return null;

	return (
		<div ref={containerRef} className={`relative ${className}`}>
			<button
				type="button"
				onClick={handleToggle}
				aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} new)` : ""}`}
				aria-expanded={open}
				aria-haspopup="dialog"
				className="relative flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface text-text-muted transition-colors duration-200 ease-out hover:border-accent/40 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
			>
				<Bell className="h-4 w-4" aria-hidden="true" />
				<AnimatePresence>
					{unreadCount > 0 && (
						<m.span
							key="badge"
							aria-hidden="true"
							initial={{ opacity: 0, scale: 0.85, x: 4, y: -4 }}
							animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
							exit={{ opacity: 0, scale: 0.85, x: 4, y: -4 }}
							transition={{ ...springs.magnet, delay: 0.05 }}
							className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-void"
						>
							{unreadCount > 9 ? "9+" : unreadCount}
						</m.span>
					)}
				</AnimatePresence>
				</button>

			<AnimatePresence>
				{open && (
					<m.div
						// Origin-aware open: scale + slide from the bell, fade + blur
						// for crisp entrance. "Toggle menu" pattern from
						// transitions.dev — opens with origin, closes by collapsing
						// back to origin so it feels anchored to the trigger.
						initial={{ opacity: 0, scale: 0.96, y: -6, filter: "blur(4px)" }}
						animate={{ opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }}
						exit={{ opacity: 0, scale: 0.96, y: -6, filter: "blur(4px)" }}
						transition={{ ...springs.toast, mass: 0.9 }}
						style={{ transformOrigin: "top right" }}
						role="dialog"
						aria-label="Notifications"
						className="absolute left-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-[var(--radius-lg)] border border-border bg-panel p-2 shadow-2xl sm:left-auto sm:right-0"
					>
						<div className="mb-1 flex items-center justify-between px-2 py-1.5">
							<span className="text-[11px] font-semibold uppercase tracking-widest text-text-muted">
								Notifications
							</span>
							<button
								type="button"
								onClick={() => setOpen(false)}
								aria-label="Close notifications"
								className="rounded-[var(--radius-sm)] p-1 text-text-muted hover:bg-surface hover:text-text"
							>
								<X className="h-3 w-3" />
							</button>
						</div>

						<div className="max-h-96 overflow-y-auto">
							<AnimatePresence mode="wait" initial={false}>
								{isLoading ? (
									<m.div
										key="loading"
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
										className="flex items-center gap-2 px-2 py-4 text-xs text-text-muted"
									>
										<span className="inline-block h-2 w-2 rounded-full bg-text-muted animate-pulse" />
										Loading…
									</m.div>
								) : isError ? (
									<div role="alert" className="px-2 py-4 text-sm text-text-secondary">
										<p>Payment updates could not load.</p>
										<button type="button" aria-label="Retry notifications" aria-busy={isFetching} disabled={isFetching} onClick={() => void refetch()} className="mt-2 min-h-11 rounded-md border border-border px-3 text-accent disabled:opacity-50">{isFetching ? "Retrying…" : "Retry notifications"}</button>
									</div>
								) : recent.length === 0 ? (
									<m.div
										key="empty"
										initial={{ opacity: 0, scale: 0.96 }}
										animate={{ opacity: 1, scale: 1 }}
										exit={{ opacity: 0, scale: 0.96 }}
										transition={{ ...springs.magnet }}
										className="flex flex-col items-center gap-2 px-2 py-6 text-center"
									>
										<div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text-muted">
											<BellOff className="h-4 w-4" aria-hidden="true" />
										</div>
										<p className="text-sm text-text-secondary">
											No notifications
										</p>
										<p className="text-[11px] text-text-muted">
										Recent deposit updates will show up here.
										</p>
									</m.div>
								) : (
									<m.div
										key="list"
										initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
										animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
										exit={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
										transition={{ ...springs.magnet }}
									>
										{recent.map((n) => (
											<NotificationRow
												key={n.id}
												n={n}
												onActivate={(id, href) => {
													markRead.mutate({ notificationId: id, ownerId: accountId });
													setOpen(false);
													if (href) router.push(href);
												}}
											/>
										))}
									</m.div>
								)}
							</AnimatePresence>
						</div>

						<div className="mt-1 flex items-center justify-between border-t border-border px-2 py-1.5 text-[11px]">
							<Link
								href="/deposit"
								onClick={() => setOpen(false)}
								className="inline-flex items-center gap-1 text-text-muted transition-colors duration-200 ease-out hover:text-text"
							>
								<CheckCheck className="h-3 w-3" aria-hidden="true" />
								View all
							</Link>
							<Link
								href="/deposit"
								onClick={() => setOpen(false)}
								className="inline-flex items-center gap-1 text-accent transition-colors duration-200 ease-out hover:text-accent/80"
							>
								New deposit
								<ArrowUpRight className="h-3 w-3" aria-hidden="true" />
							</Link>
						</div>
					</m.div>
				)}
			</AnimatePresence>
		</div>
	);
}

function NotificationRow({
	n,
	onActivate,
}: {
	n: Notification;
	onActivate: (id: string, href?: string) => void;
}) {
	const statusColor = STATUS_COLOR[n.status] ?? "text-text-muted";
	const statusLabel = depositStatusLabel(n.status);
	const amountUsd = n.amountUsd == null ? NaN : Number(n.amountUsd);
	const amount = Number.isFinite(amountUsd) ? formatUsd(amountUsd) : null;
	// Notifications derived from deposits route to the credits history page
	// (same destination as the existing "View all" link). Other notification
	// types can override `targetHref` later.
	const targetHref = n.type === "deposit" ? "/deposit" : undefined;
	const handleClick = () => onActivate(n.id, targetHref);
	const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			handleClick();
		}
	};

	return (
		<div
			role="button"
			tabIndex={0}
			onClick={handleClick}
			onKeyDown={handleKeyDown}
			aria-label={`${n.type} notification, status ${statusLabel}. Activate to view.`}
			className="group flex cursor-pointer items-start gap-2 rounded-[var(--radius-md)] px-2 py-2 transition-colors duration-200 ease-out hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
		>
			<div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-border bg-void text-text-muted">
				<Inbox className="h-3 w-3" aria-hidden="true" />
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex items-center justify-between gap-2">
					<span className="truncate text-xs font-semibold text-text-bright capitalize">
						{n.type}
					</span>
					<span className={`text-[10px] font-medium ${statusColor}`}>
						{statusLabel}
					</span>
				</div>
				<div className="mt-0.5 flex items-center gap-2 text-[10px] text-text-muted">
					{amount && (
						<span className="font-mono text-text-secondary">{amount}</span>
					)}
					<span className="truncate">{n.method ?? "—"}</span>
					<span className="ml-auto shrink-0">{formatTime(n.createdAt)}</span>
				</div>
			</div>
		</div>
	);
}
