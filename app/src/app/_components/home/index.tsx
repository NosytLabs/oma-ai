"use client";

/**
 * HomeView — homepage client root.
 * Renders all sections in conversion order.
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
			<TrustStrip />
			<StatsStrip />
			<CapabilitiesGrid />
			<HowItWorks />
			<CodeExample modelCount={MODEL_COUNT} />
			<AgentDemoSection />
			<X402Banner />
			<FinalCTA />
		</div>
	);
}
