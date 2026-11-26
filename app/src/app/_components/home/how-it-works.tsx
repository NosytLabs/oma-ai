import { Reveal } from "@/app/_components/home/reveal";

/**
 * Section 03 — Four steps to first request (2026-11 revamp).
 * A ruled ledger row per step, mono numerals. Copy is COPY.md §1 verbatim.
 */

const STEPS: { heading: string; body: string }[] = [
	{
		heading: "Sign in with your wallet",
		body: "Connect an EVM wallet and sign in via SIWE — or use a passwordless email link if you prefer. No password either way.",
	},
	{
		heading: "Get your API key",
		body: "One key accesses the catalog within its model and IP restrictions. Rotate or revoke it from your dashboard at any time.",
	},
	{
		heading: "Fund credits, or settle per use",
		body: "Deposit USDC on Base to hold a prepaid balance, or let x402 settle USDC per use and credit the same balance. No card option exists.",
	},
	{
		heading: "Send your first request",
		body: "Point any OpenAI-compatible SDK at OMA. One key and one endpoint for the catalog — switch models by changing the model ID.",
	},
];

export function HowItWorks() {
	return (
		<section aria-labelledby="steps-heading" className="border-b border-border">
			<div className="container-page py-16 sm:py-20">
				<Reveal>
					<p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-accent">
						03 — Four steps to first request
					</p>
					<h2
						id="steps-heading"
						className="section-headline mt-4 text-text-bright"
					>
						Four steps to first request.
					</h2>
				</Reveal>
				<ol className="mt-12">
					{STEPS.map((step, i) => (
						<li
							key={step.heading}
							className="border-t border-border py-6 last:border-b sm:py-7"
						>
							<Reveal>
								<div className="grid gap-3 sm:grid-cols-[4rem_minmax(0,1fr)] sm:gap-6">
									<span
										aria-hidden="true"
										className="ledger-figures font-mono text-sm text-accent"
									>
										0{i + 1}
									</span>
									<div>
										<h3 className="font-display text-lg font-semibold text-text-bright">
											{step.heading}
										</h3>
										<p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
											{step.body}
										</p>
									</div>
								</div>
							</Reveal>
						</li>
					))}
				</ol>
			</div>
		</section>
	);
}
