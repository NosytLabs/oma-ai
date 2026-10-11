import type { Metadata } from "next";
import { DEFAULT_API_URL } from "@/lib/config";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { BreadcrumbListJsonLd } from "@/components/json-ld";
import { FREE_DEFAULT_CHAT_MODEL } from "@/lib/model-utils";

// The page's entire purpose is to report gateway health *right now*. It reads
// /health and /v1/models with `cache: "no-store"` and a hard 2.5s abort per
// request, so it is inherently per-request — but Next still prerendered the
// route as fully static without this export.
//
// Verified against a real `pnpm build`: the emitted
// .next/server/app/status.html contained the build machine's frozen health
// snapshot, including the h1 "Degraded — we're on it." and the row
// "Inference gateway (API) — Unreachable", because a build host has no route
// to the API. Every visitor and every crawler was served that stale snapshot.
// (That snapshot also claimed the page sat in the sitemap at priority 0.5 —
// it never did, and does not. The sitemap omission is deliberate; see
// noindex metadata below.)
//
// force-dynamic makes the route render per request, which is what the copy
// ("This page checks liveness the moment you load it") already promised.
// The paired fix is in next.config.ts: /status must not sit in the
// s-maxage=3600 CDN-cached list either, or the edge would re-freeze it.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
	title: "Status — live service health",
	description:
		"Live health of the OMA web app, inference gateway, and free website chat. Checked on each page load.",
	// This public health probe stays out of the index. robots.txt allows
	// crawling so search engines can read this directive, including for a URL
	// that was previously indexed. The sitemap deliberately omits it.
	robots: { index: false, follow: true },
	// The root layout sets alternates.canonical = "/", and Next merges parent
	// metadata downward — omitting the key here does NOT unset it, so the page
	// rendered <link rel="canonical" href="https://www.oma-ai.com/">: a crawler
	// was told /status is a duplicate of the homepage while it is also noindex.
	// It must name itself explicitly to override the inherited value.
	alternates: { canonical: "/status" },
	openGraph: {
		locale: "en_US",
		title: "Status — live service health",
		description:
			"Live health of the OMA web app, inference gateway, and free website chat. Checked on each page load.",
		url: "/status",
		images: [{ url: "/og-image.png", width: 1280, height: 720, alt: "OMA Status" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "Status — live service health",
		description:
			"Live health of the OMA web app, inference gateway, and free website chat.",
		images: ["/og-image.png"],
	},
};

type ServiceState = {
	name: string;
	ok: boolean;
	detail: string;
};

async function fetchJson(url: string, acceptUnavailable = false, ms = 2500): Promise<Record<string, unknown> | null> {
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
		if (!r.ok && !(acceptUnavailable && r.status === 503)) return null;
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
	const [backendJson, modelsJson, readinessJson] = await Promise.all([
		fetchJson(`${apiBase}/health`),
		fetchJson(`${apiBase}/v1/models`),
		fetchJson(`${apiBase}/ready`, true),
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
	const checks = readinessJson?.checks as Record<string, { ok?: boolean }> | undefined;
	const failedDependencies = [
		checks?.database?.ok === false ? "Database" : null,
		checks?.redis?.ok === false ? "Shared cache" : null,
	].filter(Boolean);
	const dependencies: ServiceState = {
		name: "Gateway dependencies",
		ok: readinessJson?.status === "ready",
		detail: readinessJson?.status === "ready"
			? "Database and shared cache are ready."
			: failedDependencies.length > 0
				? `${failedDependencies.join(" and ")} unavailable — some requests may be affected.`
				: "Readiness could not be confirmed.",
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
		name: "Model catalog",
		ok: modelRows.length > 0 && availableModels.length > 0,
		detail:
			modelsJson === null
				? "Model catalog could not be reached."
				: modelRows.length === 0
					? "No models are currently published by the gateway."
					: availableModels.length === 0
						? `0/${modelRows.length} models available — provider credentials or upstream capacity need attention.`
						: `${availableModels.length}/${modelRows.length} models enabled across ${availableProviders.size} provider${availableProviders.size === 1 ? "" : "s"}. Catalog configuration does not verify provider credentials or live inference.`,
	};

	const freeChatModel = modelRows.find(
		(model) => model.id === FREE_DEFAULT_CHAT_MODEL,
	);
	const chatAvailable = api.ok && freeChatModel?.available === true;
	const chat: ServiceState = {
		name: "Free website chat",
		ok: chatAvailable,
		detail: chatAvailable
			? "The default free model is listed as available. Live responses may use a fallback."
			: api.ok
				? "Paused — the default free model is not currently available."
				: "Paused while the gateway is unreachable.",
	};

	const services = [web, api, dependencies, providers, chat];
	const allOk = services.every((s) => s.ok);

	return (
		<section className="page-shell">
			<BreadcrumbListJsonLd
				items={[{ name: "Home", url: "/" }, { name: "Status", url: "/status" }]}
			/>
			<div className="container-page page-content mx-auto max-w-2xl">
				<span className="section-eyebrow-caps">Live status</span>
				<h1 className="h1-page mt-4 text-text-bright">
					{allOk ? "All systems normal." : "Some services are degraded."}
				</h1>
				<p className="page-intro">
					Live health of the services behind OMA. This page checks
					liveness and dependency readiness when you load it. Refresh to re-check. No account
					needed.
				</p>

				{/*
					The per-service state was communicated by icon shape + color
					alone: both the CheckCircle2 and the XCircle carry
					aria-hidden="true", so a screen-reader user heard the service
					name and a prose detail line with no explicit operational
					state. `s.detail` happens to contain the word "Unreachable" or
					"Healthy" today, but that is incidental to the sentence, not a
					status signal. Add a visually-hidden state word so the state is
					announced as a state.
				*/}
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
								<p className="font-mono text-sm text-text-bright">
									<span className="sr-only">{s.ok ? "Operational: " : "Degraded: "}</span>
									{s.name}
								</p>
								<p className="mt-1 text-sm text-text-secondary">{s.detail}</p>
							</div>
						</li>
					))}
				</ul>

				<p className="mt-8 text-xs text-text-muted flex items-center gap-2">
					<AlertCircle className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
					Health includes gateway reachability, dependency readiness, and advertised
					model availability. This check does not send inference requests; upstreams can still have capacity issues.
				</p>
			</div>
		</section>
	);
}
