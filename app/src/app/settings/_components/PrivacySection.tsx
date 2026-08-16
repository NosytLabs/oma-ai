"use client";

import { Download, Loader2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import type { BetterAuthUser } from "@/lib/hooks/useAuth";

interface PrivacySectionProps {
	user: BetterAuthUser | null;
}

export function PrivacySection({ user }: PrivacySectionProps) {
	const toast = useToast();
	const [downloading, setDownloading] = useState(false);

	const handleDownload = async () => {
		setDownloading(true);
		try {
			// One round-trip: server streams the full GDPR bundle
			// (profile, API keys w/o secrets, usage, deposits,
			// credit balance, audit logs, sessions) as a JSON
			// attachment. The server records a DATA_EXPORT_REQUESTED
			// audit row regardless of where the call came from.
			const blob = await api.exportData.accountBundle();
			const url = window.URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			anchor.href = url;
			anchor.download = `oma-data-export-${user?.id ?? "account"}.json`;
			document.body.appendChild(anchor);
			anchor.click();
			anchor.remove();
			window.URL.revokeObjectURL(url);
			toast.success("Your data download is ready");
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Download failed");
		} finally {
			setDownloading(false);
		}
	};

	return (
		<div>
			<div className="mb-4">
				<h2 className="text-lg font-semibold text-text-bright">
					Privacy &amp; data
				</h2>
				<p className="mt-1 text-sm text-text-muted">
					Manage your account data and privacy choices. See the{" "}
					<Link
						href="/privacy"
						className="text-accent underline-offset-4 hover:underline"
					>
						privacy policy
					</Link>{" "}
					for what we keep and what we never store.
				</p>
			</div>

			<div className="mt-6 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]/30 p-5 transition-colors duration-200 ease-out hover:border-[var(--color-accent)]/40">
				<div className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
					Account ID
				</div>
				<div className="mt-1 break-all font-mono text-[13px] font-semibold text-text-bright">
					{user?.id || "—"}
				</div>
			</div>

			<div className="mt-6 divide-y divide-[var(--color-border)] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)]/30 overflow-hidden">
				<div className="group flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between transition-colors duration-200 ease-out hover:bg-[var(--color-surface)]/50">
					<div>
						<h3 className="text-sm font-semibold text-text-bright">
							Download my data
						</h3>
						<p className="mt-1 text-xs text-text-muted">
							Export your account, usage, deposits, and credit summary as JSON.
						</p>
					</div>
					<button
						type="button"
						onClick={handleDownload}
						disabled={downloading}
						className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs font-semibold text-text-secondary transition-[background-color,border-color,box-shadow,color,transform] duration-200 hover:border-[var(--color-accent)]/40 hover:text-text-bright hover:bg-[var(--color-surface-elevated)] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
					>
						{downloading ? (
							<Loader2
								className="h-3.5 w-3.5 animate-spin"
								aria-hidden="true"
							/>
						) : (
							<Download className="h-3.5 w-3.5" aria-hidden="true" />
						)}
						{downloading ? "Preparing…" : "Download JSON"}
					</button>
				</div>

				<div className="group flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between transition-colors duration-200 ease-out hover:bg-[var(--color-danger)]/5">
					<div>
						<h3 className="text-sm font-semibold text-text-bright">
							Danger zone
						</h3>
						<p className="mt-1 text-xs text-text-muted">
							Permanently remove your account or clear usage history.
						</p>
					</div>
					<Link
						href="/settings?tab=danger"
						className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-danger)]/40 px-4 py-2 text-xs font-semibold text-[var(--color-danger)] transition-[background-color,border-color,box-shadow,color,transform] duration-200 hover:bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)] hover:border-[var(--color-danger)]/60 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-danger)]"
					>
						<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
						Danger zone
					</Link>
				</div>
			</div>
		</div>
	);
}
