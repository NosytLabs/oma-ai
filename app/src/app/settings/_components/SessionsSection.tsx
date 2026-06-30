"use client";

import { Clock, Fingerprint, Monitor } from "lucide-react";
import type { Session } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

interface SessionsSectionProps {
	sessions: Session[];
}

export function SessionsSection({ sessions }: SessionsSectionProps) {
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
					</div>
				) : (
					sessions.map((session) => (
						<div
							key={session.id}
							className="flex items-center gap-3 rounded-lg border border-border bg-void px-4 py-3"
						>
							<div className="flex h-9 w-9 items-center justify-center rounded-lg border border-accent/20 bg-accent/5">
								{session.current ? (
									<Monitor className="h-4 w-4 text-accent" />
								) : (
									<Fingerprint className="h-4 w-4 text-text-muted" />
								)}
							</div>
							<div className="min-w-0 flex-1">
								<div className="flex items-center gap-2">
									<span className="text-sm font-semibold text-text">
										{session.device}
									</span>
									{session.current && (
										<span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
											This device
										</span>
									)}
								</div>
								<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
									<span className="font-mono">{session.ip}</span>
									<span className="flex items-center gap-1">
										<Clock className="h-2.5 w-2.5" />
										Active {formatDateTime(session.lastActive)}
									</span>
								</div>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}
