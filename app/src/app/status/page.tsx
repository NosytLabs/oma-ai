import type { Metadata } from "next";
import { DEFAULT_API_URL } from "@/lib/config";
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

async function fetchJson(url: string, ms = 2500): Promise<Record<string, unknown> | null> {
	// A backend pointing at localhost is never reachable from a serverless
	// host (there is no local API process), and waiting on it can blow the
	// function's execution budget and 500 this page. Short-circuit to a clean
	// "unreachable" state instead of letting the fetch hang.
	if (/^http:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/.test(url)) {
		return null;
	}
	try {
		const r = await fetch(url, {
			cache: "no-store",
			// AbortSignal.timeout is not universally reliable inside serverless
			// isolates; an explicit controller + hard cap guarantees we return
			// within ms and never 500 the page for a slow/unreachable backend.
			signal: AbortSignal.timeout(ms),
		});
		if (!r.ok) return null;
		return (await r.json()) as Record<string, unknown> | null;
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

	// Use the shared, trailing-slash-normalized base instead of re-reading
	// NEXT_PUBLIC_API_URL here, so this page cannot drift from the route
	// handlers (a double slash or a divergent fallback would 404).
	const apiBase = DEFAULT_API_URL;
	const [backendJson, modelsJson] = await Promise.all([
		fetchJson(`${apiBase}/health`),
		fetchJson(`${apiBase}/v1/models`),
	]);
	const apiVersion =
		typeof backendJson?.version === "string" ? backendJson.version : null;
	const api: ServiceState = {
		name: "Inference gateway (API)",
		ok: backendJson !== null,
		detail:
			backendJson !== null
				? `Healthy${apiVersion ? ` — v${apiVersion}` : ""}`
				: "Unreachable — chat, key management, and billing may fail. Retry in a moment.",
	};

	type ModelStatus = {
		id?: unknown;
		provider?: unknown;
		available?: unknown;
	};
	const modelRows: ModelStatus[] = Array.isArray(modelsJson?.data)
		? (modelsJson.data as ModelStatus[])
		: [];
	const availableModels = modelRows.filter((model) => model.available === true);
	const availableProviders = new Set(
		availableModels
			.map((model) =>
				typeof model.provider === "string" ? model.provider : null,
			)
			.filter((provider): provider is string => provider !== null),
	);
	const providers: ServiceState = {
		name: "Model providers",
		ok: modelRows.length > 0 && availableModels.length > 0,
		detail:
			modelsJson === null
				? "Model catalog could not be reached."
				: modelRows.length === 0
					? "No models are currently published by the gateway."
					: availableModels.length === 0
						? `0/${modelRows.length} models available — provider credentials or upstream capacity need attention.`
						: `${availableModels.length}/${modelRows.length} models available across ${availableProviders.size} provider${availableProviders.size === 1 ? "" : "s"}.`,
	};

	const freeChatModel = modelRows.find(
		(model) => model.id === "deepseek-v4-flash-0731-openbroker",
	);
	const chatAvailable = api.ok && freeChatModel?.available === true;
	const chat: ServiceState = {
		name: "Free website chat",
		ok: chatAvailable,
		detail: chatAvailable
			? "Available — the default free model is ready."
			: api.ok
				? "Paused — the default free model is not currently available."
				: "Paused while the gateway is unreachable.",
	};

	const services = [web, api, providers, chat];
	const allOk = services.every((s) => s.ok);

	return (
		<section className="page-shell">
			<div className="container-page page-content mx-auto max-w-2xl">
				<span className="section-eyebrow-caps">Live status</span>
				<h1 className="h1-page mt-4 text-text-bright">
					{allOk ? "All systems normal." : "Degraded — we're on it."}
				</h1>
				<p className="page-intro">
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
					Health includes gateway reachability and advertised model-provider
					availability. Individual upstreams can still have transient capacity issues.
				</p>
			</div>
		</section>
	);
}
