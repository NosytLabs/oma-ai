/**
 * HomeView — server-rendered homepage composition (2026-11 revamp,
 * "The Numbered Account"): hero with the ledger card, then the numbered
 * sections 01–04 and the final CTA. The old trust/stats band and the
 * code-example section are retired from the composition; their
 * components remain in the repo, unmounted.
 */

import { CapabilitiesGrid } from "@/app/_components/home/capabilities-grid";
import { CatalogSection } from "@/app/_components/home/catalog-section";
import { FinalCTA } from "@/app/_components/home/final-cta";
import { Hero } from "@/app/_components/home/hero";
import { HowItWorks } from "@/app/_components/home/how-it-works";
import { PayPerUse } from "@/app/_components/home/pay-per-use";

export function HomeView() {
	return (
		<div className="flex min-w-0 flex-col">
			<Hero />
			<CapabilitiesGrid />
			<CatalogSection />
			<HowItWorks />
			<PayPerUse />
			<FinalCTA />
		</div>
	);
}
