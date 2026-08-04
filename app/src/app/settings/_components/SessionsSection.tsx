"use client";

import { Clock, Fingerprint, Loader2, LogOut, Monitor } from "lucide-react";
import { useState } from "react";
import type { Session } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

interface SessionsSectionProps {
	sessions: Session[];
	/** Ends the current browser session (parent signOut). */
	onSignOutCurrent?: () => Promise<void> | void;
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
}: SessionsSectionProps) {
	const [signingOut, setSigningOut] = useState(false);

	const handleSignOut = async () => {
		if (!onSignOutCurrent || signingOut) return;
		setSigningOut(true);
		try {
			await onSignOutCurrent();
		} finally {
			setSigningOut(false);
		}
	};

	return (
		<div>
			<div className="mb-1">
				<h2 className="text-lg font-semibold text-text-bright">
					Active sessions
				</h2>
				<p className="mt-1 text-sm text-text-muted">
					Devices that are currently signed in to your account.
				</p>
			</div>

			<div className="mt-6 space-y-2">
				{sessions.length === 0 ? (
					<div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
						<p className="text-sm text-text-muted">No active sessions.</p>
						<p className="mt-1 text-xs text-text-muted">
							You&apos;re signed in — refresh if this looks wrong.
						</p>
					</div>
				) : (
					sessions.map((session) => (
						<div
							key={session.id}
							className="flex flex-col gap-3 rounded-lg border border-border bg-void px-4 py-3 sm:flex-row sm:items-center"
						>
							<div className="flex min-w-0 flex-1 items-center gap-3">
								<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-accent/20 bg-accent/5">
									{session.isCurrent ? (
										<Monitor className="h-4 w-4 text-accent" aria-hidden="true" />
									) : (
										<Fingerprint
											className="h-4 w-4 text-text-muted"
											aria-hidden="true"
										/>
									)}
								</div>
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<span className="text-sm font-semibold text-text">
											{getDeviceName(session.userAgent)}
										</span>
										{session.isCurrent && (
											<span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
												This device
											</span>
										)}
									</div>
									<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
										{session.ipAddress && (
											<span className="font-mono">{session.ipAddress}</span>
										)}
										<span className="flex items-center gap-1">
											<Clock className="h-2.5 w-2.5" aria-hidden="true" />
											Signed in {formatDateTime(session.createdAt)}
										</span>
									</div>
								</div>
							</div>
							{session.isCurrent && onSignOutCurrent && (
								<button
									type="button"
									onClick={handleSignOut}
									disabled={signingOut}
									className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 text-xs font-medium text-text-secondary transition-[border-color,color,background-color,opacity] duration-150 ease-out hover:border-error/40 hover:text-error active:scale-[0.97] disabled:opacity-50"
								>
									{signingOut ? (
										<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
									) : (
										<LogOut className="h-3.5 w-3.5" aria-hidden="true" />
									)}
									{signingOut ? "Signing out…" : "Sign out"}
								</button>
							)}
						</div>
					))
				)}
			</div>
			<p className="mt-4 text-[11px] leading-relaxed text-text-muted">
				Remote session revoke is not available yet. Use Sign out on this device
				to end the current browser session.
			</p>
		</div>
	);
}
