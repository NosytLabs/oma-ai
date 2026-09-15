import type { Metadata } from "next";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";

export const metadata: Metadata = {
	title: "Status — live service health",
	description:
		"Live health of the OMA web app, inference gateway, and free website chat. Checked on each page load.",
	alternates: { canonical: "/status" },
	robots: { index: true, follow: true },
};

type ServiceState = {
	name: string;
	ok: boolean;
	detail: string;
};

async function fetchJson(url: string, ms = 4000): Promise<Record<string, unknown> | null> {
	try {
		const r = await fetch(url, {
			cache: "no-store",
			signal: AbortSignal.timeout(ms),
		});
		if (!r.ok) return null;
		return (await r.json()) as Record<string, unknown>;
	} catch {
		return null;
	}
}

export default async function StatusPage() {
	// Web app liveness is this page itself — always up if you can read it.
	const web: ServiceState = {
		name: "Website (this app)",
		ok: true,
		detail: "You're reading this page, so the site is serving.",
	};

	const backendJson = await fetchJson(
		`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/health`,
	);
	const apiVersion =
		typeof backendJson?.version === "string" ? backendJson.version : null;
	const apiEnv = typeof backendJson?.env === "string" ? backendJson.env : null;
	const api: ServiceState = {
		name: "Inference gateway (API)",
		ok: backendJson !== null,
		detail:
			backendJson !== null
				? `Healthy${apiVersion ? ` — v${apiVersion}` : ""}${apiEnv ? ` (${apiEnv})` : ""}`
				: "Unreachable — chat, key management, and billing may fail. Retry in a moment.",
	};

	// The free website chat depends on the gateway; if the gateway is up,
	// chat is served by the same process, so this derives rather than pings.
	const chat: ServiceState = {
		name: "Free website chat",
		ok: api.ok,
		detail: api.ok
			? "Available — free models stream through the gateway above."
			: "Paused while the gateway is unreachable.",
	};

	const services = [web, api, chat];
	const allOk = services.every((s) => s.ok);

	return (
		<section className="page-shell">
			<div className="max-w-2xl mx-auto">
				<span className="section-eyebrow-caps">Live status</span>
				<h1 className="h1-page mt-4 text-text-bright">
					{allOk ? "All systems normal." : "Degraded — we're on it."}
				</h1>
				<p className="page-intro mt-4">
					Live health of the services behind OMA. This page checks
					liveness the moment you load it. Refresh to re-check. No account
					needed.
				</p>

				<ul className="mt-10 flex flex-col gap-4">
					{services.map((s) => (
						<li
							key={s.name}
							className="rounded-lg border border-border-hi bg-surface px-5 py-4 flex items-start gap-4"
						>
							{s.ok ? (
								<CheckCircle2
									className="h-5 w-5 mt-0.5 text-accent shrink-0"
									strokeWidth={1.75}
									aria-hidden="true"
								/>
							) : (
								<XCircle
									className="h-5 w-5 mt-0.5 text-red-400 shrink-0"
									strokeWidth={1.75}
									aria-hidden="true"
								/>
							)}
							<div>
								<p className="font-mono text-sm text-text-bright">{s.name}</p>
								<p className="mt-1 text-sm text-text-secondary">{s.detail}</p>
							</div>
						</li>
					))}
				</ul>

				<p className="mt-8 text-xs text-text-muted flex items-center gap-2">
					<AlertCircle className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
					Health reflects reachability, not model-level capacity. If chat
					streams slowly, the free-tier compute pool may be busy — retry.
				</p>
			</div>
		</section>
	);
}
