"use client";

import { Clock, Fingerprint, Loader2, LogOut, Monitor, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Session } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

interface SessionsSectionProps {
	sessions: Session[];
	/** Ends the current browser session (parent signOut). */
	onSignOutCurrent?: () => Promise<void> | void;
	/** Revoke a remote session by id (parent invalidates the list). */
	onRevokeSession?: (id: string) => Promise<void> | void;
	/** Revoke every session except the current device. */
	onRevokeOthers?: () => Promise<void> | void;
}

function getDeviceName(userAgent: string | null): string {
	if (!userAgent) return "Unknown device";
	let device = "Browser";
	if (/Edg\//i.test(userAgent)) device = "Microsoft Edge";
	else if (/Chrome\//i.test(userAgent) && !/Edg\//i.test(userAgent))
		device = "Chrome";
	else if (/Firefox\//i.test(userAgent)) device = "Firefox";
	else if (/Safari\//i.test(userAgent) && !/Chrome\//i.test(userAgent))
		device = "Safari";
	if (/Mobile|Android|iPhone/i.test(userAgent)) device = `${device} (mobile)`;
	return device;
}

export function SessionsSection({
	sessions,
	onSignOutCurrent,
	onRevokeSession,
	onRevokeOthers,
}: SessionsSectionProps) {
	const [signingOut, setSigningOut] = useState(false);
	const [revokingId, setRevokingId] = useState<string | null>(null);
	const [revokingOthers, setRevokingOthers] = useState(false);

	const otherSessions = sessions.filter((s) => !s.isCurrent);

	const handleSignOut = async () => {
		if (!onSignOutCurrent || signingOut) return;
		setSigningOut(true);
		try {
			await onSignOutCurrent();
		} finally {
			setSigningOut(false);
		}
	};

	const handleRevoke = async (id: string) => {
		if (!onRevokeSession || revokingId) return;
		setRevokingId(id);
		try {
			await onRevokeSession(id);
		} finally {
			setRevokingId(null);
		}
	};

	const handleRevokeOthers = async () => {
		if (!onRevokeOthers || revokingOthers || otherSessions.length === 0) return;
		setRevokingOthers(true);
		try {
			await onRevokeOthers();
		} finally {
			setRevokingOthers(false);
		}
	};

	return (
		<div>
			<div className="mb-4 flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="text-lg font-semibold text-text-bright">
						Active sessions
					</h2>
					<p className="mt-1 text-sm text-text-muted">
						Devices that are currently signed in to your account.
					</p>
				</div>
				{otherSessions.length > 0 && onRevokeOthers && (
					<button
						type="button"
						onClick={handleRevokeOthers}
						disabled={revokingOthers}
						className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-danger/30 bg-danger/10 px-3 py-1.5 text-xs font-semibold text-danger transition-[background-color,border-color,box-shadow,color,transform] duration-200 hover:border-danger/50 hover:bg-danger/20 active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger"
					>
						{revokingOthers ? (
							<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
						) : (
							<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
						)}
						{revokingOthers
							? "Revoking…"
							: `Sign out ${otherSessions.length} other device${otherSessions.length === 1 ? "" : "s"}`}
					</button>
				)}
			</div>

			<div className="mt-6 space-y-2">
				{sessions.length === 0 ? (
					<div className="rounded-[var(--radius-md)] border border-dashed border-border px-4 py-8 text-center bg-surface/30">
						<p className="text-sm font-semibold text-text-muted">No active sessions.</p>
						<p className="mt-1 text-xs text-text-muted">
							You&apos;re signed in — refresh if this looks wrong.
						</p>
					</div>
				) : (
					sessions.map((session) => (
						<div
							key={session.id}
							className="group flex flex-col gap-3 rounded-[var(--radius-md)] border border-border bg-surface/30 px-5 py-4 sm:flex-row sm:items-center transition-colors hover:border-accent/30 hover:bg-surface/50"
						>
							<div className="flex min-w-0 flex-1 items-center gap-4">
								<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-accent/20 bg-accent/5 transition-colors group-hover:border-accent/40 group-hover:bg-accent/10">
									{session.isCurrent ? (
										<Monitor className="h-5 w-5 text-accent drop-shadow-[0_0_8px_var(--color-accent)]" aria-hidden="true" />
									) : (
										<Fingerprint
											className="h-5 w-5 text-text-muted transition-colors group-hover:text-text-secondary"
											aria-hidden="true"
										/>
									)}
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<span className="text-sm font-semibold text-text-bright">
											{getDeviceName(session.userAgent)}
										</span>
										{session.isCurrent && (
											<span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider text-success">
												This device
											</span>
										)}
									</div>
									<div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
										{session.ipAddress && (
											<span className="font-mono">{session.ipAddress}</span>
										)}
										<span className="flex items-center gap-1">
											<Clock className="h-3 w-3" aria-hidden="true" />
											Signed in {formatDateTime(session.createdAt)}
										</span>
									</div>
								</div>
							</div>
							{session.isCurrent && onSignOutCurrent ? (
								<button
									type="button"
									onClick={handleSignOut}
									disabled={signingOut}
									className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-surface px-4 py-2 text-xs font-semibold text-text-secondary transition-[background-color,border-color,box-shadow,color,transform] duration-200 hover:border-error/40 hover:text-error hover:bg-error/10 active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
								>
									{signingOut ? (
										<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
									) : (
										<LogOut className="h-3.5 w-3.5" aria-hidden="true" />
									)}
									{signingOut ? "Signing out…" : "Sign out"}
								</button>
							) : !session.isCurrent && onRevokeSession ? (
								<button
									type="button"
									onClick={() => handleRevoke(session.id)}
									disabled={revokingId === session.id}
									className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-border bg-surface px-4 py-2 text-xs font-semibold text-text-secondary transition-[background-color,border-color,box-shadow,color,transform] duration-200 hover:border-error/40 hover:text-error hover:bg-error/10 active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
								>
									{revokingId === session.id ? (
										<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
									) : (
										<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
									)}
									{revokingId === session.id ? "Revoking…" : "Revoke"}
								</button>
							) : null}
						</div>
					))
				)}
			</div>
			<p className="mt-5 text-[11px] leading-relaxed text-text-muted border-t border-border/50 pt-4">
				Revoking a remote session signs that device out immediately. Use{" "}
				<span className="font-semibold text-text-secondary">Sign out</span> on this
				device to end the current browser session.
			</p>
		</div>
	);
}
