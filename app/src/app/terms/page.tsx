/* OMA · Terms page
 * conversational legal layout · sections: hero · summary · usage · acceptable use · liability · credits · termination · contact
 * copy: plain English summary at the top, active voice, no invented metrics
 */

// ISR: Revalidate every 24 hours (legal content, very rarely changes)
export const revalidate = 86400;
// Imports client visuals; opt out of static prerender.

import {
	ArrowLeft,
	CheckCircle2,
	CircleAlert,
	CircleX,
	Shield,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Terms of Service — OMA AI Gateway",
	description:
		"OMA API usage rules, acceptable use policy, credit mechanics, and account termination. Pay by card or in USDC, no sales funnel.",
	alternates: { canonical: "/terms" },
	openGraph: {
		title: "Terms · OMA",
		description:
			"OMA API usage rules, acceptable use policy, credit mechanics, and account termination. Pay by card or in USDC, no sales funnel.",
		images: [{ url: "/og-image.webp", width: 1280, height: 720, alt: "OMA Terms" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "Terms · OMA",
		description:
			"OMA API usage rules, acceptable use policy, credit mechanics, and account termination.",
		images: ["/og-image.webp"],
	},
	robots: { index: true, follow: true },
};

const ISSUED = "2026-08-01";

const SECTIONS = [
	{ idx: "02", id: "usage", title: "Usage", meta: "api rules" },
	{
		idx: "03",
		id: "acceptable-use",
		title: "Acceptable use",
		meta: "what is not allowed",
	},
	{
		idx: "04",
		id: "liability",
		title: "Liability",
		meta: "no uptime warranty",
	},
	{
		idx: "05",
		id: "credits",
		title: "Credits",
		meta: "non-redeemable · never expire",
	},
	{ idx: "06", id: "termination", title: "Termination", meta: "for cause" },
] as const;

function StatusDot({
	tone = "accent",
}: {
	tone?: "accent" | "warning" | "error";
}) {
	const color =
		tone === "warning"
			? "var(--color-warning)"
			: tone === "error"
				? "var(--color-error)"
				: "var(--color-accent)";
	return (
		<span
			className="relative inline-flex h-1.5 w-1.5 shrink-0"
			aria-hidden="true"
		>
			<span
				className="absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping"
				style={{ backgroundColor: color }}
			/>
			<span
				className="relative inline-flex rounded-full h-1.5 w-1.5"
				style={{ backgroundColor: color }}
			/>
		</span>
	);
}

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

export default function TermsPage() {
	return (
		<div className="min-h-screen bg-void text-text-secondary font-mono selection:bg-accent-dim selection:text-accent">
			<div className="overflow-x-clip">
				<div className="flex flex-col">
					{/* ===== HERO ===== */}
					<section className="container-page pt-4 sm:pt-6 pb-10 sm:pb-14">
						<Link
							href="/"
							className="mb-6 inline-flex items-center gap-2 text-[12.5px] text-text-muted hover:text-accent transition-colors duration-200 ease-out"
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
									Terms of service
								</span>

								<h1
									className="h1-page text-text-bright mt-6"
									style={{
										overflowWrap: "anywhere",
										minWidth: 0,
										textWrap: "balance",
									}}
								>
									<span className="block">Pay per call,</span>
									<span className="block text-accent">no sales call.</span>
								</h1>

								{/* Plain English summary */}
								<div className="mt-6 rounded-[var(--radius-xl)] border border-accent/20 bg-accent/5 p-5 sm:p-6">
									<p className="text-[11px] font-semibold uppercase tracking-wide text-accent mb-2">
										The short version
									</p>
									<p className="text-[14px] sm:text-[15px] text-text-bright leading-relaxed">
										OMA gives you access to text generation, chat, image
										generation, and video generation through an
										OpenAI-compatible API.
									</p>
									<p className="mt-3 text-[13.5px] sm:text-[14px] text-text-secondary leading-relaxed">
										By using the service you agree to a small set of
										common-sense rules below: use it legally, don&apos;t abuse
										the infra, and understand that credits don&apos;t convert
										back to USDC. We don&apos;t promise uptime, we don&apos;t
										sell your data, and we don&apos;t require an account to
										start.
									</p>
								</div>

								<div className="mt-7 border border-warning/30 bg-warning/5 p-4 sm:p-5 flex items-start gap-3 rounded-[var(--radius-lg)]">
									<CircleAlert
										className="h-5 w-5 shrink-0 text-warning mt-0.5"
										aria-hidden="true"
									/>
									<p className="text-[13px] sm:text-[14px] text-text-secondary leading-relaxed">
										<span className="font-semibold text-warning">
											Important:
										</span>{""}
										By using OMA you agree to these Terms. If you do not agree,
										please don&apos;t use the service.
									</p>
								</div>
							</div>

							<aside
								aria-label="Document metadata"
								className="border border-border bg-surface min-w-0 relative overflow-hidden rounded-[var(--radius-xl)]"
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
										<span className="sr-only">Status: </span>active
									</span>
								</div>
								<dl className="text-[12px]">
									{[
										["Form", "API Terms of Service"],
										["Operator", "NosytLabs"],
										["Auth", "Wallet · SIWE"],
										["Settlement", "USDC · Base"],
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
									Questions?{""}
									<a
										href="mailto:hi@nosytlabs.com"
										className="text-accent hover:underline underline-offset-2"
									>
										hi@nosytlabs.com
									</a>
								</div>
							</aside>
						</div>
					</section>

					{/* ===== USAGE ===== */}
					<section
						id="usage"
						aria-labelledby="usage-heading"
						className="border-t border-border container-page py-12 sm:py-16"
					>
						<SectionHeading title="Usage" meta="The API rules" />
						<h3 id="usage-heading" className="sr-only">
							API usage rules
						</h3>

						<p className="text-[13px] sm:text-sm text-text-secondary max-w-2xl mb-5">
							The OMA AI API gives you access to text generation, chat,
							image generation, and video generation. By using the API you
							agree to:
						</p>

						<div className="border border-border bg-surface p-5">
							<ul className="space-y-3">
								<RulePoint
									term="Lawful"
									detail="Use the API only for lawful purposes."
								/>
								<RulePoint
									term="Rate limits"
									detail="Do not exceed rate limits or abuse the service."
								/>
								<RulePoint
									term="No resale"
									detail="Do not resell or redistribute API access without written permission."
								/>
								<RulePoint
									term="Key custody"
									detail="Keep your API keys secure. You are responsible for everything that happens under your account."
								/>
							</ul>
						</div>
					</section>

					{/* ===== ACCEPTABLE USE ===== */}
					<section
						id="acceptable-use"
						aria-labelledby="acceptable-use-heading"
						className="border-t border-border container-page py-12 sm:py-16"
					>
						<SectionHeading
							title="Acceptable use"
							meta="What you can and cannot do"
						/>
						<h3 id="acceptable-use-heading" className="sr-only">
							Acceptable use policy
						</h3>

						<p className="text-[13px] sm:text-sm text-text-secondary max-w-2xl mb-5">
							Do not use OMA AI services for any of the following:
						</p>

						<div className="grid gap-3 sm:grid-cols-2">
							<div className="border border-border bg-surface p-5 rounded-[var(--radius-xl)]">
								<div className="mb-3 flex items-center gap-2">
									<CircleX className="h-4 w-4 text-error" aria-hidden="true" />
									<h3 className="text-[13px] font-semibold text-text-bright">
										What is not allowed
									</h3>
								</div>
								<ul className="space-y-3">
									<RulePoint
										detail="Anything illegal, harmful, or malicious."
										tone="error"
									/>
									<RulePoint
										detail="Generating offensive or defamatory content."
										tone="error"
									/>
									<RulePoint
										detail="Automated spam or mass text generation."
										tone="error"
									/>
									<RulePoint
										detail="Training competing AI models without permission."
										tone="error"
									/>
									<RulePoint
										detail="Probing or attacking our infrastructure."
										tone="error"
									/>
								</ul>
							</div>
							<div className="border border-border bg-surface p-5 rounded-[var(--radius-xl)]">
								<div className="mb-3 flex items-center gap-2">
									<Shield className="h-4 w-4 text-accent" aria-hidden="true" />
									<h3 className="text-[13px] font-semibold text-text-bright">
										What you can build
									</h3>
								</div>
								<ul className="space-y-3">
									<RulePoint detail="Production applications and APIs that call OMA." />
									<RulePoint detail="Internal tools, batch jobs, and CI workloads." />
									<RulePoint detail="Products that surface model output to end users." />
									<RulePoint detail="Research and evaluation against your own benchmarks." />
									<RulePoint detail="Workflows that chain models with your own code." />
								</ul>
							</div>
						</div>
					</section>

					{/* ===== LIABILITY ===== */}
					<section
						id="liability"
						aria-labelledby="liability-heading"
						className="border-t border-border container-page py-12 sm:py-16"
					>
						<SectionHeading title="Liability" meta="No uptime warranty" />
						<h3 id="liability-heading" className="sr-only">
							Limitations of liability
						</h3>

						<p className="text-[13px] sm:text-sm text-text-secondary max-w-2xl mb-5">
							OMA AI provides services &quot;AS IS&quot;. We do not guarantee:
						</p>

						<div className="border border-border bg-surface p-5">
							<ul className="space-y-3">
								<RulePoint
									term="Uptime"
									detail="Continuous availability of the API or any specific model."
									tone="warning"
								/>
								<RulePoint
									term="Accuracy"
									detail="Fitness or correctness of model output for any particular use."
									tone="warning"
								/>
								<RulePoint
									term="Errors"
									detail="Error-free operation or absence of defects."
									tone="warning"
								/>
							</ul>
							<p className="mt-5 text-[12.5px] sm:text-[13px] text-text-secondary leading-relaxed">
								OMA is not liable for any indirect, incidental, special, or
								consequential damages from using the service, including lost
								profits, data, or any other loss, even if OMA was advised of the
								possibility of such damages.
							</p>
						</div>
					</section>

					{/* ===== CREDITS ===== */}
					<section
						id="credits"
						aria-labelledby="credits-heading"
						className="border-t border-border container-page py-12 sm:py-16"
					>
						<SectionHeading
							title="Credits"
							meta="Non-redeemable, never expire"
						/>
						<h3 id="credits-heading" className="sr-only">
							Credit system
						</h3>

						<ul className="border border-border bg-surface divide-y divide-border">
							{[
								[
									"Non-redeemable",
									"Credits are not redeemable for cash and are non-transferable. They do not expire.",
								],
								[
									"Per-token deduction",
									"Credits are consumed per token processed and are deducted in real time at settlement.",
								],
								[
									"Deposit bonus",
									"Selected deposit methods may include a bonus subject to circuit-breaker conditions.",
								],
								[
									"Volume discounts",
									"Volume discounts apply to inference costs for high-usage accounts.",
								],
								[
									"Card billing",
									"One-time card purchases via  appear as 'NOSYT' on your statement.",
								],
							].map(([title, body], i) => (
								<li
									key={title}
									className="grid grid-cols-[2.5rem_minmax(0,1fr)] sm:grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3 px-3 sm:px-4 py-3"
								>
									<span className="text-[10px] text-text-tertiary tabular-nums">
										{String(i + 1).padStart(2, "0")}
									</span>
									<span className="text-[13px] sm:text-sm text-text-bright">
										{title}
									</span>
									<span className="hidden sm:inline text-[11px] sm:text-xs text-text-muted">
										{body}
									</span>
								</li>
							))}
						</ul>
					</section>

					{/* ===== TERMINATION ===== */}
					<section
						id="termination"
						aria-labelledby="termination-heading"
						className="border-t border-border container-page py-12 sm:py-16"
					>
						<SectionHeading
							title="Termination"
							meta="When accounts get suspended"
						/>
						<h3 id="termination-heading" className="sr-only">
							Account termination
						</h3>

						<p className="text-[13px] sm:text-sm text-text-secondary max-w-2xl mb-5">
							OMA may suspend or terminate accounts that violate these Terms,
							abuse the service, or pose a risk to our infrastructure or other
							users. When that happens:
						</p>

						<div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
							<div className="border border-border bg-surface p-5 rounded-[var(--radius-xl)]">
								<div className="mb-3 flex items-center gap-2">
									<CircleX className="h-4 w-4 text-error" aria-hidden="true" />
									<h3 className="text-[13px] font-semibold text-text-bright">
										What happens on suspension
									</h3>
								</div>
								<ul className="space-y-3">
									<RulePoint
										detail="All remaining credits are forfeited."
										tone="error"
									/>
									<RulePoint
										detail="API keys are revoked immediately."
										tone="error"
									/>
									<RulePoint
										detail="Unused credits are forfeited upon termination."
										tone="error"
									/>
								</ul>
							</div>
							<div className="border border-border bg-surface p-5 rounded-[var(--radius-xl)]">
								<div className="mb-3 flex items-center gap-2">
									<CheckCircle2
										className="h-4 w-4 text-accent"
										aria-hidden="true"
									/>
									<h3 className="text-[13px] font-semibold text-text-bright">
										You can also leave anytime
									</h3>
								</div>
								<ul className="space-y-3">
									<RulePoint detail="Delete your account at any time from the dashboard." />
									<RulePoint detail="Outstanding usage is settled before deletion." />
									<RulePoint detail="On-chain deposits are not reversible." />
								</ul>
							</div>
						</div>
					</section>

					{/* ===== CONTACT ===== */}
					<section
						aria-label="Contact"
						className="border-t border-border container-page py-10 sm:py-12"
					>
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<p className="text-[11px] sm:text-xs text-text-muted">
								Questions about these Terms?{""}
								<a
									href="mailto:hi@nosytlabs.com"
									className="font-medium text-accent underline decoration-2 underline-offset-2 hover:no-underline"
								>
									hi@nosytlabs.com
								</a>
								, or reach us via{""}
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
									{ href: "/privacy", label: "Privacy" },
									{ href: "/", label: "Home" },
									{ href: "/pricing", label: "Pricing" },
									{ href: "/docs", label: "API docs" },
								].map((l) => (
									<li key={l.href}>
										<Link
											href={l.href}
											className="text-text-muted hover:text-accent transition-colors duration-200 ease-out"
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
