"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

/**
	* ExportDataButton — surfaces OMA's existing usage/deposit export
	* endpoints (server/src/routes/export.ts: /v1/export/usage|deposits|summary)
	* in the dashboard UI. This is the #1 trust driver for credit-based billing
	* (Flexprice): users need to SEE where their credits went, not just a balance.
	*
	* The endpoints are session-authed and return CSV/JSON attachments. We hit them
	* through the same-origin /api proxy so the HttpOnly session cookie is forwarded
	* server-side (matches the rest of the client — see lib/api/client.ts).
	*/

type ExportKind = "usage" | "deposits" | "summary";

interface ExportDataButtonProps {
	kind: ExportKind;
	label?: string;
	format?: "csv" | "json";
	className?: string;
}

const DEFAULT_LABELS: Record<ExportKind, string> = {
	usage: "Export usage",
	deposits: "Export deposits",
	summary: "Export summary",
};

export function ExportDataButton({
	kind,
	label,
	format = "csv",
	className = "",
}: ExportDataButtonProps) {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleExport() {
	setLoading(true);
	setError(null);
	try {
	const res = await fetch(`/api/v1/export/${kind}?format=${format}`, {
	method: "GET",
	headers: { Accept: format === "json" ? "application/json" : "text/csv" },
	credentials: "same-origin",
	});
	if (!res.ok) {
	const body = await res.json().catch(() => ({}));
	throw new Error(body?.error?.message || `Export failed (${res.status})`);
	}
	const blob = await res.blob();
	const url = window.URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `${kind}-${Date.now()}.${format}`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	window.URL.revokeObjectURL(url);
	} catch (e) {
	setError(e instanceof Error ? e.message : "Export failed");
	} finally {
	setLoading(false);
	}
	}

	return (
	<div className={`inline-flex flex-col gap-1 ${className}`}>
	<button
	type="button"
	onClick={handleExport}
	disabled={loading}
	aria-label={label || DEFAULT_LABELS[kind]}
	className="inline-flex h-9 items-center gap-2 rounded-[var(--radius-md)] border border-border bg-void px-3 text-sm text-text-bright transition-colors duration-200 ease-out hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.97]"
	>
	{loading ? (
	<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
	) : (
	<Download className="h-3.5 w-3.5" aria-hidden="true" />
	)}
	{label || DEFAULT_LABELS[kind]}
	</button>
	{error && (
	<span className="text-[11px] text-red-400" role="alert">
	{error}
	</span>
	)}
	</div>
	);
}
