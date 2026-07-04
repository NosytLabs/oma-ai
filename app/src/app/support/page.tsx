/* OMA · Support page
 * support channels: general · billing · privacy · legal
 * contact form: mailto-based (no backend required)
 */

import {
	ArrowLeft,
	Bug,
	Clock,
	HelpCircle,
	Mail,
	MessageSquare,
	Shield,
	Wallet,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
	title: "Support · OMA",
	description:
		"Get help with OMA. Reach us by email for billing, privacy, legal, or general questions. Average response time is 14 days.",
	alternates: { canonical: "/support" },
	openGraph: {
		title: "Support · OMA",
		description:
			"Contact the OMA team for billing, privacy, legal, or general questions.",
	},
};

const CHANNELS = [
	{
		icon: MessageSquare,
		label: "General",
		description: "Questions about the API, integration, or the service.",
		email: "hello@oma-ai.com",
		subject: "General inquiry",
		tone: "accent",
	},
	{
		icon: Wallet,
		label: "Billing",
		description:
			"Deposit issues, refund requests within 24h, or credit questions.",
		email: "billing@oma-ai.com",
		subject: "Billing question",
		tone: "accent",
	},
	{
		icon: Shield,
		label: "Privacy",
		description: "Data export, deletion requests, or privacy concerns.",
		email: "privacy@oma-ai.com",
		subject: "Privacy request",
		tone: "accent",
	},
	{
		icon: Bug,
		label: "Security",
		description: "Vulnerabilities, incidents, or suspicious activity.",
		email: "security@oma-ai.com",
		subject: "Security report",
		tone: "warning",
	},
] as const;

const SELF_SERVICE = [
	{
		icon: HelpCircle,
		label: "FAQ",
		href: "/faq",
		description: "Answers to the most common questions.",
	},
	{
		icon: Clock,
		label: "API Status",
		href: "/about#status",
		description: "Real-time endpoint and deposit watcher status.",
	},
] as const;

export default function SupportPage() {
	return (
		<div className="min-h-screen bg-void text-text-secondary font-mono selection:bg-accent-dim selection:text-accent">
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

						<div className="max-w-3xl">
							<span className="inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent">
								<span
									className="h-1.5 w-1.5 rounded-full bg-accent"
									aria-hidden="true"
								/>
								Support
							</span>

							<h1
								className="h1-page text-text-bright mt-6"
								style={{
									overflowWrap: "anywhere",
									minWidth: 0,
									textWrap: "balance",
								}}
							>
								<span className="block">Reach a human,</span>
								<span className="block text-accent">not a chatbot.</span>
							</h1>

							<p className="mt-4 max-w-2xl text-[15px] sm:text-base text-text leading-relaxed">
								OMA is a small team. We read every message and aim to reply
								within 14 days. For faster answers, check the FAQ first —
								it covers the questions we get most.
							</p>
						</div>
					</section>

					{/* ===== CHANNELS ===== */}
					<section
						aria-labelledby="channels-heading"
						className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
					>
						<h2
							id="channels-heading"
							className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-bright mb-6"
						>
							Contact channels
						</h2>

						<div className="grid gap-4 sm:grid-cols-2">
							{CHANNELS.map((ch) => (
								<a
									key={ch.label}
									href={`mailto:${ch.email}?subject=${encodeURIComponent(ch.subject)}`}
									className="group border border-border bg-surface hover:border-accent/40 transition-colors p-5 rounded-xl flex items-start gap-4"
								>
									<div
										className={`mt-0.5 shrink-0 rounded-lg p-2 ${
											ch.tone === "warning"
												? "bg-warning/10 text-warning"
												: "bg-accent/10 text-accent"
										}`}
									>
										<ch.icon className="h-4 w-4" aria-hidden="true" />
									</div>
									<div className="min-w-0">
										<p className="text-[13px] font-semibold text-text-bright">
											{ch.label}
										</p>
										<p className="mt-1 text-[12px] text-text-secondary leading-relaxed">
											{ch.description}
										</p>
										<p className="mt-2 text-[11.5px] text-accent group-hover:underline underline-offset-2">
											{ch.email}
										</p>
									</div>
								</a>
							))}
						</div>
					</section>

					{/* ===== CONTACT FORM ===== */}
					<section
						aria-labelledby="form-heading"
						className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-12 sm:py-16"
					>
						<div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] items-start">
							<div>
								<h2
									id="form-heading"
									className="font-display text-xl sm:text-2xl font-bold tracking-tight text-text-bright mb-2"
								>
									Send a message
								</h2>
								<p className="text-[13px] text-text-muted mb-6">
									Choose a topic and describe your issue. The right team
									gets CC&apos;d automatically.
								</p>

								<form
									className="border border-border bg-surface p-5 sm:p-6 space-y-4"
									action="mailto:hello@oma-ai.com"
									method="POST"
									encType="text/plain"
								>
									<div className="grid gap-4 sm:grid-cols-2">
										<div className="space-y-1.5">
											<label
												htmlFor="topic"
												className="text-[11px] font-semibold uppercase tracking-wide text-text-muted"
											>
												Topic
											</label>
											<select
												id="topic"
												name="topic"
												className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-[13px] text-text-secondary outline-none focus:border-accent transition-colors cursor-pointer"
												defaultValue=""
											>
												<option value="" disabled>
													Select a topic
												</option>
												<option value="General">General question</option>
												<option value="Billing">
													Billing / credits
												</option>
												<option value="Refund">
													Refund request
												</option>
												<option value="Privacy">
													Privacy / data
												</option>
												<option value="Security">
													Security issue
												</option>
												<option value="Bug">Bug report</option>
												<option value="Feature">
													Feature request
												</option>
												<option value="Partnership">
													Partnership
												</option>
											</select>
										</div>

										<div className="space-y-1.5">
											<label
												htmlFor="email"
												className="text-[11px] font-semibold uppercase tracking-wide text-text-muted"
											>
												Your email
											</label>
											<input
												id="email"
												name="email"
												type="email"
												placeholder="you@example.com"
												required
												className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-[13px] text-text-secondary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors"
											/>
										</div>
									</div>

									<div className="space-y-1.5">
										<label
											htmlFor="wallet"
											className="text-[11px] font-semibold uppercase tracking-wide text-text-muted"
										>
											Wallet address{" "}
											<span className="normal-case font-normal text-text-tertiary">
												(optional)
											</span>
										</label>
										<input
											id="wallet"
											name="wallet"
											type="text"
											placeholder="0x..."
											pattern="^0x[a-fA-F0-9]{40}$"
											className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-[13px] text-text-secondary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors font-mono"
										/>
									</div>

									<div className="space-y-1.5">
										<label
											htmlFor="message"
											className="text-[11px] font-semibold uppercase tracking-wide text-text-muted"
										>
											Message
										</label>
										<textarea
											id="message"
											name="message"
											rows={5}
											placeholder="Describe the issue in as much detail as you can. Include any transaction hashes, API keys, or error messages."
											required
											className="w-full rounded-lg border border-border bg-panel px-3 py-2 text-[13px] text-text-secondary placeholder:text-text-tertiary outline-none focus:border-accent transition-colors resize-y min-h-[120px]"
										/>
									</div>

									<button
										type="submit"
										className="w-full sm:w-auto bg-accent text-void hover:bg-accent-hover px-6 py-2.5 rounded-lg text-[13px] font-medium transition-colors flex items-center justify-center gap-2"
									>
										<Mail className="h-3.5 w-3.5" aria-hidden="true" />
										Open in mail client
									</button>

									<p className="text-[11px] text-text-tertiary">
										Form opens your default mail client. For encrypted
										communication, email us directly at{" "}
										<a
											href="mailto:hello@oma-ai.com"
											className="text-accent hover:underline underline-offset-2"
										>
											hello@oma-ai.com
										</a>
										.
									</p>
								</form>
							</div>

							{/* ===== SIDEBAR ===== */}
							<aside className="space-y-4">
								<div className="border border-border bg-surface p-5 rounded-xl">
									<h3 className="text-[12px] font-semibold text-text-bright mb-3">
										Self-service first
									</h3>
									<div className="space-y-3">
										{SELF_SERVICE.map((item) => (
											<Link
												key={item.href}
												href={item.href}
												className="flex items-start gap-3 group"
											>
												<div className="mt-0.5 shrink-0 text-accent">
													<item.icon
														className="h-3.5 w-3.5"
														aria-hidden="true"
													/>
												</div>
												<div>
													<p className="text-[12px] font-medium text-text-bright group-hover:text-accent transition-colors">
														{item.label}
													</p>
													<p className="text-[11px] text-text-muted">
														{item.description}
													</p>
												</div>
											</Link>
										))}
									</div>
								</div>

								<div className="border border-border bg-surface p-5 rounded-xl">
									<h3 className="text-[12px] font-semibold text-text-bright mb-3">
										Response times
									</h3>
									<div className="space-y-2">
										{[
											["General", "~14 days"],
											["Billing", "~5 days"],
											["Privacy", "~5 days"],
											["Security", "~48h"],
										].map(([channel, time]) => (
											<div
												key={channel}
												className="flex items-center justify-between text-[12px]"
											>
												<span className="text-text-secondary">{channel}</span>
												<span className="text-accent font-medium tabular-nums">
													{time}
												</span>
											</div>
										))}
									</div>
								</div>

								<div className="border border-warning/30 bg-warning/5 p-5 rounded-xl">
									<p className="text-[12px] text-text-secondary leading-relaxed">
										<span className="font-semibold text-warning">
											Deposits and refunds:
										</span>{" "}
										Email{" "}
										<a
											href="mailto:billing@oma-ai.com"
											className="text-accent hover:underline underline-offset-2"
										>
											billing@oma-ai.com
										</a>{" "}
										with your transaction hash. Refunds require the deposit
										to be within 24 hours and unused.
									</p>
								</div>
							</aside>
						</div>
					</section>

					{/* ===== LEGAL ===== */}
					<section className="border-t border-border mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<p className="text-[11px] sm:text-xs text-text-muted">
								Legal questions?{" "}
								<a
									href="mailto:legal@oma-ai.com"
									className="font-medium text-accent underline decoration-2 underline-offset-2 hover:no-underline"
								>
									legal@oma-ai.com
								</a>
							</p>
							<ul className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] sm:text-xs">
								{[
									{ href: "/terms", label: "Terms" },
									{ href: "/privacy", label: "Privacy" },
									{ href: "/faq", label: "FAQ" },
									{ href: "/about", label: "About" },
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
