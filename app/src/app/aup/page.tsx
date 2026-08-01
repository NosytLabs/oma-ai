/* OMA · Acceptable Use Policy (AUP) page
 * conversational legal layout · sections: hero · summary · prohibited uses · enforcement · appeals · contact
 * copy: plain English summary at the top, active voice, no marketing slop
 */

import {
	ArrowLeft,
	CircleAlert,
	CircleX,
	Lock,
	Shield,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Acceptable Use Policy",
	description:
		"OMA platform safety rules, prohibited activities, abuse enforcement, and account appeal procedure. Use OMA legally and responsibly.",
	alternates: { canonical: "/aup" },
	openGraph: {
		title: "Acceptable Use Policy · OMA",
		description:
			"OMA platform safety rules, prohibited activities, abuse enforcement, and account appeal procedure. Use OMA legally and responsibly.",
		images: [{ url: "/og-image.webp", width: 1280, height: 720, alt: "OMA AUP" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "Acceptable Use Policy · OMA",
		description:
			"OMA platform safety rules, prohibited activities, abuse enforcement, and account appeal procedure.",
		images: ["/og-image.webp"],
	},
	robots: { index: true, follow: true },
};

const ISSUED = "2026-08-01";

function StatusDot() {
	const color = "var(--color-accent)";
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

export default function AupPage() {
	return (
		<div className="min-h-screen bg-void text-text-secondary font-mono selection:bg-accent-dim selection:text-accent">
			<div className="overflow-x-clip">
				<div className="flex flex-col">
					{/* ===== HERO ===== */}
					<section className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 pt-4 sm:pt-6 pb-10 sm:pb-14">
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
									Platform safety
								</span>

								<h1
									className="h1-page text-text-bright mt-6"
									style={{
										overflowWrap: "anywhere",
										minWidth: 0,
										textWrap: "balance",
									}}
								>
									<span className="block">Acceptable use</span>
									<span className="block text-accent">guidelines.</span>
								</h1>

								{/* Plain English summary */}
								<div className="mt-6 rounded-xl border border-accent/20 bg-accent/5 p-5 sm:p-6">
									<p className="text-[11px] font-semibold uppercase tracking-wide text-accent mb-2">
										The short version
									</p>
									<p className="text-[14px] sm:text-[15px] text-text-bright leading-relaxed">
										OMA is an open gateway, but we strictly enforce safety boundaries to protect
										our users, our upstream providers, and the integrity of our infrastructure.
									</p>
									<p className="mt-3 text-[13.5px] sm:text-[14px] text-text-secondary leading-relaxed">
										We do not permit the generation of malicious code, deceptive spam, illegal
										content, CSAM, state-sponsored cyberattacks, or actions attempting to DDoS or
										bypass OMA's credit or settlement systems. Violating these rules results in
										immediate account suspension and credit forfeiture.
									</p>
								</div>
							</div>

							<aside
								aria-label="Policy metadata"
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
										<span className="sr-only">Status: </span>active
									</span>
								</div>
								<dl className="text-[12px]">
									{[
										["Policy", "Acceptable Use Policy"],
										["Scope", "All API & Chat calls"],
										["Enforcement", "Keys revocation"],
										["Appeals", "via Support Email"],
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
										href="mailto:support@nosytlabs.com"
										className="text-accent hover:underline underline-offset-2"
									>
										support@nosytlabs.com
									</a>
								</div>
							</aside>
						</div>
					</section>

					{/* ===== PROHIBITED USES ===== */}
					<section
						id="prohibited"
						className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
					>
						<SectionHeading title="Prohibited uses" meta="What is strictly forbidden" />

						<p className="text-[13px] sm:text-sm text-text-secondary max-w-2xl mb-5">
							You must not use the OMA gateway, platform, or API endpoints to generate or facilitate
							any of the following categories of content or activity:
						</p>

						<div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
							<div className="border border-border bg-surface p-5 rounded-xl">
								<div className="mb-3 flex items-center gap-2">
									<CircleX className="h-4 w-4 text-error" aria-hidden="true" />
									<h3 className="text-[13px] font-semibold text-text-bright">
										Harmful & Illegal Activities
									</h3>
								</div>
								<ul className="space-y-3">
									<RulePoint
										term="Illegal Content"
										detail="CSAM, CSAE, child exploitation, or human trafficking."
										tone="error"
									/>
									<RulePoint
										term="Malware & Cyberattacks"
										detail="Writing, optimizing, or distributing ransomware, exploits, or viruses."
										tone="error"
									/>
									<RulePoint
										term="Physical Harm"
										detail="Facilitating weapon creation, violence planning, or self-harm encouragement."
										tone="error"
									/>
									<RulePoint
										term="Deception & Fraud"
										detail="Phishing generation, deepfakes for fraud, or impersonating individuals."
										tone="error"
									/>
								</ul>
							</div>

							<div className="border border-border bg-surface p-5 rounded-xl">
								<div className="mb-3 flex items-center gap-2">
									<Lock className="h-4 w-4 text-warning" aria-hidden="true" />
									<h3 className="text-[13px] font-semibold text-text-bright">
										Infrastructure & Abuse Rules
									</h3>
								</div>
								<ul className="space-y-3">
									<RulePoint
										term="Double Spending"
										detail="Attempting duplicate USDC settlement claims."
										tone="warning"
									/>
									<RulePoint
										term="Replay Attacks"
										detail="Submitting identical signed payloads or nonces to bypass metering."
										tone="warning"
									/>
									<RulePoint
										term="Denial of Service"
										detail="DDoSing, brute-forcing, or probe-attacking the API endpoints."
										tone="warning"
									/>
									<RulePoint
										term="Evasion"
										detail="Circumventing credit depletion checks or rate limits."
										tone="warning"
									/>
								</ul>
							</div>
						</div>
					</section>

					{/* ===== ENFORCEMENT ===== */}
					<section
						id="enforcement"
						className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
					>
						<SectionHeading title="Enforcement and actions" meta="How we handle violations" />

						<div className="border border-border bg-surface p-5">
							<p className="text-[13px] sm:text-sm text-text-secondary leading-relaxed">
								If we detect or receive alerts regarding AUP violations on your account or API keys:
							</p>
							<ul className="mt-4 space-y-3">
								<RulePoint
									term="Suspension"
									detail="Your account is suspended immediately, disabling login and API capabilities."
									tone="error"
								/>
								<RulePoint
									term="Revocation"
									detail="All active API keys issued under your account are revoked with no recovery."
									tone="error"
								/>
								<RulePoint
									term="Credit Forfeiture"
									detail="All remaining credit balances on OMA are permanently forfeited."
									tone="error"
								/>
								<RulePoint
									term="Referral"
									detail="Severe illegal activities will be reported to appropriate law enforcement authorities."
									tone="error"
								/>
							</ul>
						</div>
					</section>

					{/* ===== APPEALS ===== */}
					<section
						id="appeals"
						className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
					>
						<SectionHeading title="Appeals procedure" meta="How to appeal a suspension" />

						<div className="border border-border bg-surface p-5">
							<p className="text-[13px] sm:text-sm text-text-secondary leading-relaxed">
								If you believe your account was suspended in error, you may file an appeal by contacting support:
							</p>
							<div className="mt-4 p-4 border border-accent/20 bg-accent/5 rounded-lg">
								<p className="text-[13px] text-text-secondary leading-relaxed">
									Please email <a href="mailto:support@nosytlabs.com" className="text-accent hover:underline">support@nosytlabs.com</a> with:
								</p>
								<ul className="mt-2 space-y-2 list-disc list-inside text-xs text-text-muted">
									<li>Your wallet address or account ID</li>
									<li>A brief description of your API use case and calling pattern</li>
									<li>Any relevant logs or context showing false-positive detection</li>
								</ul>
							</div>
							<p className="mt-4 text-xs text-text-tertiary">
								Appeals are reviewed by a human moderator. Most decisions are resolved within 5 business days.
							</p>
						</div>
					</section>

					{/* ===== FOOTER NAV ===== */}
					<section
						aria-label="Related documents"
						className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12"
					>
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<p className="text-[11px] sm:text-xs text-text-muted">
								Questions?{" "}
								<a
									href="mailto:support@nosytlabs.com"
									className="text-accent hover:underline underline-offset-2"
								>
									support@nosytlabs.com
								</a>
							</p>
							<ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] sm:text-xs">
								{[
									{ href: "/terms", label: "Terms" },
									{ href: "/privacy", label: "Privacy" },
									{ href: "/pricing", label: "Pricing" },
									{ href: "/docs", label: "Docs" },
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
				</div>
			</div>
		</div>
	);
}
