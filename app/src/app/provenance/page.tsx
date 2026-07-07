import type { Metadata } from "next";
import { FileText, Gavel, ShieldCheck, ScrollText } from "lucide-react";

export const metadata: Metadata = {
	title: "Provenance & License Disclosure",
	description:
		"Per-model training-data posture, license obligations, filter behavior, and indemnity scope for every model on OMA.",
	alternates: { canonical: "/provenance" },
	openGraph: {
		title: "Provenance & License Disclosure · OMA",
		description:
			"Per-model training-data posture, license obligations, and indemnity scope.",
	},
};

interface ModelProvenance {
	id: string;
	tier: "budget" | "mid" | "premium" | "frontier";
	posture: "isolated" | "permissive-only" | "open-weights";
	training: "unspecified" | "public-web" | "open-weights";
	license: string;
	filter: "strict" | "moderate" | "none";
	indemnity: "covered" | "limited" | "none";
	notes: string;
}

const MODELS: ModelProvenance[] = [
	{
		id: "claude-opus-4-1",
		tier: "frontier",
		posture: "isolated",
		training: "unspecified",
		license: "Proprietary (API)",
		filter: "strict",
		indemnity: "covered",
		notes: "Served via upstream provider with default safety filtering. Output indemnity rests with the upstream provider per its terms.",
	},
	{
		id: "gemini-2.5-pro",
		tier: "frontier",
		posture: "isolated",
		training: "unspecified",
		license: "Proprietary (API)",
		filter: "strict",
		indemnity: "limited",
		notes: "Upstream safety filters apply. Indemnity limited to API consumer; commercial redistribution excluded.",
	},
	{
		id: "qwen3-235b-a22b-instruct-2507",
		tier: "premium",
		posture: "open-weights",
		training: "open-weights",
		license: "Apache-2.0 (weights) / Venice terms (service)",
		filter: "moderate",
		indemnity: "none",
		notes: "Open weights under Apache-2.0. Service-side filtering applies; outputs may resemble training data in low-temperature regimes.",
	},
	{
		id: "qwen3-coder-480b-a35b-instruct",
		tier: "premium",
		posture: "open-weights",
		training: "open-weights",
		license: "Apache-2.0 (weights) / Venice terms (service)",
		filter: "moderate",
		indemnity: "none",
		notes: "Open-weights coder. Pay particular attention to copyleft propagation when incorporating suggestions into GPL-licensed projects.",
	},
	{
		id: "llama-3.3-70b",
		tier: "mid",
		posture: "open-weights",
		training: "open-weights",
		license: "Llama-3 Community License",
		filter: "moderate",
		indemnity: "none",
		notes: "Subject to Llama-3 acceptable-use policy. Commercial use allowed above the monthly active-user threshold in Meta's terms.",
	},
	{
		id: "llama-3.2-3b",
		tier: "budget",
		posture: "open-weights",
		training: "open-weights",
		license: "Llama-3.2 Community License",
		filter: "moderate",
		indemnity: "none",
		notes: "Same license family as 70B. Suitable for classification and short-form generation.",
	},
	{
		id: "mistral-31-24b",
		tier: "budget",
		posture: "open-weights",
		training: "open-weights",
		license: "Apache-2.0 (weights) / Mistral Research License (some tiers)",
		filter: "moderate",
		indemnity: "none",
		notes: "Verify the served weights are Apache-2.0 before shipping commercially.",
	},
	{
		id: "deepseek-v3.2-exp",
		tier: "mid",
		posture: "open-weights",
		training: "open-weights",
		license: "DeepSeek License Agreement",
		filter: "moderate",
		indemnity: "none",
		notes: "Experimental release. License terms permit commercial use subject to acceptable-use policy.",
	},
];

export default function ProvenancePage() {
	return (
		<div className="ledger-bg min-h-[calc(100vh-4rem)]">
			<div className="mx-auto max-w-5xl px-6 py-16">
				<header className="mb-12 max-w-3xl">
					<div className="marginalia">
						Document · v2026-07-07 · maintained by OMA Trust
					</div>
					<h1 className="prose-document text-4xl mt-2">Provenance & License Disclosure</h1>
					<p className="text-text-secondary text-[15px] mt-4 max-w-2xl leading-relaxed">
						Every model on OMA has a documented training-data posture, a
						service-side filter behavior, a license category, and an
						indemnity scope. This page is the canonical reference for buyers,
						legal teams, and procurement officers who need to assess AI
						coding risk.
					</p>
				</header>

				<section className="grid sm:grid-cols-2 gap-3 mb-12">
					<PillarCard
						icon={<FileText className="w-4 h-4" />}
						title="Training provenance"
						body="Each model ships with the data category it was trained on: open-weights corpus, public web, or unspecified provider data."
					/>
					<PillarCard
						icon={<ShieldCheck className="w-4 h-4" />}
						title="Filter posture"
						body="We document the safety filters that run on every request, from strict (provider-side) to moderate (infrastructure-side)."
					/>
					<PillarCard
						icon={<ScrollText className="w-4 h-4" />}
						title="License obligations"
						body="If a model ships under Apache-2.0, Llama-3, or another license, we surface the obligations so you can propagate them in your output."
					/>
					<PillarCard
						icon={<Gavel className="w-4 h-4" />}
						title="Indemnity scope"
						body="Indemnity rests with the upstream provider where their terms cover API consumers. We document when it does and when it doesn't."
					/>
				</section>

				<section className="mb-12">
					<h2 className="prose-document text-2xl">Model registry</h2>
					<p className="text-text-secondary text-[14.5px] mt-2 mb-6 max-w-2xl leading-relaxed">
						The list below reflects models available on the public OMA
						endpoint at the time of publication. The registry is updated
						within one business day of any catalog change.
					</p>

					<div className="border border-border bg-surface">
						<table className="w-full text-left text-[13px]">
							<thead>
								<tr className="border-b border-border text-text-tertiary">
									<th className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider">
										Model
									</th>
									<th className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider">
										Tier
									</th>
									<th className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider">
										Posture
									</th>
									<th className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider">
										License
									</th>
									<th className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider">
										Filter
									</th>
									<th className="px-4 py-3 font-mono text-[11px] uppercase tracking-wider">
										Indemnity
									</th>
								</tr>
							</thead>
							<tbody>
								{MODELS.map((m) => (
									<tr
										key={m.id}
										className="border-b border-border last:border-b-0 align-top hover:bg-surface-elevated/40 transition-colors"
									>
										<td className="px-4 py-3 font-mono text-text-bright text-[12.5px]">
											{m.id}
										</td>
										<td className="px-4 py-3">
											<span className="legal-badge">{m.tier}</span>
										</td>
										<td className="px-4 py-3">
											<span className={tierBadge(m.posture)}>
												{m.posture}
											</span>
										</td>
										<td className="px-4 py-3 text-text-secondary text-[12px] leading-relaxed max-w-[18rem]">
											{m.license}
										</td>
										<td className="px-4 py-3">
											<span className={filterBadge(m.filter)}>{m.filter}</span>
										</td>
										<td className="px-4 py-3">
											<span className={indemnityBadge(m.indemnity)}>
												{m.indemnity}
											</span>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</section>

				<section className="prose-document">
					<h2>How to use this page</h2>
					<p>
						When a procurement officer or compliance team asks about the
						licensing posture of a model you ship through OMA, link directly
						to the model row above. When a reviewer asks about a specific
						output, pair that link with your project&apos;s <code>audit-log</code>
						export, which records the model, the prompt hash, and the
						response hash for every request.
					</p>

					<h2>What this page does not cover</h2>
					<ul>
						<li>
							The exact training dataset for models served behind a closed
							API. Where the upstream provider has not published a summary,
							the <code>training</code> column reads <code>unspecified</code>.
						</li>
						<li>
							Open-weights models that have been fine-tuned by the upstream
							provider. The license shown is the base license; fine-tune
							terms may add acceptable-use obligations.
						</li>
						<li>
							Models currently in private beta. Those are not on this page.
							Do not deploy them in a commercial context until they appear
							here with a documented posture.
						</li>
					</ul>

					<blockquote>
						The 2025 settlement in <em>Doe v. GitHub</em> did not establish
						that AI-generated code is generally copyright-safe. It established
						that filtering and attribution options must be offered. OMA
						surfaces both, here, and in the per-request <code>audit-log</code>.
					</blockquote>

					<h2>Update cadence</h2>
					<p>
						This page is updated when the model catalog changes. The
						<code>v2026-07-07</code> stamp above is the publication version
						and is part of the URL fragment when linking into the changelog.
					</p>
				</section>
			</div>
		</div>
	);
}

function PillarCard({
	icon,
	title,
	body,
}: {
	icon: React.ReactNode;
	title: string;
	body: string;
}) {
	return (
		<div className="border border-border bg-surface p-5">
			<div className="flex items-center gap-2 mb-2 text-accent">
				{icon}
				<h3 className="font-mono text-[11px] uppercase tracking-widest text-text-bright">
					{title}
				</h3>
			</div>
			<p className="text-text-secondary text-[13px] leading-relaxed">{body}</p>
		</div>
	);
}

function tierBadge(t: ModelProvenance["posture"]) {
	const cls =
		t === "isolated"
			? "legal-badge legal-badge--ok"
			: t === "open-weights"
				? "legal-badge legal-badge--warn"
				: "legal-badge";
	return cls;
}

function filterBadge(f: ModelProvenance["filter"]) {
	const cls =
		f === "strict"
			? "legal-badge legal-badge--ok"
			: f === "moderate"
				? "legal-badge legal-badge--warn"
				: "legal-badge legal-badge--risk";
	return cls;
}

function indemnityBadge(i: ModelProvenance["indemnity"]) {
	const cls =
		i === "covered"
			? "legal-badge legal-badge--ok"
			: i === "limited"
				? "legal-badge legal-badge--warn"
				: "legal-badge legal-badge--risk";
	return cls;
}