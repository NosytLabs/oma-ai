/* OMA · Disclosures page
 * conversational legal layout · sections: hero · funding · risk · insurance · contact
 * copy: plain English disclosures, active voice, no invented metrics
 */

import { ArrowLeft, CircleX, Shield } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StatusDot } from "@/components/ui/StatusDot";

export const metadata: Metadata = {
	title: "Disclosures",
	description:
		"OMA AI investor disclosures, risk factors, and regulatory notices. Transparent about funding, operations, and limitations.",
	alternates: { canonical: "/disclosures" },
	openGraph: {
		title: "Disclosures",
		description:
			"OMA AI investor disclosures, risk factors, and regulatory notices. Transparent about funding, operations, and limitations.",
	},
	twitter: {
		card: "summary_large_image",
		title: "Disclosures",
		description:
			"OMA AI investor disclosures, risk factors, and regulatory notices.",
	},
};

const ISSUED = "2026-06-28";

const SECTIONS = [
	{
		idx: "01",
		id: "funding",
		title: "Funding & structure",
		meta: "how OMA is financed",
	},
	{
		idx: "02",
		id: "risk",
		title: "Risk factors",
		meta: "what to understand before using the service",
	},
	{
		idx: "03",
		id: "insurance",
		title: "Insurance & coverage",
		meta: "what is and is not covered",
	},
] as const;

function SectionHeading({ title, meta }: { title: string; meta?: string }) {
	return (
		<header className="mb-5 sm:mb-7">
			<h2 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-bright">
				{title}
			</h2>
			{meta && (
				<p className="mt-1.5 text-[13px] sm:text-[14px] text-text-muted">
					{meta}
				</p>
			)}
		</header>
	);
}

function RulePoint({
	term,
	detail,
	tone = "default",
}: {
	term?: string;
	detail: string;
	tone?: "default" | "warning" | "error";
}) {
	const dot =
		tone === "error"
			? "var(--color-error)"
			: tone === "warning"
				? "var(--color-warning)"
				: "var(--color-accent)";
	return (
		<li className="flex items-start gap-3">
			<span
				className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
				style={{ backgroundColor: dot }}
				aria-hidden="true"
			/>
			<span className="text-[13px] text-text-secondary leading-relaxed">
				{term && (
					<span className="font-semibold text-text-bright">{term}: </span>
				)}
				{detail}
			</span>
		</li>
	);
}

export default function DisclosuresPage() {
	return (
		<div className="min-h-dvh bg-void text-text-secondary font-mono selection:bg-accent-dim selection:text-accent">
			<div className="overflow-x-clip">
				<div className="flex flex-col">
					{/* ===== HERO ===== */}
					<section className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-12 sm:pt-20 pb-10 sm:pb-14">
						<Link
							href="/"
							className="mb-6 inline-flex items-center gap-2 text-[12.5px] text-text-muted hover:text-accent transition-colors"
						>
							<ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
							Back to home
						</Link>

						<div className="grid gap-8 lg:gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] items-start">
							<div className="min-w-0">
								<span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent">
									<span
										className="h-1.5 w-1.5 rounded-full bg-accent"
										aria-hidden="true"
									/>
									Disclosures
								</span>

								<h1
									className="h1-page text-text-bright mt-6"
									style={{
										overflowWrap: "anywhere",
										minWidth: 0,
										textWrap: "balance",
									}}
								>
									<span className="block">What you should</span>
									<span className="block text-accent">know about OMA.</span>
								</h1>

								{/* Plain English summary */}
								<div className="mt-6 rounded-xl border border-accent/20 bg-accent/5 p-5 sm:p-6">
									<p className="text-[11px] font-semibold uppercase tracking-wide text-accent mb-2">
										The short version
									</p>
									<p className="text-[14px] sm:text-[15px] text-text-bright leading-relaxed">
										OMA is a small operation. We do not take venture capital, we
										do not sell user data, and we do not have a board of
										directors.
									</p>
									<p className="mt-3 text-[13.5px] sm:text-[14px] text-text-secondary leading-relaxed">
										This page documents the material facts about how OMA is
										funded, what risks exist for users, and what protections are
										(and are not) in place. If anything is unclear, reach out
										and we will clarify.
									</p>
								</div>
							</div>

							<aside
								aria-label="Document metadata"
								className="border border-border bg-surface min-w-0 relative overflow-hidden rounded-xl"
							>
								<span
									aria-hidden="true"
									className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent opacity-60"
								/>
								<div className="px-4 py-2.5 border-b border-border bg-panel flex items-center justify-between">
									<span className="text-[12px] font-semibold text-text-bright">
										At a glance
									</span>
									<span className="flex items-center gap-1.5 text-[11px] text-accent">
										<StatusDot />
										<span className="sr-only">Status: </span>current
									</span>
								</div>
								<dl className="text-[12px]">
									{[
										["Form", "Disclosures"],
										["Funding", "Self-funded · no VC"],
										["Audience", "Users & operators"],
										["Effective", ISSUED],
									].map(([k, v]) => (
										<div
											key={k}
											className="grid grid-cols-2 gap-2 px-4 py-2 border-b border-border last:border-b-0"
										>
											<dt className="text-text-muted text-[11.5px]">{k}</dt>
											<dd className="text-text-secondary tabular-nums truncate text-right">
												{v}
											</dd>
										</div>
									))}
								</dl>
								<div className="px-4 py-2.5 border-t border-border text-[11px] text-text-tertiary">
									Questions?{" "}
									<a
										href="mailto:legal@oma-ai.com"
										className="text-accent hover:underline underline-offset-2"
									>
										legal@oma-ai.com
									</a>
								</div>
							</aside>
						</div>
					</section>

					{/* ===== FUNDING ===== */}
					<section
						id="funding"
						aria-labelledby="funding-heading"
						className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
					>
						<SectionHeading
							title="Funding & structure"
							meta="How OMA is financed"
						/>
						<h3 id="funding-heading" className="sr-only">
							Funding and corporate structure
						</h3>

						<p className="text-[13px] sm:text-sm text-text-secondary max-w-2xl mb-5">
							OMA AI operates as a self-funded entity. We do not accept venture
							capital, private equity, or institutional investment. Revenue
							comes exclusively from API usage fees paid by users:
						</p>

						<div className="border border-border bg-surface p-5">
							<ul className="space-y-3">
								<RulePoint
									term="Self-funded"
									detail="OMA is operated without external investment. All infrastructure and operating costs are covered by usage revenue."
								/>
								<RulePoint
									term="No VC"
									detail="We do not have venture capital backing, institutional investors, or a board of directors."
								/>
								<RulePoint
									term="Revenue"
									detail="The only source of revenue is per-request API usage fees, settled in USDC on Base."
								/>
								<RulePoint
									term="No data monetization"
									detail="User prompts, outputs, and usage patterns are never sold, licensed, or monetized."
								/>
							</ul>
						</div>
					</section>

					{/* ===== RISK ===== */}
					<section
						id="risk"
						aria-labelledby="risk-heading"
						className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
					>
						<SectionHeading
							title="Risk factors"
							meta="What to understand before using the service"
						/>
						<h3 id="risk-heading" className="sr-only">
							Risk factors
						</h3>

						<p className="text-[13px] sm:text-sm text-text-secondary max-w-2xl mb-5">
							As with any early-stage infrastructure service, there are risks
							you should understand before relying on OMA for production
							workloads:
						</p>

						<div className="grid gap-3 sm:grid-cols-2">
							<div className="border border-border bg-surface p-5 rounded-xl">
								<div className="mb-3 flex items-center gap-2">
									<CircleX className="h-4 w-4 text-error" aria-hidden="true" />
									<h3 className="text-[13px] font-semibold text-text-bright">
										Operational risks
									</h3>
								</div>
								<ul className="space-y-3">
									<RulePoint
										detail="Uptime is best-effort. There are no SLAs or uptime guarantees."
										tone="error"
									/>
									<RulePoint
										detail="Model availability depends on upstream providers."
										tone="error"
									/>
									<RulePoint
										detail="No dedicated support team. Issues are handled on a best-effort basis."
										tone="error"
									/>
									<RulePoint
										detail="Credit balances are non-redeemable and non-transferable."
										tone="error"
									/>
								</ul>
							</div>
							<div className="border border-border bg-surface p-5 rounded-xl">
								<div className="mb-3 flex items-center gap-2">
									<Shield className="h-4 w-4 text-accent" aria-hidden="true" />
									<h3 className="text-[13px] font-semibold text-text-bright">
										What mitigates these risks
									</h3>
								</div>
								<ul className="space-y-3">
									<RulePoint detail="Multi-provider routing with automatic failover." />
									<RulePoint detail="Source-available code. The entire stack is visible." />
									<RulePoint detail="On-chain settlement. Every transaction is verifiable." />
									<RulePoint detail="No lock-in. OpenAI-compatible API means you can switch at any time." />
								</ul>
							</div>
						</div>
					</section>

					{/* ===== INSURANCE ===== */}
					<section
						id="insurance"
						aria-labelledby="insurance-heading"
						className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
					>
						<SectionHeading
							title="Insurance & coverage"
							meta="What is and is not covered"
						/>
						<h3 id="insurance-heading" className="sr-only">
							Insurance and financial coverage
						</h3>

						<p className="text-[13px] sm:text-sm text-text-secondary max-w-2xl mb-5">
							OMA maintains standard operational coverage for infrastructure and
							liability, but users should be aware of the limits:
						</p>

						<div className="border border-border bg-surface p-5">
							<ul className="space-y-3">
								<RulePoint
									term="Infrastructure"
									detail="Standard hosting and liability insurance covering our own operations."
								/>
								<RulePoint
									term="User funds"
									detail="User credit balances are not insured or guaranteed. Deposits are held as on-chain USDC and debited per request."
								/>
								<RulePoint
									term="No FDIC"
									detail="Credit balances are not FDIC-insured or equivalent. They are operational prepayments, not bank deposits."
								/>
								<RulePoint
									term="No guarantee"
									detail="We do not guarantee against upstream provider outages, smart contract risk, or chain reorganization events."
									tone="warning"
								/>
							</ul>
						</div>
					</section>

					{/* ===== CONTACT ===== */}
					<section
						aria-label="Contact"
						className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12"
					>
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<p className="text-[11px] sm:text-xs text-text-muted">
								Questions about these disclosures?{" "}
								<a
									href="mailto:legal@oma-ai.com"
									className="font-medium text-accent underline decoration-2 underline-offset-2 hover:no-underline"
								>
									legal@oma-ai.com
								</a>
								, or reach us via{" "}
								<Link
									href="/docs"
									className="font-medium text-accent underline decoration-2 underline-offset-2 hover:no-underline"
								>
									our docs
								</Link>
								.
							</p>
							<ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] sm:text-xs">
								{[
									{ href: "/terms", label: "Terms" },
									{ href: "/privacy", label: "Privacy" },
									{ href: "/about-us", label: "About" },
									{ href: "/pricing", label: "Pricing" },
									{ href: "/docs", label: "API docs" },
								].map((l) => (
									<li key={l.href}>
										<Link
											href={l.href}
											className="text-text-muted hover:text-accent transition-colors"
										>
											{l.label}
										</Link>
									</li>
								))}
							</ul>
						</div>
					</section>

					{/* Hidden TOC for crawlers & a11y */}
					<nav aria-label="Section index" className="sr-only">
						<ol>
							<li>
								<a href="#subject">Summary</a>
							</li>
							{SECTIONS.map((s) => (
								<li key={s.id}>
									<a href={`#${s.id}`}>{s.title}</a>
								</li>
							))}
						</ol>
					</nav>
				</div>
			</div>
		</div>
	);
}
