/* OMA · Privacy page
	* conversational legal layout · sections: hero · summary · collection · auth · logs · retention · third parties · rights · contact
	* copy: plain English summary at the top, active voice
	*/

export const revalidate = 86400;

import {
	ArrowLeft,
	CheckCircle2,
	CircleAlert,
	CircleX,
	CreditCard,
	Database,
	Eye,
	Lock,
	Shield,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/app/_components/page-shell";
import { PRIVACY_MANIFEST, PRIVACY_RETENTION, PRIVACY_UPDATED } from "@/lib/privacy-manifest";

const PRIVACY_DESCRIPTION =
	"The OMA gateway does not save prompts or responses. Website chat history stays in your browser; inference-provider policies vary.";

export const metadata: Metadata = {
	title: "Privacy — OMA AI Gateway",
	description: PRIVACY_DESCRIPTION,
	alternates: { canonical: "/privacy" },
	openGraph: {
		locale: "en_US",
		title: "Privacy · OMA",
		description: PRIVACY_DESCRIPTION,
		url: "/privacy",
		images: [{ url: "/og-image.png", width: 1280, height: 720, alt: "OMA Privacy" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "Privacy · OMA",
		description: PRIVACY_DESCRIPTION,
		images: ["/og-image.png"],
	},
	robots: { index: true, follow: true },
};

const ISSUED = PRIVACY_UPDATED;

const SECTIONS = [
	{ idx: "02", id: "collection", title: "Collection", meta: "what we keep" },
	{ idx: "03", id: "auth", title: "Authentication", meta: "email or wallet" },
	{
		idx: "04",
		id: "logs",
		title: "Logs and billing",
		meta: "metering records",
	},
	{ idx: "05", id: "retention", title: "Retention", meta: "how long" },
	{
		idx: "06",
		id: "third-parties",
		title: "Third parties",
		meta: "who sees what",
	},
	{
		idx: "07",
		id: "subprocessors",
		title: "Sub-processors",
		meta: "operational vendors",
	},
	{ idx: "08", id: "rights", title: "Your rights", meta: "what you control" },
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

function SectionHeading({
	id,
	index,
	title,
	meta,
}: {
	id?: string;
	index?: string;
	title: string;
	meta?: string;
}) {
	return (
		<header className="mb-5 sm:mb-7">
			<h2
				id={id}
				className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-bright"
			>
				{index && (
					<span className="text-accent mr-2 tabular-nums">{index}</span>
				)}
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

function DataPoint({
	term,
	detail,
	tone = "default",
}: {
	term: string;
	detail: string;
	tone?: "default" | "warning";
}) {
	const dot =
		tone === "warning" ? "var(--color-warning)" : "var(--color-accent)";
	return (
		<li className="flex items-start gap-3">
			<span
				className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
				style={{ backgroundColor: dot }}
				aria-hidden="true"
			/>
			<span className="text-[13px] text-text-secondary leading-relaxed">
				<span className="font-semibold text-text-bright">{term}:</span> {detail}
			</span>
		</li>
	);
}

export default function PrivacyPage() {
	return (
		<div className="bg-void text-text-secondary font-mono selection:bg-accent-dim selection:text-accent">
			<div className="overflow-x-clip">
				<div className="flex flex-col">
					{/* ===== HERO ===== */}
					<PageShell className="max-w-6xl">
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
									<span className="eyebrow-caps">Privacy policy</span>
								</span>

								<h1
									className="h1-page text-text-bright mt-6"
									style={{
										overflowWrap: "anywhere",
										minWidth: 0,
										textWrap: "balance",
									}}
								>
									<span className="block">Minimal data,</span>
									<span className="block text-accent">no prompt logging.</span>
								</h1>

								{/* Plain English summary */}
								<div id="subject" className="mt-6 scroll-mt-24 rounded-[var(--radius-xl)] border border-accent/20 bg-accent/5 p-5 sm:p-6">
									<p className="text-[11px] font-semibold uppercase tracking-wide text-accent mb-2">
										The short version
									</p>
									<p className="text-[14px] sm:text-[15px] text-text-bright leading-relaxed">
										OMA collects the minimum data needed to run the service:
										the email address or wallet address you choose for sign-in,
										a SHA-256 hash of API keys, per-call usage records, and
										on-chain deposit or settlement identifiers.
									</p>
									<p className="mt-3 text-[13.5px] sm:text-[14px] text-text-secondary leading-relaxed">
										We do not sell personal information. The OMA gateway does not
										save prompt or completion content. Website conversations and
										drafts are saved in this browser. Request content is forwarded
										transiently to the selected inference provider so it can
										generate a response; provider handling is described below.
										You can export or delete the account data OMA stores from
										the dashboard.
									</p>
								</div>
							</div>

							<aside
								aria-label="At a glance"
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
										["Scope", "All OMA surfaces"],
										["Operator", "NosytLabs"],
										["Logging", "Metadata only"],
										["Sale of data", "Never"],
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
					</PageShell>

					{/* ===== COLLECTION ===== */}
					<section
						id="collection"
						aria-labelledby="collection-heading"
						className="border-t border-border-subtle container-page py-14 sm:py-18 lg:py-22"
					>
						<SectionHeading
							id="collection-heading"
							title="What we collect"
							meta="Account, usage and security records"
						/>

						<div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
							<div className="border border-border bg-surface p-5 rounded-[var(--radius-xl)]">
								<div className="mb-3 flex items-center gap-2">
									<Database
										className="h-4 w-4 text-accent"
										aria-hidden="true"
									/>
									<h3 className="text-[13px] font-semibold text-text-bright">
										What we store
									</h3>
								</div>
								<ul className="space-y-3">
									<DataPoint
										term="Email address"
										detail="Stored when you choose magic-link sign-in and used for authentication and account messages."
									/>
									<DataPoint
										term="Wallet address"
										detail="Used for authentication via SIWE (EVM) signatures."
									/>
									<DataPoint
										term="Session and audit metadata"
										detail="Can include IP addresses, user agents, timestamps and account actions."
									/>
									<DataPoint
										term="API usage"
										detail="Token counts and timestamps for billing."
									/>
									<DataPoint
										term="Transaction hashes"
										detail="For on-chain deposit verification."
									/>
									<DataPoint
										term="API keys"
										detail={PRIVACY_MANIFEST.data_stored.api_keys.description}
									/>
								</ul>
							</div>
							<div className="border border-border bg-surface p-5 rounded-[var(--radius-xl)]">
								<div className="mb-3 flex items-center gap-2">
									<CircleX className="h-4 w-4 text-error" aria-hidden="true" />
									<h3 className="text-[13px] font-semibold text-text-bright">
										What the OMA gateway does not persist
									</h3>
								</div>
								<ul className="space-y-3">
									<DataPoint
										term="Prompt text"
										detail="Request content is forwarded for inference without being saved by the gateway."
										tone="warning"
									/>
									<DataPoint
										term="Completion text"
										detail="Model output is streamed to you without being saved by the gateway. Website chat keeps a local copy in your browser."
										tone="warning"
									/>
									<DataPoint
										term="Private keys"
										detail="Signing stays in your wallet. OMA reads payment-relevant balances and transfer receipts to verify funding."
										tone="warning"
									/>
									<DataPoint
										term="Profile enrichment"
										detail="No legal name or demographic profile is required beyond the email or wallet identifier you choose for authentication."
										tone="warning"
									/>
								</ul>
							</div>
						</div>
					</section>

					{/* ===== AUTHENTICATION ===== */}
					<section
						id="auth"
						aria-labelledby="auth-heading"
						className="border-t border-border-subtle container-page py-14 sm:py-18 lg:py-22"
					>
						<SectionHeading
							id="auth-heading"
							title="Authentication"
							meta="Passwordless email or SIWE wallet"
						/>

						<p className="text-[13px] sm:text-sm text-text-secondary max-w-2xl mb-5">
							You can authenticate with a passwordless email magic link or
							Sign-In With Ethereum (SIWE). OMA stores the identifiers for the
							method you choose, together with session and security metadata.
						</p>

						<div className="border border-border bg-surface p-5">
							<ul className="space-y-3">
								<DataPoint
									term="Email sign-in"
									detail="Stores your email address so we can deliver magic links and account messages."
								/>
								<DataPoint
									term="Wallet sign-in"
									detail="Stores your public wallet address after you prove control with a SIWE signature."
								/>
								<DataPoint
									term="Usage attribution"
									detail="Associates token spend, keys, and credits with your account for billing."
								/>
							</ul>
							<p className="mt-5 text-[12.5px] sm:text-[13px] text-text-secondary leading-relaxed">
								If you use wallet sign-in, OMA does not crawl your wallet
								history or build a profile from unrelated on-chain activity.
							</p>
						</div>
					</section>

					{/* ===== LOGS AND BILLING ===== */}
					<section
						id="logs"
						aria-labelledby="logs-heading"
						className="border-t border-border-subtle container-page py-14 sm:py-18 lg:py-22"
					>
						<SectionHeading
							id="logs-heading"
							title="Logs and billing"
							meta="Usage and content handling"
						/>

						<div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
							<div className="border border-border bg-surface p-5 rounded-[var(--radius-xl)]">
								<div className="mb-3 flex items-center gap-2">
									<CreditCard
										className="h-4 w-4 text-accent"
										aria-hidden="true"
									/>
									<h3 className="text-[13px] font-semibold text-text-bright">
										For billing
									</h3>
								</div>
								<ul className="space-y-3">
									<DataPoint term="Model id" detail='e.g. "kimi-k3"' />
									<DataPoint
										term="Token counts"
										detail="Prompt and completion tokens per request."
									/>
									<DataPoint
										term="Cost in cents"
										detail="Computed at settlement time."
									/>
									<DataPoint
										term="Request timestamp"
										detail="UTC, to the second."
									/>
								</ul>
							</div>
							<div className="border border-border bg-surface p-5 rounded-[var(--radius-xl)]">
								<div className="mb-3 flex items-center gap-2">
									<Lock className="h-4 w-4 text-error" aria-hidden="true" />
									<h3 className="text-[13px] font-semibold text-text-bright">
										We do not log
									</h3>
								</div>
								<ul className="space-y-3">
									<DataPoint
										term="Prompt text"
										detail="The gateway does not include request content in usage logs."
										tone="warning"
									/>
									<DataPoint
										term="Completion text"
										detail="The gateway does not include response content in usage logs."
										tone="warning"
									/>
									<DataPoint
										term="Tool payloads"
										detail="Function-call arguments and outputs are not retained."
										tone="warning"
									/>
									<DataPoint
										term="File contents"
										detail="Uploaded files are processed transiently and dropped."
										tone="warning"
									/>
								</ul>
							</div>
						</div>
					</section>

					{/* ===== RETENTION ===== */}
					<section
						id="retention"
						aria-labelledby="retention-heading"
						className="border-t border-border-subtle container-page py-14 sm:py-18 lg:py-22"
					>
						<SectionHeading
							id="retention-heading"
							title="Retention"
							meta="How long we keep things"
						/>

						<p className="mb-5 max-w-2xl text-[13px] leading-relaxed text-text-secondary sm:text-sm">
							Website chat saves conversations, drafts, and preferences in this
							browser, with separate histories for guests and each signed-in
							account. History does not sync between devices. Manage, export,
							or delete threads from Chat history. Clear this site&apos;s browser
							data to remove all local copies and preferences. Account data
							exports and deletion apply to the server records listed below.
						</p>

						<ul className="border border-border bg-surface divide-y divide-border">
							{PRIVACY_RETENTION.map(([k, v, note]) => (
								<li
									key={k}
									className="grid grid-cols-[minmax(0,1fr)_8rem] sm:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)] items-center gap-3 px-3 sm:px-4 py-3"
								>
									<span className="text-[13px] sm:text-sm text-text-bright">
										{k}
									</span>
									<span className="text-[11px] sm:text-xs text-warning tabular-nums">
										{v}
									</span>
									<span className="col-span-2 text-[11px] text-text-muted sm:col-span-1 sm:text-xs">
										{note}
									</span>
								</li>
							))}
						</ul>
					</section>

					{/* ===== THIRD PARTIES ===== */}
					<section
						id="third-parties"
						aria-labelledby="third-parties-heading"
						className="border-t border-border-subtle container-page py-14 sm:py-18 lg:py-22"
					>
						<SectionHeading
							id="third-parties-heading"
							title="Third parties"
							meta="Who sees what"
						/>

						<p className="text-[13px] sm:text-sm text-text-secondary max-w-2xl mb-5">
							Inference cannot happen without sending request content to the
							service that runs the selected model. OMA forwards that content
							transiently for inference and does not persist it. Provider
							retention and privacy guarantees depend on the selected provider
							and model; review the provider terms for sensitive workloads.
						</p>

						<ul className="border border-border bg-surface divide-y divide-border">
							{[
								[
									"Venice AI",
									"Inference",
									"receives request content to run the selected model; Venice privacy mode and provider policies apply",
								],
								[
									"OMA-AI / OpenBroker",
									"Inference",
									"request content is processed by the Gonka/OpenBroker-backed model that serves the call",
								],
								["Base", "Settlement", "on-chain transaction verification"],
							].map(([name, role, note]) => (
								<li
									key={name}
									className="grid grid-cols-[minmax(0,1fr)_7rem] sm:grid-cols-[minmax(0,1fr)_9rem_minmax(0,1fr)] items-center gap-3 px-3 sm:px-4 py-3"
								>
									<span className="text-[13px] sm:text-sm text-text-bright">
										{name}
									</span>
									<span className="text-[12.5px] text-text-muted">{role}</span>
									<span className="col-span-2 text-[11px] text-text-muted sm:col-span-1 sm:text-xs">
										{note}
									</span>
								</li>
							))}
						</ul>
						<p className="mt-4 text-[11px] text-text-muted">
							<span className="text-accent" aria-hidden="true">
								~
							</span>{" "}
							When configured, Google Analytics loads on the site and initializes
							measurement on the production apex and www hosts. Analytics and
							advertising storage start denied. Accepting the cookie banner grants
							analytics storage; declining keeps storage denied. The tag can load
							before that choice. Inference prompts and answers are not explicitly
							sent as analytics events by the site.
						</p>
					</section>

					{/* ===== SUB-PROCESSORS (DPA disclosure) ===== */}
					<section
						id="subprocessors"
						aria-labelledby="subprocessors-heading"
						className="border-t border-border-subtle container-page py-14 sm:py-18 lg:py-22"
					>
						<SectionHeading
							id="subprocessors-heading"
							title="Sub-processors"
							meta="Operational vendors"
						/>
						<p className="text-[13px] sm:text-sm text-text-secondary max-w-2xl mb-5">
							Hosting services process requests in transit. Other configured
							vendors handle account, payment, rate-limit, email or analytics data
							for their service. Contact{" "}
							<a
								href="mailto:support@nosytlabs.com"
								className="text-accent underline underline-offset-2"
							>
								support@nosytlabs.com
							</a>{" "}
							for questions about provider handling and data agreements.
						</p>
						<ul className="border border-border bg-surface divide-y divide-border">
							{[
								["Vercel", "Website hosting", "web requests and proxied inference content in transit"],
								["Neon", "API and database", "inference content in transit; stored account, usage and financial records"],
								["Redis / Upstash", "Rate limiting", "IP + key rate-limit counters"],
								["Base / on-chain RPC", "Settlement", "tx hashes for deposits"],
								["Resend", "Email delivery", "authentication and support email content"],
								["Google Analytics", "Site analytics", "configured Google tag and page measurements; storage consent controlled by the cookie banner"],
								["Polar", "Payment processing", "card checkout; no prompt content"],
							].map(([name, role, note]) => (
								<li
									key={name}
									className="grid grid-cols-[minmax(0,1fr)_7rem] sm:grid-cols-[minmax(0,1fr)_11rem_minmax(0,1fr)] items-center gap-3 px-3 sm:px-4 py-3"
								>
									<span className="text-[13px] sm:text-sm text-text-bright">
										{name}
									</span>
									<span className="text-[12.5px] text-text-muted">{role}</span>
									<span className="col-span-2 text-[11px] text-text-muted sm:col-span-1 sm:text-xs">
										{note}
									</span>
								</li>
							))}
						</ul>
					</section>

					{/* ===== YOUR RIGHTS ===== */}
					<section
						id="rights"
						aria-labelledby="rights-heading"
						className="border-t border-border-subtle container-page py-14 sm:py-18 lg:py-22"
					>
						<SectionHeading
							id="rights-heading"
							title="Your rights"
							meta="What you control"
						/>

						<div className="grid gap-3 sm:grid-cols-2">
							{[
								{
									icon: CircleAlert,
									title: "Delete your account",
									body: "Delete your account from Settings. Profile, sessions, keys, usage and account-linked balances are removed. Financial, audit and historical signup-grant records described above can remain. Clear browser chat history separately.",
								},
								{
									icon: Shield,
									title: "Revoke API keys",
									body: "Revoke a key from the dashboard to stop future requests authenticating with it. Requests already in progress can still complete and incur a charge.",
								},
								{
									icon: Eye,
									title: "Export account data",
									body: "Download the account export from Settings. It includes the profile, key metadata, active sessions, deposits, balance and account audit history exposed by the export API. Export local conversations separately from Chat history.",
								},
								{
									icon: CheckCircle2,
									title: "Ask a privacy question",
									body: "Email support@nosytlabs.com for access, correction, processing or deletion questions, including records retained after account deletion.",
								},
							].map((card) => (
								<div
									key={card.title}
									className="group border border-border bg-surface p-5 hover:border-accent/40 transition-colors duration-200 ease-out"
								>
									<div className="mb-3 flex items-center gap-3">
										<card.icon
											className="h-4 w-4 text-accent shrink-0"
											aria-hidden="true"
										/>
										<h3 className="font-display text-[15px] font-semibold text-text-bright">
											{card.title}
										</h3>
									</div>
									<p className="text-[12.5px] sm:text-[13px] text-text-secondary leading-relaxed">
										{card.body}
									</p>
								</div>
							))}
						</div>
					</section>

					{/* ===== FOOTER NAV ===== */}
					<section
						aria-label="Related documents"
						className="border-t border-border-subtle container-page py-14 sm:py-18 lg:py-22"
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
									{ href: "/", label: "Home" },
									{ href: "/pricing", label: "Pricing" },
									{ href: "/docs", label: "Docs" },
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
