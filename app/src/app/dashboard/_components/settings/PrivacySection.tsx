"use client";

import { Download, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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
	const pending = useRef<AbortController | null>(null);
	useEffect(() => {
		setDownloading(false);
		return () => {
			pending.current?.abort();
			pending.current = null;
		};
	}, [user?.id, readOnly]);

	const handleDownload = async () => {
		if (readOnly || !user?.id || pending.current) return;
		const controller = new AbortController();
		pending.current = controller;
		const isCurrent = () => pending.current === controller && !controller.signal.aborted;
		setDownloading(true);
		try {
			const blob = await api.exportData.accountBundle(controller.signal);
			if (!isCurrent()) return;
			const url = window.URL.createObjectURL(blob);
			const anchor = document.createElement("a");
			try {
				anchor.href = url;
				anchor.download = `oma-data-export-${user.id}.json`;
				document.body.appendChild(anchor);
				if (!isCurrent()) return;
				anchor.click();
			} finally {
				anchor.remove();
				window.URL.revokeObjectURL(url);
			}
			if (isCurrent()) toast.success("Your data download is ready");
		} catch (error) {
			if (isCurrent()) toast.error(error instanceof Error ? error.message : "Download failed");
		} finally {
			if (pending.current === controller) {
				pending.current = null;
				setDownloading(false);
			}
		}
	};

	return (
		<div>
			<div className="mb-4">
				<h2 className="font-sans text-lg font-semibold text-text-bright">
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
