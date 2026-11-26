import Link from "next/link";
import { Reveal } from "@/app/_components/home/reveal";
import { OmaLogo } from "@/components/ui/oma-logo";

/**
 * Final CTA — the seal over the closing line (2026-11 revamp).
 * The seal is the OMA mark inside a double ring: outer rule + brass ring.
 * Copy is COPY.md §1 verbatim.
 */

export function FinalCTA() {
	return (
		<section aria-labelledby="final-cta-heading">
			<div className="container-page py-20 sm:py-24">
				<Reveal>
					<div className="flex flex-col items-center text-center">
						<div
							aria-hidden="true"
							className="flex h-24 w-24 items-center justify-center rounded-full border border-border"
						>
							<div className="flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full border border-accent">
								<OmaLogo size="sm" />
							</div>
						</div>
						<h2
							id="final-cta-heading"
							className="section-headline mt-10 text-text-bright"
						>
							Open an account with a wallet.
						</h2>
						<p className="mt-4 max-w-xl text-base leading-relaxed text-text-secondary">
							Create a key, fund it with USDC, and make your first call —
							without handing anyone your card or your email.
						</p>
						<Link
							href="/login?next=/dashboard"
							className="btn-primary mt-10"
						>
							Get a key
						</Link>
						<p className="mt-8 font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
							No credit card required · Free website chat on eligible models
						</p>
					</div>
				</Reveal>
			</div>
		</section>
	);
}
