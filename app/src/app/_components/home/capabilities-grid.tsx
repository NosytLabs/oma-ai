import { Reveal } from "@/app/_components/home/reveal";

/**
 * Section 01 — Private by construction (2026-11 revamp).
 *
 * Three ledger cards over hairline rules; the section footnote carries
 * the honest upstream-retention line. Copy is COPY.md §1 verbatim. (This
 * file keeps its historical name/export — it renders the privacy
 * section now, not the old capabilities grid.)
 */

const CARDS: { heading: string; body: string }[] = [
	{
		heading: "Your wallet is your account",
		body: "Sign in with an EVM wallet via SIWE. No email required, no password to remember, no name attached to your balance.",
	},
	{
		heading: "No card, ever",
		body: "OMA takes USDC on Base — by direct deposit or x402 pay-per-use settlement. There is no card checkout, so your card number never reaches us, and nothing about your bank appears on a statement.",
	},
	{
		heading: "Chats stay in your browser",
		body: "Website chat saves conversations and drafts locally, in your browser — not on our servers. Clear your usage history or delete your account from your settings at any time.",
	},
];

export function CapabilitiesGrid() {
	return (
		<section
			aria-labelledby="privacy-heading"
			className="border-b border-border"
		>
			<div className="container-page py-16 sm:py-20">
				<Reveal>
					<p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-accent">
						01 — Private by construction
					</p>
					<h2
						id="privacy-heading"
						className="section-headline mt-4 text-text-bright"
					>
						Private by construction, not by promise.
					</h2>
				</Reveal>
				<div className="mt-12 grid gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-3">
					{CARDS.map((card, i) => (
						<article key={card.heading} className="bg-panel p-6 sm:p-7">
							<Reveal delay={i * 0.05}>
								<p
									aria-hidden="true"
									className="ledger-figures font-mono text-[11px] text-text-muted"
								>
									0{i + 1}
								</p>
								<h3 className="mt-4 font-display text-lg font-semibold text-text-bright">
									{card.heading}
								</h3>
								<p className="mt-3 text-sm leading-relaxed text-text-secondary">
									{card.body}
								</p>
							</Reveal>
						</article>
					))}
				</div>
				<Reveal>
					<p className="mt-8 max-w-3xl text-[13px] leading-relaxed text-text-muted">
						Requests are processed by the provider behind the model you
						choose, and upstream retention follows that provider&rsquo;s
						policy. Your OMA ledger records the model, token counts, and
						charges for every request.
					</p>
				</Reveal>
			</div>
		</section>
	);
}
