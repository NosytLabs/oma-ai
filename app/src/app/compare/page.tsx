import type { Metadata } from "next";
import Link from "next/link";
import { Check, X, Sparkles } from "lucide-react";
import { Breadcrumb } from "@/components/shared/Breadcrumb";

export const metadata: Metadata = {
	title: "oma vs Portkey vs LiteLLM vs OpenRouter — comparison",
	description:
		"Detailed feature comparison between oma and other LLM gateways: Portkey, LiteLLM, OpenRouter, Together, OpenAI. Pricing, privacy, free tier, x402 support.",
	openGraph: {
		title: "oma vs Portkey vs LiteLLM vs OpenRouter",
		description:
			"Feature-by-feature comparison. oma is the only agent-native LLM gateway with x402, free tier, anonymous accounts, and circuit-breaker failover.",
	},
};

const competitors: { key: string; name: string; tagline: string; ours?: boolean }[] = [
	{ key: "oma", name: "oma", tagline: "Agent-native inference", ours: true },
	{ key: "portkey", name: "Portkey", tagline: "Enterprise AI gateway" },
	{ key: "litellm", name: "LiteLLM", tagline: "Open-source proxy" },
	{ key: "openrouter", name: "OpenRouter", tagline: "Model router" },
	{ key: "together", name: "Together AI", tagline: "Direct inference" },
];

type RowKey =
	| "x402"
	| "anonymous_auth"
	| "free_tier"
	| "credit_card_required"
	| "circuit_breaker"
	| "multi_provider"
	| "virtual_keys"
	| "guardrails"
	| "caching"
	| "webhooks"
	| "usdc_native"
	| "siwe"
	| "anonymous_account"
	| "open_source"
	| "lowest_input_price"
	| "agent_sdk";

const rows: { key: RowKey; label: string; note?: string }[] = [
	{ key: "x402", label: "x402 pay-per-request (HTTP 402)", note: "Crypto-native, gasless for agents" },
	{ key: "anonymous_auth", label: "Anonymous auth (no KYC, no signup)" },
	{ key: "free_tier", label: "Genuine free tier", note: "Not just a trial — ongoing" },
	{ key: "credit_card_required", label: "Requires credit card", note: "Inverted — ✓ means it requires one" },
	{ key: "circuit_breaker", label: "Circuit-breaker failover" },
	{ key: "multi_provider", label: "Multi-provider routing" },
	{ key: "virtual_keys", label: "Virtual / scoped sub-keys" },
	{ key: "guardrails", label: "Built-in guardrails (PII, content)" },
	{ key: "caching", label: "Response caching" },
	{ key: "webhooks", label: "Webhook notifications" },
	{ key: "usdc_native", label: "USDC native settlement" },
	{ key: "siwe", label: "Sign-In With Ethereum (SIWE)" },
	{ key: "anonymous_account", label: "Mullvad-style account numbers" },
	{ key: "open_source", label: "Open source" },
	{
		key: "lowest_input_price",
		label: "Lowest input price",
		note: "Per 1M tokens at budget tier",
	},
	{ key: "agent_sdk", label: "Official TypeScript SDK" },
];

type Cell = "yes" | "no" | "partial" | string;

const matrix: Record<RowKey, Record<(typeof competitors)[number]["key"], Cell>> = {
	x402: {
		oma: "yes",
		portkey: "no",
		litellm: "no",
		openrouter: "no",
		together: "no",
	},
	anonymous_auth: {
		oma: "yes",
		portkey: "no",
		litellm: "no",
		openrouter: "no",
		together: "no",
	},
	free_tier: {
		oma: "yes",
		portkey: "no",
		litellm: "no",
		openrouter: "no",
		together: "$5 credit",
	},
	credit_card_required: {
		oma: "no",
		portkey: "yes",
		litellm: "yes",
		openrouter: "yes",
		together: "yes",
	},
	circuit_breaker: {
		oma: "yes",
		portkey: "yes",
		litellm: "partial",
		openrouter: "no",
		together: "no",
	},
	multi_provider: {
		oma: "yes",
		portkey: "yes",
		litellm: "yes",
		openrouter: "yes",
		together: "no",
	},
	virtual_keys: {
		oma: "yes",
		portkey: "yes",
		litellm: "yes",
		openrouter: "partial",
		together: "no",
	},
	guardrails: {
		oma: "yes",
		portkey: "yes",
		litellm: "partial",
		openrouter: "no",
		together: "no",
	},
	caching: {
		oma: "yes",
		portkey: "yes",
		litellm: "yes",
		openrouter: "no",
		together: "no",
	},
	webhooks: {
		oma: "yes",
		portkey: "yes",
		litellm: "partial",
		openrouter: "no",
		together: "no",
	},
	usdc_native: {
		oma: "yes",
		portkey: "no",
		litellm: "no",
		openrouter: "no",
		together: "no",
	},
	siwe: {
		oma: "yes",
		portkey: "partial",
		litellm: "no",
		openrouter: "partial",
		together: "no",
	},
	anonymous_account: {
		oma: "yes",
		portkey: "no",
		litellm: "no",
		openrouter: "no",
		together: "no",
	},
	open_source: {
		oma: "yes",
		portkey: "partial",
		litellm: "yes",
		openrouter: "no",
		together: "no",
	},
	lowest_input_price: {
		oma: "$0.0002",
		portkey: "$0.10",
		litellm: "$0.10",
		openrouter: "$0.05",
		together: "$0.10",
	},
	agent_sdk: {
		oma: "yes",
		portkey: "yes",
		litellm: "yes",
		openrouter: "yes",
		together: "yes",
	},
};

function CellView({ value, ours }: { value: Cell; ours: boolean }) {
	if (value === "yes") {
		return (
			<div className={`flex justify-center ${ours ? "text-accent" : "text-emerald-400"}`}>
				<Check className="w-5 h-5" />
			</div>
		);
	}
	if (value === "no") {
		return (
			<div className="flex justify-center text-text-muted">
				<X className="w-5 h-5" />
			</div>
		);
	}
	if (value === "partial") {
		return (
			<div className="flex justify-center">
				<span className="text-xs font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
					partial
				</span>
			</div>
		);
	}
	return (
		<div className={`text-center text-sm font-mono ${ours ? "text-accent font-semibold" : "text-text-primary"}`}>
			{value}
		</div>
	);
}

const summaryCards = [
	{
		title: "x402 + crypto-native",
		body: "Only oma speaks x402 natively. Agents pay per request on Base in USDC — no monthly contract, no API key leaks.",
	},
	{
		title: "Anonymous by default",
		body: "Mullvad-style account numbers, SIWE for wallet users, zero KYC. Privacy is the default, not a premium tier.",
	},
	{
		title: "Free tier, structurally",
		body: "Cheapest budget tier is $0.0002/M tokens via Gonka/OpenBroker. 10K free users costs ~$3/mo. No credit card.",
	},
	{
		title: "Multi-provider + circuit breaker",
		body: "Venice, Surplus, Gonka, CheapTokens, CheapSurplus. If one provider 503s, traffic auto-routes to a backup. No retry storms.",
	},
];

export default function ComparePage() {
	return (
		<div className="min-h-screen bg-void text-text-primary">
			<main className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pb-24">
				{/* Hero */}
				<section className="py-16 text-center">
					<div className="inline-flex items-center gap-2 mb-6 px-3 py-1 rounded-full border border-accent/20 bg-accent/5 text-accent text-xs font-mono">
						<Sparkles className="w-3 h-3" />
						<span>feature comparison</span>
					</div>
					<h1 className="text-4xl sm:text-5xl font-bold mb-4">
						oma vs every other gateway
					</h1>
					<p className="text-text-secondary text-lg max-w-2xl mx-auto">
						Detailed feature comparison across the LLM gateway landscape. Data
						current as of 2026-07.
					</p>
				</section>

				{/* Summary cards */}
				<section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-16">
					{summaryCards.map((card) => (
						<div
							key={card.title}
							className="rounded-lg border border-border bg-surface p-5"
						>
							<h3 className="font-semibold mb-2 text-accent">{card.title}</h3>
							<p className="text-sm text-text-secondary leading-relaxed">
								{card.body}
							</p>
						</div>
					))}
				</section>

				{/* Comparison matrix */}
				<section>
					<div className="overflow-x-auto rounded-lg border border-border">
						<table className="w-full">
							<thead className="bg-surface-2 border-b border-border">
								<tr>
									<th className="text-left p-4 font-mono text-xs uppercase tracking-wider text-text-muted">
										Feature
									</th>
									{competitors.map((c) => (
										<th
											key={c.key}
											className={`p-4 text-center ${
												c.ours ? "bg-accent/5 border-x border-accent/20" : ""
											}`}
										>
											<div className="flex flex-col items-center gap-1">
												<span
													className={`font-semibold ${
														c.ours ? "text-accent" : "text-text-primary"
													}`}
												>
													{c.name}
												</span>
												<span className="text-xs text-text-muted">
													{c.tagline}
												</span>
											</div>
										</th>
									))}
								</tr>
							</thead>
							<tbody>
								{rows.map((row, idx) => (
									<tr
										key={row.key}
										className={
											idx % 2 === 0 ? "bg-surface" : "bg-surface-2"
										}
									>
										<td className="p-4">
											<div className="font-medium">{row.label}</div>
											{row.note && (
												<div className="text-xs text-text-muted mt-0.5">
													{row.note}
												</div>
											)}
										</td>
										{competitors.map((c) => (
											<td
												key={c.key}
												className={`p-4 ${
													c.ours ? "bg-accent/5 border-x border-accent/20" : ""
												}`}
											>
												<CellView value={matrix[row.key][c.key]} ours={!!c.ours} />
											</td>
										))}
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>

				{/* Footnotes */}
				<section className="mt-8 text-sm text-text-muted space-y-2">
					<p>
						<span className="font-semibold text-text-primary">Pricing source:</span>{" "}
						budget tier input cost per 1M tokens, July 2026. Subject to provider
						changes.
					</p>
					<p>
						<span className="font-semibold text-text-primary">Feature audit:</span>{" "}
						based on each product&apos;s public docs as of 2026-07. If you find
						an error, please open a PR.
					</p>
				</section>

				{/* Per-competitor deep dives */}
				<section className="mt-20">
					<h2 className="text-2xl font-bold mb-6">Detailed breakdowns</h2>
					<div className="grid md:grid-cols-2 gap-6">
						<div className="rounded-lg border border-border bg-surface p-6">
							<h3 className="text-lg font-semibold mb-2">
								oma vs Portkey
							</h3>
							<p className="text-sm text-text-secondary mb-3">
								Portkey is enterprise-grade but requires a credit card, account
								signup, and offers no free tier. oma is anonymous, x402-native,
								and starts at $0.0002/M tokens.
							</p>
							<p className="text-sm text-text-secondary mb-3">
								<strong className="text-accent">oma wins on:</strong> privacy,
								crypto-native billing, free tier, account numbers.
							</p>
							<p className="text-sm text-text-secondary">
								<strong className="text-emerald-400">Portkey wins on:</strong>{" "}
								enterprise features (SSO, audit logs, RBAC), observability
								depth, on-prem deployment.
							</p>
						</div>

						<div className="rounded-lg border border-border bg-surface p-6">
							<h3 className="text-lg font-semibold mb-2">
								oma vs LiteLLM
							</h3>
							<p className="text-sm text-text-secondary mb-3">
								LiteLLM is a self-hosted proxy — you run it, you manage it, you
								pay your own infra. oma is fully managed with x402 + USDC +
								anonymous accounts out of the box.
							</p>
							<p className="text-sm text-text-secondary mb-3">
								<strong className="text-accent">oma wins on:</strong> managed
								infrastructure, payment rails, free tier, account anonymity.
							</p>
							<p className="text-sm text-text-secondary">
								<strong className="text-emerald-400">LiteLLM wins on:</strong>{" "}
								data sovereignty (your hardware), 100+ provider support,
								deep customization.
							</p>
						</div>

						<div className="rounded-lg border border-border bg-surface p-6">
							<h3 className="text-lg font-semibold mb-2">
								oma vs OpenRouter
							</h3>
							<p className="text-sm text-text-secondary mb-3">
								OpenRouter is the closest competitor. Same multi-provider model.
								OpenRouter wins on brand recognition and provider breadth. oma
								wins on price (250× cheaper budget tier), privacy (Venice
								routing), and payment (x402 + USDC).
							</p>
							<p className="text-sm text-text-secondary mb-3">
								<strong className="text-accent">oma wins on:</strong> privacy,
								x402, price, account model.
							</p>
							<p className="text-sm text-text-secondary">
								<strong className="text-emerald-400">OpenRouter wins on:</strong>{" "}
								provider breadth, ecosystem integrations, market share.
							</p>
						</div>

						<div className="rounded-lg border border-border bg-surface p-6">
							<h3 className="text-lg font-semibold mb-2">
								oma vs Together AI
							</h3>
							<p className="text-sm text-text-secondary mb-3">
								Together is a direct inference provider, not a gateway. They
								own GPUs and serve models directly. oma is a routing layer on
								top of multiple providers — you get failover, mix-and-match,
								and Gonka-cheap routes Together can&apos;t match.
							</p>
							<p className="text-sm text-text-secondary mb-3">
								<strong className="text-accent">oma wins on:</strong>{" "}
								multi-provider, failover, free tier, privacy.
							</p>
							<p className="text-sm text-text-secondary">
								<strong className="text-emerald-400">Together wins on:</strong>{" "}
								direct GPU access, fine-tuning, dedicated capacity, raw speed.
							</p>
						</div>
					</div>
				</section>

				{/* CTA */}
				<section className="mt-20 text-center rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/10 via-surface to-surface p-12">
					<h2 className="text-3xl font-bold mb-3">
						Ready to ship faster?
					</h2>
					<p className="text-text-secondary mb-6 max-w-xl mx-auto">
						No credit card. No KYC. Just an account number or a wallet. Run your
						first request in under a minute.
					</p>
					<div className="flex flex-wrap gap-3 justify-center">
						<Link
							href="/login"
							className="px-5 py-2.5 rounded-lg bg-accent text-void font-semibold hover:bg-accent/90 transition"
						>
							Get API key
						</Link>
						<Link
							href="/chat"
							className="px-5 py-2.5 rounded-lg border border-border bg-surface text-text-primary hover:bg-surface-2 transition"
						>
							Try the playground
						</Link>
						<Link
							href="/docs"
							className="px-5 py-2.5 rounded-lg border border-border bg-surface text-text-primary hover:bg-surface-2 transition"
						>
							Read the docs
						</Link>
					</div>
				</section>
			</main>
		</div>
	);
}
