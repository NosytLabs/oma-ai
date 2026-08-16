"use client";

import {
	Clock,
	Fingerprint,
	Loader2,
	LogOut,
	Monitor,
	Trash2,
} from "lucide-react";
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
	const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
	const [confirmRevokeOthers, setConfirmRevokeOthers] = useState(false);

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
			setConfirmRevokeId(null);
		} finally {
			setRevokingId(null);
		}
	};

	const handleRevokeOthers = async () => {
		if (!onRevokeOthers || revokingOthers || otherSessions.length === 0) return;
		setRevokingOthers(true);
		try {
			await onRevokeOthers();
			setConfirmRevokeOthers(false);
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
					confirmRevokeOthers ? (
						<div className="flex flex-wrap items-center gap-2">
							<span className="text-[11px] text-text-muted">
								Sign out {otherSessions.length} other device{otherSessions.length === 1 ? "" : "s"}?
							</span>
							<button
								type="button"
								onClick={handleRevokeOthers}
								disabled={revokingOthers}
								className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-danger)]/30 bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--color-danger)] transition-[background-color,border-color,color,transform] duration-200 hover:border-[var(--color-danger)]/50 active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]"
							>
								{revokingOthers ? (
									<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
								) : (
									<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
								)}
								{revokingOthers ? "Revoking…" : "Confirm"}
							</button>
							<button
								type="button"
								onClick={() => setConfirmRevokeOthers(false)}
								disabled={revokingOthers}
								className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold text-text-secondary"
							>
								Cancel
							</button>
						</div>
					) : (
					<button
						type="button"
						onClick={() => setConfirmRevokeOthers(true)}
						disabled={revokingOthers}
						className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-danger)]/30 bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] px-3 py-1.5 text-xs font-semibold text-[var(--color-danger)] transition-[background-color,border-color,box-shadow,color,transform] duration-200 hover:border-[var(--color-danger)]/50 hover:bg-[color-mix(in_srgb,var(--color-danger)_20%,transparent)] active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]"
					>
						<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
						{`Sign out ${otherSessions.length} other device${otherSessions.length === 1 ? "" : "s"}`}
					</button>
					)
				)}
			</div>

			<div className="mt-6 space-y-2">
				{sessions.length === 0 ? (
					<div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border)] px-4 py-8 text-center bg-[var(--color-surface)]/30">
						<p className="text-sm font-semibold text-text-muted">
							No active sessions.
						</p>
						<p className="mt-1 text-xs text-text-muted">
							You&apos;re signed in — refresh if this looks wrong.
						</p>
					</div>
				) : (
					sessions.map((session) => (
						<div
							key={session.id}
							className="group flex flex-col gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]/30 px-5 py-4 sm:flex-row sm:items-center transition-[border-color,background-color,transform] hover:border-[var(--color-accent)]/30 hover:bg-[var(--color-surface)]/50 hover:scale-[1.01] duration-200 ease-out"
						>
							<div className="flex min-w-0 flex-1 items-center gap-4">
								<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-accent)]/20 bg-[color-mix(in_srgb,var(--color-accent)_5%,transparent)] transition-[border-color,background-color] group-hover:border-[var(--color-accent)]/40 group-hover:bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)]">
									{session.isCurrent ? (
										<Monitor
											className="h-5 w-5 text-[var(--color-accent)] drop-shadow-[0_0_8px_var(--color-accent)]"
											aria-hidden="true"
										/>
									) : (
										<Fingerprint
											className="h-5 w-5 text-text-muted transition-colors duration-200 ease-out group-hover:text-text-secondary"
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
											<span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-success)]/30 bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] px-2 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider text-[var(--color-success)]">
												This device
											</span>
										)}
									</div>
									<div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
										{session.ipAddress && (
											<span className="font-mono tabular-nums">
												{session.ipAddress}
											</span>
										)}
										<span className="flex items-center gap-1 tabular-nums">
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
									className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs font-semibold text-text-secondary transition-[background-color,border-color,box-shadow,color,transform] duration-200 hover:border-[var(--color-error)]/40 hover:text-[var(--color-error)] hover:bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]"
								>
									{signingOut ? (
										<Loader2
											className="h-3.5 w-3.5 animate-spin"
											aria-hidden="true"
										/>
									) : (
										<LogOut className="h-3.5 w-3.5" aria-hidden="true" />
									)}
									{signingOut ? "Signing out…" : "Sign out"}
								</button>
							) : !session.isCurrent && onRevokeSession ? (
								confirmRevokeId === session.id ? (
									<div className="flex shrink-0 items-center gap-2">
										<button
											type="button"
											onClick={() => handleRevoke(session.id)}
											disabled={revokingId === session.id}
											className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-error)]/40 bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] px-3 py-2 text-xs font-semibold text-[var(--color-error)] transition-[background-color,border-color,transform] duration-200 hover:bg-[color-mix(in_srgb,var(--color-error)_20%,transparent)] active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]"
										>
											{revokingId === session.id ? (
												<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
											) : (
												<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
											)}
											{revokingId === session.id ? "Revoking…" : "Confirm"}
										</button>
										<button
											type="button"
											onClick={() => setConfirmRevokeId(null)}
											disabled={revokingId === session.id}
											className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-2 text-xs font-semibold text-text-secondary"
										>
											Cancel
										</button>
									</div>
								) : (
								<button
									type="button"
									onClick={() => setConfirmRevokeId(session.id)}
									disabled={revokingId === session.id}
									className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs font-semibold text-text-secondary transition-[background-color,border-color,box-shadow,color,transform] duration-200 hover:border-[var(--color-error)]/40 hover:text-[var(--color-error)] hover:bg-[color-mix(in_srgb,var(--color-error)_10%,transparent)] active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-error)]"
								>
									<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
									Revoke
								</button>
								)
							) : null}
						</div>
					))
				)}
			</div>
			<p className="mt-5 text-[11px] leading-relaxed text-text-muted border-t border-border/50 pt-4">
				Revoking a remote session signs that device out immediately. Use{" "}
				<span className="font-semibold text-text-secondary">Sign out</span> on
				this device to end the current browser session.
			</p>
		</div>
	);
}
