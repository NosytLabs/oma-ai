"use client";

import Link from "next/link";
import { Download, History, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { api, type User } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface PrivacySectionProps {
	user: User | null;
}

export function PrivacySection({ user }: PrivacySectionProps) {
	const toast = useToast();
	const [downloading, setDownloading] = useState(false);
	const [clearing, setClearing] = useState(false);

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

	const handleClearHistory = async () => {
		if (!window.confirm("Clear all usage history and audit logs? This cannot be undone.")) return;
		setClearing(true);
		try {
			const result = await api.auth.clearHistory();
			toast.success(
				result.success
					? `Cleared ${result.deleted.usageRecords} usage records and ${result.deleted.auditLogs} logs.`
					: "Failed to clear usage history",
			);
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Failed to clear usage history");
		} finally {
			setClearing(false);
		}
	};

	return (
		<div>
			<div className="mb-1">
				<h2 className="text-lg font-semibold text-text-bright">Privacy &amp; data</h2>
				<p className="mt-1 text-sm text-text-muted">
					Manage your account data and privacy choices.
				</p>
			</div>

			<div className="mt-6 rounded-lg border border-border bg-void p-4">
				<div className="text-[11px] font-medium text-text-muted">Account ID</div>
				<div className="mt-1 break-all font-mono text-sm text-text">{user?.id || "—"}</div>
			</div>

			<div className="mt-4 divide-y divide-border rounded-lg border border-border bg-void">
				<div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h3 className="text-sm font-semibold text-text-bright">Download my data</h3>
						<p className="mt-1 text-xs text-text-muted">Export your account, usage, deposits, and credit summary as JSON.</p>
					</div>
					<button type="button" onClick={handleDownload} disabled={downloading} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-border bg-surface px-3 text-sm text-text-bright transition-colors hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-50">
						{downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Download className="h-3.5 w-3.5" aria-hidden="true" />}
						{downloading ? "Preparing…" : "Download JSON"}
					</button>
				</div>

				<div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h3 className="text-sm font-semibold text-text-bright">Clear usage history</h3>
						<p className="mt-1 text-xs text-text-muted">Remove usage records and audit logs while keeping your account, keys, and credits.</p>
					</div>
					<button type="button" onClick={handleClearHistory} disabled={clearing} className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-border px-3 text-sm text-text-secondary transition-colors hover:border-accent/40 hover:text-text-bright disabled:cursor-not-allowed disabled:opacity-50">
						{clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <History className="h-3.5 w-3.5" aria-hidden="true" />}
						{clearing ? "Clearing…" : "Clear history"}
					</button>
				</div>

				<div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h3 className="text-sm font-semibold text-text-bright">Delete account</h3>
						<p className="mt-1 text-xs text-text-muted">Permanently remove your account and associated data.</p>
					</div>
					<Link href="/settings?tab=danger" className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md border border-error/40 px-3 text-sm text-error transition-colors hover:bg-error/10">
						<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
						Delete account
					</Link>
				</div>
			</div>
		</div>
	);
}
