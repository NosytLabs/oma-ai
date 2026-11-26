import Link from "next/link";
import { Reveal } from "@/app/_components/home/reveal";

/**
 * Hero — "The Numbered Account" (2026-11 revamp).
 *
 * Left-aligned ledger composition: mono kicker, Montserrat headline, the
 * brass rule drawing itself underneath, and a static illustrative ledger
 * card — a request and its exact charge — where the animated demo used
 * to be. Copy is COPY.md §1 verbatim.
 */

const LEDGER_ROWS: { label: string; value: string }[] = [
	{ label: "model", value: "llama-3.3-70b" },
	{ label: "status", value: "200 · 1,204 tokens" },
	{ label: "charged", value: "0.09 cr" },
	{ label: "balance after", value: "2,500 cr" },
];

export function Hero() {
	return (
		<section className="relative overflow-hidden border-b border-border">
			<div className="container-page py-16 sm:py-20 lg:py-24">
				<div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-16">
					<div>
						<Reveal>
							<p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-accent">
								Open Model Access · Wallet in, card never
							</p>
						</Reveal>
						<Reveal delay={0.05}>
							<h1 className="h1-hero mt-6 text-text-bright">
								Your AI. Your keys. Nobody else&rsquo;s business.
							</h1>
						</Reveal>
						<Reveal delay={0.1}>
							<div
								aria-hidden="true"
								className="rule-draw mt-8 h-[3px] w-44 bg-accent"
							/>
						</Reveal>
						<Reveal delay={0.15}>
							<p className="mt-8 max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg">
								One OpenAI-compatible API and a curated model catalog. Change
								the model ID to change the model — no new integration, no new
								account, no credit card. Sign in with an EVM wallet and pay
								only for the tokens you use, in USDC on Base.
							</p>
						</Reveal>
						<Reveal delay={0.2}>
							<div className="mt-10 flex flex-wrap items-center gap-4">
								<Link href="/login?next=/dashboard" className="btn-primary">
									Start with your wallet
								</Link>
								<Link href="/pricing" className="btn-secondary">
									See pricing
								</Link>
							</div>
						</Reveal>
						<Reveal delay={0.25}>
							<p className="mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
								No credit card · No subscription · Free website chat on
								eligible models
							</p>
						</Reveal>
					</div>

					<Reveal delay={0.15}>
						<figure
							aria-label="Illustrative ledger entry for an API request"
							className="surface-card p-6 sm:p-7"
						>
							<figcaption className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-accent">
								A request, and what it cost
							</figcaption>
							<p className="mt-5 font-mono text-[13px] text-text-bright">
								POST /v1/chat/completions
							</p>
							<dl className="mt-4">
								{LEDGER_ROWS.map((row) => (
									<div
										key={row.label}
										className="flex items-baseline justify-between gap-6 border-t border-border py-3"
									>
										<dt className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
											{row.label}
										</dt>
										<dd className="ledger-figures font-mono text-[13px] text-text">
											{row.value}
										</dd>
									</div>
								))}
							</dl>
							<p className="mt-5 border-t border-border pt-4 text-[12px] leading-relaxed text-text-muted">
								Illustrative request and charge. Check the catalog for live
								availability.
							</p>
						</figure>
					</Reveal>
				</div>
			</div>
		</section>
	);
}
