/**
 * HomeView — server-rendered homepage composition.
 * Interactive sections keep their own client boundaries; the page shell stays
 * lightweight and preserves a consistent vertical rhythm across breakpoints.
 * Production source of truth: main.
 */

import { CapabilitiesGrid } from "@/app/_components/home/capabilities-grid";
import { CodeExample } from "@/app/_components/home/code-example";
import { FinalCTA } from "@/app/_components/home/final-cta";
import { Hero } from "@/app/_components/home/hero";
import { HowItWorks } from "@/app/_components/home/how-it-works";
import { StatsStrip } from "@/app/_components/home/stats-strip";
import { TrustStrip } from "@/app/_components/home/trust-strip";
import { MODEL_COUNT } from "@/lib/models-data";

export function HomeView() {
	return (
		<div className="flex min-w-0 flex-col">
			<Hero />

			<section className="border-y border-border-subtle bg-surface/30">
				<div className="container-page py-8 sm:py-10 lg:py-12">
					<div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.8fr)] lg:items-start lg:gap-10 xl:gap-12">
						<TrustStrip />
						<StatsStrip />
					</div>
				</div>
			</section>

			<CapabilitiesGrid />
			<HowItWorks />
			<CodeExample modelCount={MODEL_COUNT} />
			<FinalCTA />
		</div>
	);
}
