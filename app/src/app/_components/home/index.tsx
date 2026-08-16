/**
	* HomeView — server-rendered homepage composition.
	*
	* Interactive sections keep their own client boundaries; the page shell no
	* longer turns the entire marketing surface into one eager client root.
	*/

import { AgentDemoSection } from "@/app/_components/home/agent-demo";
import { CapabilitiesGrid } from "@/app/_components/home/capabilities-grid";
import { CodeExample } from "@/app/_components/home/code-example";
import { FinalCTA } from "@/app/_components/home/final-cta";
import { Hero } from "@/app/_components/home/hero";
import { HowItWorks } from "@/app/_components/home/how-it-works";
import { StatsStrip } from "@/app/_components/home/stats-strip";
import { TrustStrip } from "@/app/_components/home/trust-strip";
import { X402Banner } from "@/app/_components/home/x402-banner";
import { MODEL_COUNT } from "@/lib/models-data";

export function HomeView() {
	return (
		<div className="flex flex-col">
			<Hero />
			<div className="border-y border-border-subtle bg-surface/30">
				<div className="container-page py-10 sm:py-12">
					<div className="grid gap-8 lg:gap-10 lg:grid-cols-[1fr_2fr] lg:items-stretch">
						<TrustStrip />
						<StatsStrip />
					</div>
				</div>
			</div>
			<CapabilitiesGrid />
			<HowItWorks />
			<CodeExample modelCount={MODEL_COUNT} />
			<AgentDemoSection />
			<X402Banner />
			<FinalCTA />
		</div>
	);
}
