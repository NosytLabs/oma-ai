"use client";

import { AlertTriangle, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

interface SiteSettingsPayload {
	maintenanceMode?: boolean;
	maintenanceMessage?: string | null;
	paymentStatusAvailable?: boolean;
}

/**
 * Site-wide maintenance banner.
 *
 * Polls /api/v1/site-settings every 60s and shows a dismissable banner
 * for scheduled maintenance or a confirmed account-service outage. Reads the same
 * endpoint the deposit page uses so the message comes from one place.
 *
 * Survives transient network errors silently — if the API is down, we
 * keep the last known state and log nothing (we don't want a banner
 * alert storm during a partial outage).
 */
export function MaintenanceBanner() {
	const [settings, setSettings] = useState<SiteSettingsPayload | null>(null);
	const [dismissed, setDismissed] = useState(false);
	const notice = settings?.maintenanceMode
		? "maintenance"
		: settings?.paymentStatusAvailable === false ? "outage" : null;

	useEffect(() => {
		let cancelled = false;
		let interval: ReturnType<typeof setInterval> | null = null;

		async function fetchOnce() {
			try {
				const res = await fetch("/api/v1/site-settings", {
					credentials: "same-origin",
					headers: { Accept: "application/json" },
				});
				if (!res.ok) return;
				const data = (await res.json()) as SiteSettingsPayload;
				if (!cancelled) setSettings(data);
			} catch {
				/* swallow — the banner is informational, not a system alert */
			}
		}

		void fetchOnce();
		interval = setInterval(fetchOnce, 60_000);
		return () => {
			cancelled = true;
			if (interval) clearInterval(interval);
		};
	}, []);

	// A dismissed incident must not suppress a later, separate incident.
	useEffect(() => {
		setDismissed(false);
	}, [notice]);

	if (!notice || dismissed) return null;

	const message = notice === "maintenance"
		? settings?.maintenanceMessage?.trim() || "OMA is in maintenance mode. Some features may be temporarily unavailable."
		: "Account services are temporarily unavailable. Sign-in, credits and paid requests may fail.";

	return (
		<div
			role="status"
			aria-live="polite"
			className="flex flex-wrap items-center justify-between gap-3 border-b border-warning/40 bg-warning/10 px-4 py-2 text-[11px] font-mono text-warning md:px-8"
		>
			<span className="flex items-center gap-2">
				<AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
				<span className="uppercase tracking-wider font-semibold">{notice === "maintenance" ? "Maintenance" : "Service notice"} ·</span>
				<span className="text-warning/90 normal-case font-sans">{message}</span>
			</span>
			<Link href="/status" prefetch={false} className="text-warning underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning">
				Service status
			</Link>
			<button
				type="button"
				onClick={() => setDismissed(true)}
				className="shrink-0 inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-warning/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider hover:bg-warning/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warning"
				aria-label="Dismiss maintenance banner"
			>
				<X className="h-3 w-3" aria-hidden="true" />
				Dismiss
			</button>
		</div>
	);
}
