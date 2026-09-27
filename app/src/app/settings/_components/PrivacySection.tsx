"use client";

import { Download, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import type { BetterAuthUser } from "@/lib/hooks/useAuth";
import { SettingsCard } from "./SettingsCard";

interface PrivacySectionProps {
	user: BetterAuthUser | null;
	readOnly?: boolean;
}

export function PrivacySection({ user, readOnly = false }: PrivacySectionProps) {
	const toast = useToast();
	const [downloading, setDownloading] = useState(false);

	const handleDownload = async () => {
		if (readOnly || downloading) return;
		setDownloading(true);
		try {
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

			<SettingsCard
				title="Download my data"
				description="Export your account, usage, deposits, and credit summary as JSON."
			>
				<button
					type="button"
					onClick={handleDownload}
					disabled={readOnly || downloading}
					className="btn-mono btn-secondary flex items-center gap-2 disabled:cursor-not-allowed disabled:opacity-40"
				>
					{downloading ? (
						<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
					) : (
						<Download className="h-3.5 w-3.5" aria-hidden="true" />
					)}
					{downloading ? "Preparing…" : "Download JSON"}
				</button>
			</SettingsCard>
		</div>
	);
}
